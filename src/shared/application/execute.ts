import { Failure } from "../domain/failure"

import type { DiagnosticLogger, IdGenerator } from "./ports"

import type { Result } from "./result"

export class Executor {
  constructor(
    private readonly logger: DiagnosticLogger,
    private readonly ids: IdGenerator,
  ) {}

  async run<T>(
    module: string,
    operation: string,
    action: () => Promise<T>,
  ): Promise<Result<T>> {
    try {
      return { ok: true, value: await action() }
    } catch (cause: unknown) {
      const failure =
        cause instanceof Failure
          ? cause
          : new Failure(
              "UNEXPECTED",
              "Não foi possível concluir a operação. Tente novamente.",
            )

      let diagnosticId = "diagnostic-unavailable"
      try {
        diagnosticId = this.ids.next()
      } catch {
        // A missing entropy source must not break the error boundary itself.
      }

      // No payload, arbitrary exception messages, customer information or stack frames are logged.

      try {
        this.logger.record({
          diagnosticId,
          timestamp: new Date().toISOString(),
          module,
          operation,

          code: failure.code,

          cause:
            failure.technicalCause ??
            (cause instanceof Failure
              ? "controlled_failure"
              : cause instanceof TypeError
                ? "TypeError"
                : cause instanceof RangeError
                  ? "RangeError"
                  : "unexpected_exception"),

          invalidFields: Object.keys(failure.fields).filter((field) =>
            [
              "name",
              "price",
              "categoryId",
              "categoryName",
              "description",
              "imageUrl",
              "logoUrl",
              "coverUrl",
              "phone",
              "whatsapp",
              "address",
              "notes",
              "note",
              "cashChange",
              "payment",
              "minOrder",
              "deliveryFee",
              "eta",
            ].includes(field),
          ),
        })
      } catch {
        /* A broken diagnostic sink must never turn a failed operation into success. */
      }

      return {
        ok: false,
        error: {
          code: failure.code,
          message: failure.message,
          fields: failure.fields,
          diagnosticId,
        },
      }
    }
  }
}
