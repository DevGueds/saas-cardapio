import { z } from "zod"
import {
  mfaSetupSchema,
  mfaStatusSchema,
  securityPolicySchema,
  sessionSchema,
} from "@cardapio/contracts"
import type { ApiClient } from "../../../shared/infrastructure/api-client"
import type { SecurityService } from "../application/security"
export class HttpSecurity implements SecurityService {
  constructor(private readonly client: ApiClient) {}
  status() {
    return this.client.request("/auth/mfa", mfaStatusSchema)
  }
  setup(currentPassword: string) {
    return this.client.request("/auth/mfa/setup", mfaSetupSchema, {
      method: "POST",
      body: { currentPassword },
    })
  }
  async verify(code: string) {
    const result = await this.client.request(
      "/auth/mfa/verify",
      z.strictObject({
        session: sessionSchema,
        recoveryCodes: z.array(z.string().regex(/^[a-f0-9]{24}$/)).max(10),
      }),
      { method: "POST", body: { code } },
    )
    if (result.ok) this.client.setCsrf(result.value.session.csrfToken)
    return result
  }
  async disable(currentPassword: string, code: string) {
    const result = await this.client.request("/auth/mfa", z.null(), {
      method: "DELETE",
      body: { currentPassword, code },
    })
    if (result.ok) this.client.setCsrf("")
    return result
  }
  policy(tenantId: string) {
    return this.client.request(`/tenants/${tenantId}/security`, securityPolicySchema)
  }
  changePolicy: SecurityService["changePolicy"] = (tenantId, required, currentPassword) =>
    this.client.request(`/tenants/${tenantId}/security`, z.null(), {
      method: "PUT",
      body: { required, currentPassword },
    })
  changeMember: SecurityService["changeMember"] = (
    tenantId,
    userId,
    override,
    currentPassword,
  ) =>
    this.client.request(`/tenants/${tenantId}/security/${userId}`, z.null(), {
      method: "PUT",
      body: { override, currentPassword },
    })
}
