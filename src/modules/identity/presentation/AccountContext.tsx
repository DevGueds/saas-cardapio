import { createContext, useContext, type ReactNode } from "react"
import type { RestaurantAccess, SessionView } from "@cardapio/contracts"
const Context = createContext<{
  restaurant: RestaurantAccess
  session: SessionView
} | null>(null)
export default function AccountContext({
  value,
  children,
}: {
  value: { restaurant: RestaurantAccess; session: SessionView }
  children: ReactNode
}) {
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useAccount() {
  return useContext(Context)
}
