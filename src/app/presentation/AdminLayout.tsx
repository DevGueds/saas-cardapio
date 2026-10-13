import { useState } from "react"

import { NavLink, Outlet, Link } from "react-router"

import {
  BarChart3,
  Bell,
  ChefHat,
  LayoutDashboard,
  Menu,
  Settings,
  ShoppingBag,
  Store,
  UtensilsCrossed,
  VolumeX,
  X,
} from "lucide-react"

import { useMutation } from "../../shared/presentation/use-mutation"

import ErrorNotice from "../../shared/presentation/ErrorNotice"

import { useMenu } from "./MenuScope"

import { useServices } from "./ServicesProvider"

export default function AdminLayout() {
  const { menu, error: loadError, loading, reload } = useMenu()

  const services = useServices()

  const mutation = useMutation()

  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { restaurant } = menu

  const close = () => setSidebarOpen(false)

  async function toggleStore() {
    if (mutation.pending || loading || loadError) return

    await mutation.run(() =>
      services.restaurant.setOpen(restaurant.id, menu.revision, !restaurant.isOpen),
    )
  }

  return (
    <div className="admin-shell">
      <button
        className={`admin-sidebar-backdrop ${sidebarOpen ? "is-visible" : ""}`}
        tabIndex={sidebarOpen ? 0 : -1}
        type="button"
        aria-label="Fechar navegação"
        onClick={close}
      />
      <aside
        className={`admin-sidebar ${sidebarOpen ? "is-open" : ""}`}
        aria-label="Painel administrativo"
      >
        <div className="admin-brand">
          <span>
            <UtensilsCrossed size={21} />
          </span>
          <div>
            <strong>Cardápio</strong>
            <small>WhatsApp</small>
          </div>
          <button type="button" aria-label="Fechar menu" onClick={close}>
            <X size={19} />
          </button>
        </div>
        <div className="restaurant-switcher">
          {restaurant.logoUrl ? (
            <img src={restaurant.logoUrl} alt="" />
          ) : (
            <Store size={32} />
          )}
          <div>
            <small>Restaurante demonstrativo</small>
            <strong>{restaurant.name}</strong>
          </div>
        </div>
        <nav className="admin-nav" aria-label="Navegação principal">
          <NavLink
            to="/admin/menu"
            onClick={close}
            className={({ isActive }) => (isActive ? "is-active" : "")}
          >
            <ShoppingBag size={19} />
            <span>Gestão do Cardápio</span>
            <small>{menu.products.length} itens</small>
          </NavLink>
          <NavLink
            to="/admin/orders"
            onClick={close}
            className={({ isActive }) => (isActive ? "is-active" : "")}
          >
            <LayoutDashboard size={19} />
            <span>Pedidos demonstrativos</span>
          </NavLink>
          <Link to={`/menu/${restaurant.slug}`} target="_blank" rel="noopener noreferrer">
            <Store size={19} />
            <span>Cardápio dos Clientes</span>
          </Link>
          <button type="button" disabled>
            <BarChart3 size={19} />
            <span>Faturamento · em breve</span>
          </button>
          <NavLink
            to="/admin/settings"
            onClick={close}
            className={({ isActive }) => (isActive ? "is-active" : "")}
          >
            <Settings size={19} />
            <span>Configurações</span>
          </NavLink>
        </nav>
        <div className="admin-plan">
          <ChefHat size={19} />
          <div>
            <strong>Modo demonstração</strong>
            <small>Dados apenas neste navegador</small>
          </div>
        </div>
        <div className="admin-profile">
          <span>D</span>
          <div>
            <strong>Visitante da demonstração</strong>
            <small>Acesso local</small>
          </div>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="admin-mobile-title">
            <button
              type="button"
              aria-label="Abrir menu"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={21} />
            </button>
            <strong>{restaurant.name}</strong>
          </div>
          <div className="admin-topbar__status">
            <div className="live-indicator">
              <span />
              Demonstração local
            </div>
            <button
              type="button"
              className="sound-control"
              disabled
              title="Indisponível nesta etapa"
            >
              <VolumeX size={18} />
              <span>Som indisponível</span>
            </button>
            <button
              type="button"
              className="notification-button"
              disabled
              aria-label="Notificações indisponíveis"
            >
              <Bell size={19} />
            </button>
            <div className="store-control">
              <div>
                <small>Status da loja</small>
                <strong>{restaurant.isOpen ? "Loja aberta" : "Loja fechada"}</strong>
              </div>
              <button
                className={`toggle ${restaurant.isOpen ? "is-on" : ""}`}
                type="button"
                role="switch"
                aria-label="Loja aberta"
                aria-checked={restaurant.isOpen}
                disabled={loading || !!loadError || mutation.pending}
                onClick={() => void toggleStore()}
              >
                <span />
              </button>
            </div>
          </div>
        </header>
        <main className="admin-main">
          {mutation.error && (
            <ErrorNotice error={mutation.error} onRetry={() => void reload()} />
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
