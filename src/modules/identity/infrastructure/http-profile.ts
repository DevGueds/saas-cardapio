import { profileSchema, type ProfileInput } from "@cardapio/contracts"
import type { ApiClient } from "../../../shared/infrastructure/api-client"
import type { ProfileService } from "../application/profile"
export class HttpProfile implements ProfileService {
  constructor(private readonly client: ApiClient) {}
  read() {
    return this.client.request("/me/profile", profileSchema)
  }
  update(input: ProfileInput) {
    return this.client.request("/me/profile", profileSchema, {
      method: "PUT",
      body: input,
    })
  }
}
