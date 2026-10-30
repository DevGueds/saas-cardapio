import type {
  Result,
  SessionView,
  RestaurantAccess,
  LegalAcceptance,
  EmailVerificationView,
} from "@cardapio/contracts"
export interface IdentityService {
  configuration(): Promise<
    Result<{
      signupEnabled: boolean
      emailSendEnabled?: boolean
      turnstileSiteKey?: string
      emailVerificationGraceSeconds?: number
    }>
  >
  session(): Promise<Result<SessionView>>
  login(input: {
    email: string
    password: string
    turnstileToken?: string
  }): Promise<Result<SessionView>>
  register(input: {
    accountOnly?: boolean
    name: string
    email: string
    password: string
    restaurantName: string
    slug: string
    legalAcceptance: LegalAcceptance
    turnstileToken?: string
  }): Promise<Result<SessionView>>
  logout(): Promise<Result<null>>
  emailStatus(): Promise<Result<EmailVerificationView>>
  sendEmailCode(): Promise<Result<{ sent: boolean; retryAt: string }>>
  confirmEmail(code: string): Promise<Result<null>>
  changePassword(input: {
    currentPassword: string
    newPassword: string
  }): Promise<Result<null>>
  restaurants(): Promise<Result<RestaurantAccess[]>>
  createTenant(input: {
    name: string
    restaurantName: string
    slug: string
  }): Promise<Result<{ tenantId: string; restaurantId: string }>>
  subscribeExpired(
    listener: (
      reason?: "UNAUTHENTICATED" | "MFA_REQUIRED" | "EMAIL_VERIFICATION_REQUIRED",
    ) => void,
  ): () => void
}
