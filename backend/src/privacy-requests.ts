import "dotenv/config"
import { readFile, writeFile } from "node:fs/promises"
import { z } from "zod"
import { loadConfig } from "./app/config.js"
import { Database } from "./shared/infrastructure/database.js"
import { Operation } from "./shared/application/operation.js"
import { clock, diagnostics, ids } from "./shared/infrastructure/runtime.js"
import { Failure } from "@cardapio/domain/failure"

// Server-side operator tool. Requires restricted access to the server and its database credentials.
// Personal data is written only to a new private file, never to application logs or stdout.
const [command, id, file, status] = process.argv.slice(2)
const database = new Database(loadConfig(process.env))
const operation = new Operation(diagnostics, ids, clock)
try {
  const result = await operation.run("privacy.operator", async () => {
    if (command === "list") {
      const requests = await database.run((client) =>
        client.privacyRequest.findMany({
          where: { status: { in: ["RECEIVED", "IN_REVIEW"] } },
          orderBy: { createdAt: "asc" },
          take: 100,
          select: { id: true, kind: true, status: true, createdAt: true },
        }),
      )
      process.stdout.write(JSON.stringify(requests, null, 2) + "\n")
      return
    }
    const requestId = z.uuid().parse(id)
    if (!file) throw new Failure("VALIDATION", "Informe um caminho de arquivo privado.")
    if (command === "show") {
      const request = await database.run((client) =>
        client.privacyRequest.findUnique({
          where: { id: requestId },
          select: {
            id: true,
            kind: true,
            message: true,
            status: true,
            createdAt: true,
            resolvedAt: true,
            response: true,
            user: { select: { id: true, name: true, email: true } },
          },
        }),
      )
      if (!request) throw new Failure("NOT_FOUND", "Solicitação não encontrada.")
      await writeFile(file, JSON.stringify(request, null, 2) + "\n", {
        flag: "wx",
        mode: 0o600,
      })
      process.stdout.write("Arquivo privado criado.\n")
      return
    }
    if (command === "respond") {
      const next = z.enum(["IN_REVIEW", "COMPLETED", "DECLINED"]).parse(status)
      const response = z
        .string()
        .trim()
        .min(10)
        .max(2000)
        .parse(await readFile(file, "utf8"))
      const updated = await database.run((client) =>
        client.privacyRequest.updateMany({
          where: { id: requestId, status: { in: ["RECEIVED", "IN_REVIEW"] } },
          data: {
            status: next,
            response,
            resolvedAt: next === "IN_REVIEW" ? null : clock.now(),
          },
        }),
      )
      if (updated.count !== 1)
        throw new Failure("CONFLICT", "Solicitação inexistente ou já encerrada.")
      process.stdout.write("Resposta registrada na Central de Privacidade.\n")
      return
    }
    throw new Failure(
      "VALIDATION",
      "Comandos: list; show <protocolo> <arquivo novo>; respond <protocolo> <arquivo de resposta> <IN_REVIEW|COMPLETED|DECLINED>.",
    )
  })
  if (!result.ok) process.exitCode = 1
} finally {
  await database.close()
}
