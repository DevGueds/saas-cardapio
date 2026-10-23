import type {
  MfaOverride,
  MfaSetup,
  MfaStatus,
  Result,
  SecurityPolicy,
  SessionView,
} from "@cardapio/contracts"
export interface SecurityService {
  status(): Promise<Result<MfaStatus>>
  setup(currentPassword: string): Promise<Result<MfaSetup>>
  verify(code: string): Promise<Result<{ session: SessionView; recoveryCodes: string[] }>>
  disable(currentPassword: string, code: string): Promise<Result<null>>
  policy(tenantId: string): Promise<Result<SecurityPolicy>>
  changePolicy(
    tenantId: string,
    required: boolean,
    currentPassword: string,
  ): Promise<Result<null>>
  changeMember(
    tenantId: string,
    userId: string,
    override: MfaOverride,
    currentPassword: string,
  ): Promise<Result<null>>
}
