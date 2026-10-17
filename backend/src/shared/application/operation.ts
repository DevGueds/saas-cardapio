import type { AppError, Result } from "@cardapio/contracts"
import { Failure } from "@cardapio/domain/failure"
import type { Clock, DiagnosticLogger, IdGenerator } from "./ports.js"

export class Operation {
  constructor(
    private readonly logger: DiagnosticLogger,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  error(operation: string, cause: unknown): AppError {
    // 🔍 Imprime a exceção bruta no terminal para identificar causas de UNEXPECTED no ambiente dev
    if (!(cause instanceof Failure)) {
      console.error(`\n🔥 [UNHANDLED ERROR - ${operation}]:`, cause, "\n")
    }

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
        cause:
          failure.technicalCause ??
          (cause instanceof Failure
            ? "controlled_failure"
            : cause instanceof Error
              ? cause.message
              : "unhandled_failure"),
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