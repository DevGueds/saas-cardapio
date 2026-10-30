import type { CanActivate, ExecutionContext } from "@nestjs/common"
import { SetMetadata } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import type { FastifyRequest } from "fastify"
import { Failure } from "@cardapio/domain/failure"
import { PUBLIC } from "../../../shared/presentation/http.js"
import type { SecretTokens } from "../../../shared/application/ports.js"
import type {
  Authentication,
  AuthenticatedSession,
} from "../application/authentication.js"
export type SessionRequest = FastifyRequest & { session?: AuthenticatedSession }
const MFA_ALLOWED = Symbol("mfa-allowed")
const EMAIL_ALLOWED = Symbol("email-allowed")
export const EmailAllowed = () => SetMetadata(EMAIL_ALLOWED, true)
export const MfaAllowed = () => SetMetadata(MFA_ALLOWED, true)
export function authenticated(request: SessionRequest) {
  if (!request.session)
    throw new Failure("UNAUTHENTICATED", "Entre na sua conta para continuar.")
  return request.session
}
export class SessionGuard implements CanActivate {
  private readonly reflector = new Reflector()
  constructor(
    private readonly auth: Authentication,
    private readonly secrets: SecretTokens,
    private readonly cookieName: string,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    )
      return true
    const request = context.switchToHttp().getRequest<SessionRequest>()
    request.session = await this.auth.authenticate(request.cookies[this.cookieName])
    if (
      ["ENROLL", "VERIFY"].includes(request.session.view.mfa ?? "") &&
      !this.reflector.getAllAndOverride<boolean>(MFA_ALLOWED, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      throw new Failure(
        "MFA_REQUIRED",
        "Confirme a verificação em duas etapas para continuar.",
      )
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const csrf = request.headers["x-csrf-token"]
      if (
        typeof csrf !== "string" ||
        !/^[a-f0-9]{64}$/.test(csrf) ||
        !this.secrets.equalHash(csrf, request.session.csrfHash)
      )
        throw new Failure(
          "CSRF_INVALID",
          "Sua sessão precisa ser atualizada. Recarregue a página antes de tentar novamente.",
        )
    }
    if (
      request.session.view.emailVerification?.required &&
      !this.reflector.getAllAndOverride<boolean>(EMAIL_ALLOWED, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      throw new Failure(
        "EMAIL_VERIFICATION_REQUIRED",
        "Confirme seu e-mail para continuar usando sua conta.",
      )
    return true
  }
}
