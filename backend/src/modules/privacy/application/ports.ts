import type {
  LegalAcceptance,
  PrivacyExport,
  PrivacyProfile,
  PrivacyRequest,
  privacyRequestInputSchema,
} from "@cardapio/contracts"
import type { z } from "zod"

export interface PrivacyRepository {
  profile(userId: string): Promise<PrivacyProfile>
  export(userId: string, generatedAt: Date): Promise<PrivacyExport>
  accept(userId: string, input: LegalAcceptance, id: string, at: Date): Promise<void>
  request(
    userId: string,
    input: z.infer<typeof privacyRequestInputSchema>,
    id: string,
    at: Date,
  ): Promise<PrivacyRequest>
}
