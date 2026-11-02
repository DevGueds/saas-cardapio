import { can } from "@cardapio/domain/permissions"
import {
  ArrowUpRight,
  BarChart3,
  Bike,
  BookOpen,
  CalendarClock,
  Layers,
  Palette,
  Printer,
  Radio,
  Settings,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Store,
  TicketPercent,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { Link, NavLink } from "react-router"
import { useAccount } from "../../modules/identity/presentation/AccountContext"
import AccountActions from "../../modules/identity/presentation/AccountActions"
import Brand from "../../shared/presentation/Brand"
import ImageWithFallback from "../../shared/presentation/ImageWithFallback"
import { useMenu } from "./MenuScope"
import { useServices } from "./ServicesProvider"

interface NavigationItem {
  path: string
  label: string
  icon: LucideIcon
  permission?: Parameters<typeof can>[1]
  apiOnly?: boolean
}
const groups: { label: string; items: NavigationItem[] }[] = [
  {
    label: "Visão geral",
    items: [
      {
        path: "analytics",
        label: "Dashboard",
        icon: BarChart3,
        permission: "reports:read",
      },
      { path: "orders", label: "Pedidos", icon: ShoppingBag },
    ],
  },
  {
    label: "Seu cardápio",
    items: [
      { path: "menu", label: "Gestão do Cardápio", icon: BookOpen },
      {
        path: "addons",
        label: "Adicionais e extras",
        icon: Layers,
        permission: "catalog:write",
      },
      {
        path: "offers",
        label: "Combos e promoções",
        icon: TicketPercent,
        permission: "catalog:write",
      },
      {
        path: "appearance",
        label: "Aparência e QR Code",
        icon: Palette,
        permission: "catalog:write",
      },
      {
        path: "sharing",
        label: "Compartilhar cardápio",
        icon: Share2,
        permission: "catalog:write",
      },
    ],
  },
  {
    label: "Operação",
    items: [
      {
        path: "hours",
        label: "Horários da loja",
        icon: CalendarClock,
        permission: "catalog:write",
      },
      {
        path: "delivery",
        label: "Entregas e retirada",
        icon: Bike,
        permission: "catalog:write",
      },
      {
        path: "channels",
        label: "Painel ao vivo e mensagens",
        icon: Radio,
        permission: "catalog:write",
        apiOnly: true,
      },
      {
        path: "finance",
        label: "Caixa e relatórios",
        icon: Wallet,
        permission: "payments:read",
        apiOnly: true,
      },
      {
        path: "printing",
        label: "Impressão e comprovantes",
        icon: Printer,
        permission: "printing:configure",
        apiOnly: true,
      },
    ],
  },
  {
    label: "Sua loja",
    items: [
      { path: "settings", label: "Configurações", icon: Settings },
      {
        path: "team",
        label: "Equipe e permissões",
        icon: Users,
        permission: "members:write",
        apiOnly: true,
      },
      {
        path: "security",
        label: "Segurança da equipe",
        icon: ShieldCheck,
        permission: "security:write",
        apiOnly: true,
      },
    ],
  },
]
export default function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const account = useAccount(),
    { menu } = useMenu(),
    { mode } = useServices()
  const api = mode === "api",
    query = api ? `?restaurant=${menu.restaurant.id}` : ""
  return (
    <div className="admin-navigation">
      <div className="admin-brand">
        <Brand tagline />
      </div>
      <div className="restaurant-switcher">
        <ImageWithFallback src={menu.restaurant.logoUrl} alt="" />
        <div>
          <small>Sua loja</small>
          <strong>{menu.restaurant.name}</strong>
        </div>
        <span
          className={`restaurant-status-dot ${menu.restaurant.isOpen ? "is-open" : ""}`}
          aria-label={menu.restaurant.isOpen ? "Loja aberta" : "Loja fechada"}
        />
      </div>
      <nav className="admin-nav" aria-label="Navegação principal">
        {groups.map((group) => {
          const items = group.items.filter(
            (item) =>
              (!item.apiOnly || api) &&
              (!item.permission ||
                !api ||
                can(account?.restaurant.role, item.permission)),
          )
          if (!items.length) return null
          return (
            <div className="admin-nav-group" key={group.label}>
              <p className="nav-section-label">{group.label}</p>
              {items.map(({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={`/admin/${path}${query}`}
                  onClick={onNavigate}
                  className={({ isActive }) => (isActive ? "is-active" : "")}
                >
                  <Icon size={19} aria-hidden="true" />
                  <span>
                    {path === "orders" && !api
                      ? "Pedidos demonstrativos"
                      : path === "finance" &&
                          !can(account?.restaurant.role, "reports:read")
                        ? "Recebimentos"
                        : label}
                  </span>
                  {path === "menu" && <small>{menu.products.length}</small>}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>
      <div className="sidebar-preview">
        <Store size={23} aria-hidden="true" />
        <strong>Seu cardápio está aqui</strong>
        <p>Veja a experiência dos seus clientes.</p>
        <Link
          to={`/menu/${menu.restaurant.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNavigate}
        >
          Cardápio dos Clientes <ArrowUpRight size={17} aria-hidden="true" />
          <span className="sr-only"> (abre em nova aba)</span>
        </Link>
      </div>
      {api && <AccountActions />}
      <div className="admin-plan">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <strong>{api ? "Loja conectada" : "Modo demonstração"}</strong>
          <small>
            {api ? "Dados salvos na sua conta" : "Dados apenas neste navegador"}
          </small>
        </div>
      </div>
    </div>
  )
}
