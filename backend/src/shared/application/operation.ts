import { Failure } from "@cardapio/domain/failure"
import type { Result, AppError } from "@cardapio/contracts"
import type { Clock, DiagnosticLogger, IdGenerator } from "./ports.js"

export class Operation {
  constructor(
    private readonly logger: DiagnosticLogger,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}
  error(operation: string, cause: unknown): AppError {
    const failure =
      cause instanceof Failure
        ? cause
        : new Failure(
            "UNEXPECTED",
            "Não foi possível concluir a operação. Tente novamente.",
          )
    const diagnosticId = this.ids.next()
    try {
      this.logger.record({
        diagnosticId,
        module: operation.split(".")[0] ?? "application",
        operation,
        code: failure.code,
        timestamp: this.clock.now().toISOString(),
        errorType: cause instanceof Error ? cause.name : undefined,
        frames:
          cause instanceof Error
            ? cause.stack
                ?.split("\n")
                .slice(1, 9)
                .flatMap((line) => {
                  const match = line.match(/([\w.-]+\.(?:js|ts|tsx):\d+:\d+)\)?$/)
                  return match ? [match[1]!] : []
                })
            : undefined,
        cause:
          failure.technicalCause ??
          (cause instanceof Failure ? "controlled_failure" : "unhandled_failure"),
      })
    } catch {
      /* A failed diagnostic sink cannot authorize or confirm an operation. */
    }
    return {
      code: failure.code,
      message: failure.message,
      fields: failure.fields,
      diagnosticId,
    }
  }
  async run<T>(name: string, action: () => Promise<T>): Promise<Result<T>> {
    try {
      return { ok: true, value: await action() }
    } catch (cause) {
      return { ok: false, error: this.error(name, cause) }
    }
  }
}
