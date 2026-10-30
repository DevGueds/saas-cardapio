import { spawnSync } from "node:child_process"
import { randomBytes, generateKeyPairSync } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

// Additive CLI provisioning: no changes to existing app/database services.
const root = fileURLToPath(new URL("../", import.meta.url))
const args = process.argv.slice(2),
  option = (key) => args[args.indexOf(key) + 1]
const project = args.includes("--project") ? option("--project") : ""
const environment = args.includes("--environment")
  ? option("--environment")
  : "production"
if (!/^[a-f0-9-]{36}$/.test(project)) throw new Error("Informe --project <id>.")
if (!args.includes("--apply"))
  throw new Error("Use --apply para provisionar postal e postal-db.")
const local = path.join(root, ".railway/local")
mkdirSync(local, { recursive: true })
const credentialFile = path.join(local, `postal-${project}.json`)
const hasCredentials = existsSync(credentialFile)
const credentials = hasCredentials
  ? JSON.parse(readFileSync(credentialFile, "utf8"))
  : {
      databasePassword: randomBytes(32).toString("hex"),
      railsSecret: randomBytes(64).toString("hex"),
      signingKey: Buffer.from(
        generateKeyPairSync("rsa", {
          modulusLength: 2048,
          privateKeyEncoding: { type: "pkcs1", format: "pem" },
          publicKeyEncoding: { type: "spki", format: "pem" },
        }).privateKey,
      ).toString("base64"),
      adminEmail: "admin@localhost.invalid",
      adminPassword: randomBytes(24).toString("base64url"),
    }
const cli = path.join(root, ".railway/node_modules/@railway/cli/bin", process.platform === "win32" ? "railway.exe" : "railway")
const env = {
  ...process.env,
  RAILWAY_CALLER: "skill:use-railway@1.7.0",
  RAILWAY_AGENT_SESSION: "pedeaqui-20261030-features",
}
function run(command) {
  const result = spawnSync(cli, command, {
    cwd: root,
    env,
    encoding: "utf8",
    windowsHide: true,
    timeout: 240000,
    maxBuffer: 4 * 1024 * 1024,
  })
  if (result.status !== 0)
    throw new Error(
      `Railway ${command[0]} falhou: ${String(result.stderr || result.error?.message || "resposta indisponível").slice(0, 1200)}`,
    )
  return JSON.parse(result.stdout)
}
function api(query, variables) {
  const temporary = path.join(
    local,
    `postal-request-${randomBytes(6).toString("hex")}.json`,
  )
  writeFileSync(temporary, JSON.stringify(variables), { mode: 0o600 })
  try {
    const result = run(["api", query, "--variables", "@" + temporary, "--compact"])
    if (result.errors) throw new Error("Railway rejeitou a operação.")
    return result.data ?? result
  } finally {
    unlinkSync(temporary)
  }
}
const state = api(
  "query($id:String!){project(id:$id){id name services{edges{node{id name}}} environments{edges{node{id name volumeInstances{edges{node{serviceId}}}}}}}}",
  { id: project },
).project
const selected = state.environments.edges.find(
  ({ node }) => node.name === environment,
)?.node
if (!selected) throw new Error("Ambiente não encontrado no projeto informado.")
if (!hasCredentials && state.services.edges.some(({ node }) => ["postal", "postal-db"].includes(node.name)))
  throw new Error("Postal já existe. Recupere o arquivo privado de credenciais antes de adotar os serviços; os segredos remotos não foram alterados.")
writeFileSync(credentialFile, JSON.stringify(credentials, null, 2) + "\n", { mode: 0o600 })
const ensure = (name, variables, source) => {
  const existing = state.services.edges.find(({ node }) => node.name === name)?.node
  if (existing) return existing
  const service = api(
    "mutation($input:ServiceCreateInput!){serviceCreate(input:$input){id name}}",
    {
      input: {
        projectId: project,
        environmentId: selected.id,
        name,
        variables,
        ...(source ? { source } : {}),
      },
    },
  ).serviceCreate
  console.log(`Criado: ${service.name}`)
  return service
}
const database = ensure(
  "postal-db",
  {
    MARIADB_ROOT_PASSWORD: credentials.databasePassword,
    MARIADB_ROOT_HOST: "%",
    MARIADB_DATABASE: "postal",
  },
  { image: "mariadb:11.4" },
)
if (!selected.volumeInstances.edges.some(({ node }) => node.serviceId === database.id)) {
  api("mutation($input:VolumeCreateInput!){volumeCreate(input:$input){id}}", {
    input: {
      projectId: project,
      environmentId: selected.id,
      serviceId: database.id,
      mountPath: "/var/lib/mysql",
      region: "europe-west4",
    },
  })
  console.log("Volume persistente criado para postal-db.")
}
const postal = ensure("postal", {
  PORT: "5000",
  BIND_ADDRESS: "0.0.0.0",
  POSTAL_ENABLED: "true",
  POSTAL_DELIVERY_ENABLED: "false",
    EMAIL_SEND_ENABLED: "false",
  MAIN_DB_HOST: "${{postal-db.RAILWAY_PRIVATE_DOMAIN}}",
  MAIN_DB_USERNAME: "root",
  MAIN_DB_DATABASE: "postal",
  MAIN_DB_PASSWORD: "${{postal-db.MARIADB_ROOT_PASSWORD}}",
  RAILS_SECRET_KEY: credentials.railsSecret,
  POSTAL_SIGNING_KEY_BASE64: credentials.signingKey,
  POSTAL_ADMIN_EMAIL: credentials.adminEmail,
  POSTAL_ADMIN_PASSWORD: credentials.adminPassword,
})
api(
  "mutation($environmentId:String!,$serviceId:String!,$input:ServiceInstanceUpdateInput!){serviceInstanceUpdate(environmentId:$environmentId,serviceId:$serviceId,input:$input)}",
  {
    environmentId: selected.id,
    serviceId: postal.id,
    input: {
      healthcheckPath: "/login",
      healthcheckTimeout: 240,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 3,
    },
  },
)
console.log(
  JSON.stringify({
    project: state.name,
    environment: selected.name,
    postalService: postal.id,
    databaseService: database.id,
    credentialFile: path.relative(root, credentialFile),
    deliveryEnabled: false,
  }),
)
