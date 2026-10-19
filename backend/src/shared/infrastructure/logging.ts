import { join } from "node:path"
import pino, { type DestinationStream } from "pino"
import { createStream } from "rotating-file-stream"
import type { DiagnosticLogger } from "../application/ports.js"

const code = (value: string) => (/^[\w.:-]{1,120}$/.test(value) ? value : "redacted")
export function createDiagnostics(
  options: { level: string; directory?: string; instance: string },
  output: DestinationStream = process.stdout,
) {
  const terminal = pino(
    {
      level: options.level,
      base: { service: "cardapio-api", instance: options.instance },
    },
    output,
  )
  const fileUnavailable = () => {
    try {
      terminal.warn(
        { event: "logging.file_unavailable" },
        "Arquivo de log indisponível; terminal ativo",
      )
    } catch {
      /* A broken terminal must not turn a file error into an uncaught exception. */
    }
  }
  let file: ReturnType<typeof createStream> | undefined
  if (options.directory) {
    try {
      file = createStream("api.log", {
        path: join(options.directory, options.instance),
        size: "10M",
        interval: "1d",
        maxFiles: 7,
        compress: "gzip",
      })
      file.on("error", fileUnavailable)
    } catch {
      fileUnavailable()
    }
  }
  const logger = pino(
    {
      level: options.level,
      base: { service: "cardapio-api", instance: options.instance },
      redact: [
        "password",
        "token",
        "cookie",
        "authorization",
        "customer",
        "body",
        "headers",
      ],
    },
    pino.multistream([{ stream: output }, ...(file ? [{ stream: file }] : [])]),
  )
  const diagnostics: DiagnosticLogger = {
    record(event) {
      const safe = {
        diagnosticId: code(event.diagnosticId),
        module: code(event.module),
        operation: code(event.operation),
        code: code(event.code),
        cause: code(event.cause),
        errorType: event.errorType ? code(event.errorType) : undefined,
        frames: event.frames
          ?.slice(0, 8)
          .filter((frame) => /^[\w.-]+\.(?:js|ts|tsx):\d+:\d+$/.test(frame)),
      }
      try {
        if (
          ["UNEXPECTED", "STORAGE_UNAVAILABLE", "CORRUPT_DATA", "CONFIGURATION"].includes(
            event.code,
          )
        )
          logger.error(safe, "Falha na operação")
        else logger.warn(safe, "Operação recusada")
      } catch {
        /* Diagnostics never change a business result. */
      }
    },
  }
  return {
    ...diagnostics,
    http(event: {
      requestId: string
      method: string
      route: string
      status: number
      durationMs: number
    }) {
      // route is a server-registered template; never log a raw URL or query.
      try {
        logger.info(event, "Requisição concluída")
      } catch {
        /* Terminal remains best effort. */
      }
    },
    ready(port: number) {
      try {
        logger.info({ event: "startup.ready", port }, "API pronta")
      } catch {
        /* Logging does not decide whether the application can serve requests. */
      }
    },
    close: () =>
      new Promise<void>((resolve) => {
        try {
          if (file && !file.destroyed) file.end(resolve)
          else resolve()
        } catch {
          resolve()
        }
      }),
  }
}
