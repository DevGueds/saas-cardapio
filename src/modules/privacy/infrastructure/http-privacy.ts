import { z } from "zod"
import {
  privacyExportSchema,
  privacyProfileSchema,
  privacyRequestSchema,
} from "@cardapio/contracts"
import type { ApiClient } from "../../../shared/infrastructure/api-client"
import type { PrivacyService } from "../application/ports"
export class HttpPrivacy implements PrivacyService {
  constructor(private readonly client: ApiClient) {}
  profile() {
    return this.client.request("/me/privacy", privacyProfileSchema)
  }
  export(input: Parameters<PrivacyService["export"]>[0]) {
    return this.client.request("/me/privacy/export", privacyExportSchema, {
      method: "POST",
      body: input,
    })
  }
  accept(input: Parameters<PrivacyService["accept"]>[0]) {
    return this.client.request("/me/privacy/acceptance", z.null(), {
      method: "POST",
      body: input,
    })
  }
  request(input: Parameters<PrivacyService["request"]>[0]) {
    return this.client.request("/me/privacy/requests", privacyRequestSchema, {
      method: "POST",
      body: input,
    })
  }
}
