import type { Role, Result } from "@cardapio/contracts"
export interface TeamMember {
  userId: string
  name: string
  role: Role
}
export interface TeamService {
  list(tenantId: string): Promise<Result<TeamMember[]>>
  save(
    tenantId: string,
    email: string,
    role: Exclude<Role, "OWNER">,
  ): Promise<Result<null>>
  remove(tenantId: string, userId: string): Promise<Result<null>>
}
