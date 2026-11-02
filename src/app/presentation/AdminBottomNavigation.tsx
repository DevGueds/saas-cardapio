import { BarChart3, BookOpen, LayoutGrid, ShoppingBag } from "lucide-react"
import { NavLink } from "react-router"
import { can } from "@cardapio/domain/permissions"
import { useAccount } from "../../modules/identity/presentation/AccountContext"
import { useMenu } from "./MenuScope"
import { useServices } from "./ServicesProvider"

export default function AdminBottomNavigation({
  onMore,
  expanded,
}: {
  onMore(): void
  expanded: boolean
}) {
  const { menu } = useMenu(),
    { mode } = useServices(),
    account = useAccount()
  const query = mode === "api" ? `?restaurant=${menu.restaurant.id}` : ""
  const reports = mode !== "api" || can(account?.restaurant.role, "reports:read")
  return (
    <nav className="admin-bottom-nav" aria-label="Atalhos da loja">
      {reports && (
        <NavLink to={`/admin/analytics${query}`}>
          <BarChart3 size={21} aria-hidden="true" />
          <span>Dashboard</span>
        </NavLink>
      )}
      <NavLink to={`/admin/menu${query}`}>
        <BookOpen size={21} aria-hidden="true" />
        <span>Cardápio</span>
      </NavLink>
      <NavLink to={`/admin/orders${query}`}>
        <ShoppingBag size={21} aria-hidden="true" />
        <span>Pedidos</span>
      </NavLink>
      <button
        type="button"
        onClick={onMore}
        aria-expanded={expanded}
        aria-label="Mais opções da loja"
      >
        <LayoutGrid size={21} aria-hidden="true" />
        <span>Mais</span>
      </button>
    </nav>
  )
}
