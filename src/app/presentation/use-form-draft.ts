import { useDraft } from "../../shared/presentation/DraftsProvider"
import { useAccount } from "../../modules/identity/presentation/AccountContext"
import { useServices } from "./ServicesProvider"
import { useMenu } from "./MenuScope"
export function useFormDraft<T>(form: string, initial: T, parse: (value: unknown) => T) {
  const { menu } = useMenu(),
    account = useAccount(),
    { mode } = useServices()
  return useDraft(
    `${mode ?? "demo"}:admin:${account?.session.user.id ?? "demo"}:${menu.restaurant.id}:${form}`,
    initial,
    parse,
  )
}
