import type { Result, SessionView, RestaurantAccess } from "@cardapio/contracts"
export interface IdentityService {
  configuration(): Promise<Result<{ signupEnabled: boolean }>>
  session(): Promise<Result<SessionView>>
  login(input: { email: string; password: string }): Promise<Result<SessionView>>
  register(input: {
    name: string
    email: string
    password: string
    restaurantName: string
    slug: string
  }): Promise<Result<SessionView>>
  logout(): Promise<Result<null>>
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
  subscribeExpired(listener: () => void): () => void
}
