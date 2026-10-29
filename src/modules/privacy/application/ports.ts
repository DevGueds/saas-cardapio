import type {
  LegalAcceptance,
  PrivacyExport,
  PrivacyProfile,
  PrivacyRequest,
  Result,
  privacyRequestInputSchema,
} from "@cardapio/contracts"
import type { z } from "zod"
export interface PrivacyService {
  profile(): Promise<Result<PrivacyProfile>>
  export(input: { currentPassword: string }): Promise<Result<PrivacyExport>>
  accept(input: LegalAcceptance): Promise<Result<null>>
  request(
    input: z.infer<typeof privacyRequestInputSchema>,
  ): Promise<Result<PrivacyRequest>>
}
