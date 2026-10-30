import type { Result, ProfileView, ProfileInput } from "@cardapio/contracts"
export interface ProfileService {
  read(): Promise<Result<ProfileView>>
  update(input: ProfileInput): Promise<Result<ProfileView>>
}
