import { can } from "@cardapio/domain/permissions"
import { useAccount } from "../../modules/identity/presentation/AccountContext"
import {
  PackagePlus,
  Bike,
  Users,
  Layers,
  Palette,
  Radio,
  Printer,
  CalendarClock,
} from "lucide-react"
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
} from "lucide-react"
import ImageWithFallback from "../../shared/presentation/ImageWithFallback"
import Brand from "../../shared/presentation/Brand"
import { useMenu } from "./MenuScope"

export default function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const account = useAccount()
  const { menu } = useMenu()
  const { mode } = useServices()
  const api = mode === "api"
  const query = api ? `?restaurant=${menu.restaurant.id}` : ""
  const { restaurant } = menu
  return (
    <div className="admin-navigation">
      <div className="admin-brand">
        <Brand inverse tagline />
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
        {(!api || can(account?.restaurant.role, "reports:read")) && (
          <NavLink
            to={`/admin/analytics${query}`}
            onClick={onNavigate}
            className={({ isActive }) => (isActive ? "is-active" : "")}
          >
            <BarChart3 size={20} aria-hidden="true" />
            <span>Dashboard</span>
          </NavLink>
        )}
        {(!account || can(account.restaurant.role, "catalog:write")) && (
          <NavLink
            to={`/admin/hours${query}`}
            onClick={onNavigate}
            className={({ isActive }) => (isActive ? "is-active" : "")}
          >
            <CalendarClock size={20} aria-hidden="true" />
            <span>Horários da loja</span>
          </NavLink>
        )}
        {api && can(account?.restaurant.role, "printing:configure") && (
          <NavLink
            to={`/admin/printing${query}`}
            onClick={onNavigate}
            className={({ isActive }) => (isActive ? "is-active" : "")}
          >
            <Printer size={20} aria-hidden="true" />
            <span>Impressão e comprovantes</span>
          </NavLink>
        )}
        {api && can(account?.restaurant.role, "security:write") && (
          <NavLink
            to={`/admin/security${query}`}
            onClick={onNavigate}
            className={({ isActive }) => (isActive ? "is-active" : "")}
          >
            <Settings size={20} aria-hidden="true" />
            <span>Segurança da equipe</span>
          </NavLink>
        )}
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
        {(!account || can(account.restaurant.role, "catalog:write")) && (
          <>
            {api && (
              <NavLink
                to={`/admin/channels${query}`}
                onClick={onNavigate}
                className={({ isActive }) => (isActive ? "is-active" : "")}
              >
                <Radio size={20} />
                <span>Painel ao vivo e mensagens</span>
              </NavLink>
            )}
            <NavLink
              to={`/admin/addons${query}`}
              onClick={onNavigate}
              className={({ isActive }) => (isActive ? "is-active" : "")}
            >
              <Layers size={20} />
              <span>Adicionais e extras</span>
            </NavLink>
            <NavLink
              to={`/admin/appearance${query}`}
              onClick={onNavigate}
              className={({ isActive }) => (isActive ? "is-active" : "")}
            >
              <Palette size={20} />
              <span>Aparência e QR Code</span>
            </NavLink>
            <NavLink
              to={`/admin/offers${query}`}
              onClick={onNavigate}
              className={({ isActive }) => (isActive ? "is-active" : "")}
            >
              <PackagePlus size={20} />
              <span>Combos e promoções</span>
            </NavLink>
            <NavLink
              to={`/admin/delivery${query}`}
              onClick={onNavigate}
              className={({ isActive }) => (isActive ? "is-active" : "")}
            >
              <Bike size={20} />
              <span>Entregas e retirada</span>
            </NavLink>
          </>
        )}
        {can(account?.restaurant.role, "members:write") && (
          <NavLink
            to={`/admin/team${query}`}
            onClick={onNavigate}
            className={({ isActive }) => (isActive ? "is-active" : "")}
          >
            <Users size={20} />
            <span>Equipe e permissões</span>
          </NavLink>
        )}
        {can(account?.restaurant.role, "payments:read") && (
          <NavLink
            to={`/admin/finance${query}`}
            onClick={onNavigate}
            className={({ isActive }) => (isActive ? "is-active" : "")}
          >
            <BarChart3 size={20} aria-hidden="true" />
            <span>
              {can(account?.restaurant.role, "reports:read")
                ? "Caixa e relatórios"
                : "Recebimentos"}
            </span>
          </NavLink>
        )}
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
