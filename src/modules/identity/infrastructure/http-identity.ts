import type { DraftManager } from "../../../shared/application/drafts"
import { z } from "zod"
import { restaurantAccessSchema, sessionSchema, uuid } from "@cardapio/contracts"
import { emailVerificationSchema, emailDeliverySchema } from "@cardapio/contracts"
import type { ApiClient } from "../../../shared/infrastructure/api-client"
import type { IdentityService } from "../application/ports"
export class HttpIdentity implements IdentityService {
  constructor(
    private readonly client: ApiClient,
    private readonly drafts?: DraftManager,
  ) {}
  private async establish(path: string, body?: unknown) {
    const result = await this.client.request(
      path,
      sessionSchema,
      body ? { method: "POST", body } : {},
    )
    if (result.ok) this.client.setCsrf(result.value.csrfToken)
    return result
  }
  configuration() {
    return this.client.request(
      "/configuration",
      z.strictObject({
        signupEnabled: z.boolean(),
        mapTileUrl: z.string().optional(),
        turnstileSiteKey: z.string().optional(),
        emailVerificationGraceSeconds: z.number().int().positive().optional(),
      }),
    )
  }
  session() {
    return this.establish("/auth/session")
  }
  login(input: Parameters<IdentityService["login"]>[0]) {
    return this.establish("/auth/login", input)
  }
  register(input: Parameters<IdentityService["register"]>[0]) {
    const { accountOnly, ...data } = input
    return this.establish(
      accountOnly ? "/auth/register-account" : "/auth/register",
      accountOnly
        ? {
            name: data.name,
            email: data.email,
            password: data.password,
            legalAcceptance: data.legalAcceptance,
            turnstileToken: data.turnstileToken,
          }
        : data,
    )
  }
  async logout() {
    const result = await this.client.request("/auth/logout", z.null(), { method: "POST" })
    if (result.ok) {
      this.client.setCsrf("")
      this.drafts?.clearPrefix("api:admin:")
    }
    return result
  }
  emailStatus() {
    return this.client.request("/auth/email", emailVerificationSchema)
  }
  sendEmailCode() {
    return this.client.request("/auth/email/send", emailDeliverySchema, {
      method: "POST",
    })
  }
  confirmEmail(code: string) {
    return this.client.request("/auth/email/confirm", z.null(), {
      method: "POST",
      body: { code },
    })
  }
  async changePassword(input: Parameters<IdentityService["changePassword"]>[0]) {
    const result = await this.client.request("/auth/password", z.null(), {
      method: "PUT",
      body: input,
    })
    if (result.ok) {
      this.client.setCsrf("")
      this.drafts?.clearPrefix("api:admin:")
    }
    return result
  }
  restaurants() {
    return this.client.request("/me/restaurants", z.array(restaurantAccessSchema))
  }
  createTenant(input: Parameters<IdentityService["createTenant"]>[0]) {
    return this.client.request(
      "/tenants",
      z.strictObject({ tenantId: uuid, restaurantId: uuid }),
      { method: "POST", body: input },
    )
  }
  subscribeExpired(
    listener: (
      reason?: "UNAUTHENTICATED" | "MFA_REQUIRED" | "EMAIL_VERIFICATION_REQUIRED",
    ) => void,
  ) {
    return this.client.subscribeExpired(listener)
  }
}
