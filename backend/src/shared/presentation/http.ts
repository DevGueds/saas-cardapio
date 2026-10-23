import {
  Catch,
  HttpException,
  SetMetadata,
  type ArgumentsHost,
  type ExceptionFilter,
  type ExecutionContext,
  type NestInterceptor,
  type CallHandler,
} from "@nestjs/common"
import type { FastifyReply } from "fastify"
import { map } from "rxjs"
import { Failure, type ErrorCode } from "@cardapio/domain/failure"
import type { AppError, Result } from "@cardapio/contracts"
import type { Operation } from "../application/operation.js"
export const PUBLIC = Symbol("public-route")
export const Public = () => SetMetadata(PUBLIC, true)
const statusByCode: Record<ErrorCode, number> = {
  VALIDATION: 422,
  NOT_FOUND: 404,
  ACCESS_DENIED: 403,
  CONFIGURATION: 503,
  CONFLICT: 409,
  STORAGE_UNAVAILABLE: 503,
  STORAGE_QUOTA: 503,
  CORRUPT_DATA: 503,
  CAPABILITY_UNAVAILABLE: 503,
  UNEXPECTED: 500,
  UNAUTHENTICATED: 401,
  MFA_REQUIRED: 403,
  CSRF_INVALID: 403,
  RATE_LIMITED: 429,
  ACCOUNT_UNAVAILABLE: 409,
}
export function errorStatus(error: AppError) {
  return statusByCode[error.code]
}
export class ResultInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((result: Result<unknown>) => {
        if (result && !result.ok && result.error)
          context
            .switchToHttp()
            .getResponse<FastifyReply>()
            .status(errorStatus(result.error))
        return result
      }),
    )
  }
}
@Catch()
export class HttpErrors implements ExceptionFilter {
  constructor(private readonly operation: Operation) {}
  catch(cause: unknown, host: ArgumentsHost) {
    let failure = cause
    if (cause instanceof HttpException) {
      const status = cause.getStatus()
      failure =
        status === 404
          ? new Failure("NOT_FOUND", "Rota não encontrada.")
          : new Failure(
              status < 500 ? "VALIDATION" : "UNEXPECTED",
              "Requisição inválida ou indisponível.",
            )
    }
    if (
      typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      typeof cause.code === "string" &&
      cause.code.startsWith("FST_ERR_")
    )
      failure = new Failure(
        "VALIDATION",
        "Corpo da requisição inválido ou maior que o limite permitido.",
      )
    const error = this.operation.error("http.request", failure)
    host
      .switchToHttp()
      .getResponse<FastifyReply>()
      .status(errorStatus(error))
      .send({ ok: false, error })
  }
}
