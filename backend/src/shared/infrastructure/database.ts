import { readFileSync } from "node:fs"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import { PrismaClient, Prisma } from "../../generated/prisma/client.js"
import { Failure } from "@cardapio/domain/failure"
export interface DatabaseConfig {
  database: URL
  databaseTls: boolean
  databaseCaFile?: string
}

export type Transaction = Prisma.TransactionClient
export class Database {
  readonly client: PrismaClient
  constructor(config: DatabaseConfig) {
    const url = config.database
    const adapter = new PrismaMariaDb({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      connectionLimit: 10,
      connectTimeout: 5000,
      acquireTimeout: 10000,
      allowPublicKeyRetrieval: !config.databaseTls,
      ...(config.databaseTls
        ? {
            ssl: {
              rejectUnauthorized: true,
              ...(config.databaseCaFile
                ? { ca: readFileSync(config.databaseCaFile, "utf8") }
                : {}),
            },
          }
        : {}),
    })
    this.client = new PrismaClient({ adapter, log: [], errorFormat: "minimal" })
  }
  async run<T>(action: (client: PrismaClient) => Promise<T>): Promise<T> {
    try {
      return await action(this.client)
    } catch (error) {
      if (error instanceof Failure) throw error
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (["P2002", "P2034"].includes(error.code))
          throw new Failure(
            "CONFLICT",
            "Outra alteração entrou em conflito. Atualize os dados e tente novamente.",
            {},
            "database_conflict",
          )
        if (["P2003", "P2025"].includes(error.code))
          throw new Failure(
            "NOT_FOUND",
            "O recurso solicitado não está disponível.",
            {},
            "database_reference",
          )
      }
      throw new Failure(
        "STORAGE_UNAVAILABLE",
        "O banco está indisponível. Tente novamente em instantes.",
        {},
        error instanceof Prisma.PrismaClientKnownRequestError &&
          /^P[0-9]{4}$/.test(error.code)
          ? `database_${error.code}`
          : error instanceof Prisma.PrismaClientValidationError
            ? "database_query_validation"
            : "database_unavailable",
      )
    }
  }
  transaction<T>(action: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.run((client) =>
      client.$transaction(action, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000,
      }),
    )
  }
  async connect() {
    await this.run(async (client) => {
      await client.$connect()
      await client.$queryRaw`SELECT 1`
    })
  }
  async close() {
    await this.client.$disconnect()
  }
}
