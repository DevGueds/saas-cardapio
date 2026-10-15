import { useServices } from "./ServicesProvider"
import AccountActions from "../../modules/identity/presentation/AccountActions"
import { NavLink, Link } from "react-router"
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  ChefHat,
  LayoutDashboard,
  Settings,
  Store,
  UtensilsCrossed,
} from "lucide-react"
import ImageWithFallback from "../../shared/presentation/ImageWithFallback"
import { useMenu } from "./MenuScope"

export default function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { menu } = useMenu()
  const { mode } = useServices()
  const api = mode === "api"
  const query = api ? `?restaurant=${menu.restaurant.id}` : ""
  const { restaurant } = menu
  return (
    <div className="admin-navigation">
      <div className="admin-brand">
        <span>
          <UtensilsCrossed size={24} aria-hidden="true" />
        </span>
        <div>
          <strong>Cardápio</strong>
          <small>Seu restaurante, conectado.</small>
        </div>
      </div>
      <div className="restaurant-switcher">
        <ImageWithFallback src={restaurant.logoUrl} alt="" />
        <div>
          <small>Sua loja</small>
          <strong>{restaurant.name}</strong>
        </div>
      </div>
      <p className="nav-section-label">Gerenciar</p>
      <nav className="admin-nav" aria-label="Navegação principal">
        <NavLink
          to={`/admin/menu${query}`}
          onClick={onNavigate}
          className={({ isActive }) => (isActive ? "is-active" : "")}
        >
          <BookOpen size={20} aria-hidden="true" />
          <span>Gestão do Cardápio</span>
          <small>{menu.products.length}</small>
        </NavLink>
        <NavLink
          to={`/admin/orders${query}`}
          onClick={onNavigate}
          className={({ isActive }) => (isActive ? "is-active" : "")}
        >
          <LayoutDashboard size={20} aria-hidden="true" />
          <span>{api ? "Pedidos" : "Pedidos demonstrativos"}</span>
        </NavLink>
        <NavLink
          to={`/admin/settings${query}`}
          onClick={onNavigate}
          className={({ isActive }) => (isActive ? "is-active" : "")}
        >
          <Settings size={20} aria-hidden="true" />
          <span>Configurações</span>
        </NavLink>
        <button type="button" disabled>
          <BarChart3 size={20} aria-hidden="true" />
          <span>
            Faturamento <small>Em breve</small>
          </span>
        </button>
      </nav>
      <div className="sidebar-preview">
        <Store size={23} aria-hidden="true" />
        <strong>Veja como ficou</strong>
        <p>Confira a experiência de quem vai pedir na sua loja.</p>
        <Link
          to={`/menu/${restaurant.slug}`}
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
        <ChefHat size={20} aria-hidden="true" />
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
