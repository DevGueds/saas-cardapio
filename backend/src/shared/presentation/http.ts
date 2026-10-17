import type { AppError, Result } from "@cardapio/contracts"
import { Failure, type ErrorCode } from "@cardapio/domain/failure"
import {
  Catch,
  HttpException,
  SetMetadata,
  type ArgumentsHost,
  type CallHandler,
  type ExceptionFilter,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common"
import type { FastifyReply } from "fastify"
import { map } from "rxjs"
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
  CSRF_INVALID: 403,
  RATE_LIMITED: 429,
  ACCOUNT_UNAVAILABLE: 409,
}

export function errorStatus(error: AppError) {
  return statusByCode[error.code] ?? 500
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

    // 1. Tratar exceções padrão do NestJS / HTTP
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

    // 2. Tratar erros de parsing / payload do Fastify
    if (
      typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      typeof cause.code === "string" &&
      cause.code.startsWith("FST_ERR_")
    ) {
      failure = new Failure(
        "VALIDATION",
        "Corpo da requisição inválido ou maior que o limite permitido.",
      )
    }

    // 3. Tratar erros conhecidos do Prisma / PostgreSQL
    if (
      typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      typeof cause.code === "string" &&
      cause.code.startsWith("P")
    ) {
      switch (cause.code) {
        case "P2002": // Unique constraint failure
          failure = new Failure("CONFLICT", "Este registro já existe na base de dados.")
          break
        case "P2025": // Record not found
          failure = new Failure("NOT_FOUND", "O registro solicitado não foi encontrado.")
          break
        case "P2003": // Foreign key constraint failed
          failure = new Failure("VALIDATION", "Registro relacionado inválido ou inexistente.")
          break
        default:
          failure = new Failure("STORAGE_UNAVAILABLE", "Serviço de banco de dados temporariamente indisponível.")
          break
      }
    }

    const error = this.operation.error("http.request", failure)

    host
      .switchToHttp()
      .getResponse<FastifyReply>()
      .status(errorStatus(error))
      .send({ ok: false, error })
  }
}