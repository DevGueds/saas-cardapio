import { createServer } from "node:http"
import { execFileSync } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import assert from "node:assert/strict"
import { prepareMenuShell } from "./prepare-menu-shell.mjs"
const directory = path.resolve(".cache/social-shell"),
  container = `cardapio-social-shell-${process.pid}`
await mkdir(directory, { recursive: true })
await writeFile(
  path.join(directory, "index.html"),
  prepareMenuShell(await readFile("dist/index.html", "utf8")),
)
const backend = createServer((request, response) => {
  if (request.url?.endsWith("/share")) {
    response.setHeader("Content-Type", "text/html")
    response.end(
      '<title>Loja Teste</title><meta property="og:title" content="Loja Teste"><meta property="og:image" content="https://example.test/square.png">',
    )
  } else {
    response.setHeader("Content-Type", "application/json")
    response.end('{"ok":true,"value":{"status":"ready"}}')
  }
})
await new Promise((resolve) => backend.listen(0, "0.0.0.0", resolve))
try {
  const backendPort = backend.address().port
  execFileSync(
    "docker",
    [
      "run",
      "--rm",
      "-d",
      "--name",
      container,
      "-p",
      "127.0.0.1::8080",
      "-e",
      "PORT=8080",
      "-e",
      "API_HOST=host.docker.internal",
      "-e",
      "API_REPLICA_HOST=host.docker.internal",
      "-e",
      `API_PORT=${backendPort}`,
      "-v",
      `${directory}:/srv:ro`,
      "-v",
      `${path.resolve("railway/web/Caddyfile")}:/etc/caddy/Caddyfile:ro`,
      "cardapio-railway-web:check",
    ],
    { stdio: "pipe", windowsHide: true },
  )
  const address = execFileSync("docker", ["port", container, "8080"], {
    encoding: "utf8",
  }).trim()
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      if ((await fetch(`http://${address}/healthz`)).ok) break
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  for (const suffix of ["", "?utm_source=test"]) {
    const response = await fetch(`http://${address}/menu/loja-teste${suffix}`),
      html = await response.text()
    assert.equal(response.status, 200, html.slice(0, 1000))
    assert.equal((html.match(/property="og:title"/g) ?? []).length, 1)
    assert.match(html, /<title>Loja Teste<\/title>/)
    assert.ok(!html.includes("{{"))
    assert.match(html, /\/assets\//)
  }
  const generic = await (await fetch(`http://${address}/login`)).text()
  assert.ok(!generic.includes("Loja Teste") && !generic.includes("{{"))
  console.log(
    "Caddy: metadados dinâmicos no HTML inicial, URL com query e páginas genéricas verificados.",
  )
} finally {
  try {
    execFileSync("docker", ["rm", "-f", container], { stdio: "ignore" })
  } catch {}
  await new Promise((resolve) => backend.close(resolve))
}
