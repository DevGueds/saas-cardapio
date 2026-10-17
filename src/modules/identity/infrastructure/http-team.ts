import { z } from "zod"
import { teamMemberSchema } from "@cardapio/contracts"
import type { ApiClient } from "../../../shared/infrastructure/api-client"
import type { TeamService } from "../application/team"
export class HttpTeam implements TeamService {
  constructor(private readonly client: ApiClient) {}
  list(tenantId: string) {
    return this.client.request(
      `/tenants/${encodeURIComponent(tenantId)}/members`,
      z.array(teamMemberSchema),
    )
  }
  save(...[tenantId, email, role]: Parameters<TeamService["save"]>) {
    return this.client.request(
      `/tenants/${encodeURIComponent(tenantId)}/members`,
      z.null(),
      { method: "POST", body: { email, role } },
    )
  }
  remove(tenantId: string, userId: string) {
    return this.client.request(
      `/tenants/${encodeURIComponent(tenantId)}/members/${encodeURIComponent(userId)}`,
      z.null(),
      { method: "DELETE" },
    )
  }
}
