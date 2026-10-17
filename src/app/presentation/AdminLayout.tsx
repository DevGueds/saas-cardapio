import { can } from "@cardapio/domain/permissions"
import { useAccount } from "../../modules/identity/presentation/AccountContext"
import { useEffect, useRef, useState } from "react"
import { Outlet, useLocation } from "react-router"
import { Bell, Menu, VolumeX } from "lucide-react"
import { useMutation } from "../../shared/presentation/use-mutation"
import ErrorNotice from "../../shared/presentation/ErrorNotice"
import Dialog from "../../shared/presentation/Dialog"
import { useMenu } from "./MenuScope"
import { useServices } from "./ServicesProvider"
import AdminNavigation from "./AdminNavigation"

export default function AdminLayout() {
  const { menu, error: loadError, loading, reload } = useMenu()
  const services = useServices()
  const account = useAccount()
  const canManage = !account || can(account.restaurant.role, "catalog:write")
  const mutation = useMutation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const main = useRef<HTMLElement>(null)
  const location = useLocation()
  const { restaurant } = menu
  const section = location.pathname.endsWith("offers")
    ? "Combos e promoções"
    : location.pathname.endsWith("delivery")
      ? "Entregas e retirada"
      : location.pathname.endsWith("team")
        ? "Equipe e permissões"
        : location.pathname.endsWith("settings")
          ? "Configurações"
          : location.pathname.endsWith("orders")
            ? services.mode === "api"
              ? "Pedidos"
              : "Pedidos demonstrativos"
            : "Cardápio"

  useEffect(() => {
    document.title = `${section} · ${restaurant.name}`
  }, [section, restaurant.name])

  async function toggleStore() {
    if (mutation.pending || loading || loadError) return
    await mutation.run(() =>
      services.restaurant.setOpen(restaurant.id, menu.revision, !restaurant.isOpen),
    )
  }

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#admin-content">
        Pular para o conteúdo
      </a>
      <aside className="admin-sidebar" aria-label="Painel administrativo">
        <AdminNavigation />
      </aside>
      {sidebarOpen && (
        <Dialog
          title="Navegação da loja"
          className="navigation-dialog"
          onClose={() => setSidebarOpen(false)}
        >
          <AdminNavigation onNavigate={() => setSidebarOpen(false)} />
        </Dialog>
      )}
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="admin-mobile-title">
            <button
              className="icon-button"
              type="button"
              aria-label="Abrir menu"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={22} />
            </button>
          </div>
          <div className="admin-breadcrumb">
            <span>Painel da loja</span>
            <span aria-hidden="true">/</span>
            <strong>{section}</strong>
          </div>
          <div className="admin-topbar__status">
            <div className="future-controls">
              <button type="button" disabled aria-label="Som indisponível">
                <VolumeX size={18} aria-hidden="true" />
              </button>
              <button type="button" disabled aria-label="Notificações indisponíveis">
                <Bell size={18} aria-hidden="true" />
              </button>
              <span>Em breve</span>
            </div>
            <div className="store-control">
              <div>
                <strong>{restaurant.isOpen ? "Loja aberta" : "Loja fechada"}</strong>
                <small>
                  {mutation.pending
                    ? "Atualizando…"
                    : restaurant.isOpen
                      ? "Recebendo pedidos"
                      : "Pedidos pausados"}
                </small>
              </div>
              <button
                className={`toggle ${restaurant.isOpen ? "is-on" : ""}`}
                type="button"
                role="switch"
                aria-label="Loja aberta"
                aria-checked={restaurant.isOpen}
                disabled={loading || !!loadError || mutation.pending || !canManage}
                onClick={() => void toggleStore()}
              >
                <span />
              </button>
            </div>
          </div>
        </header>
        <main className="admin-main" id="admin-content" ref={main} tabIndex={-1}>
          {mutation.error && (
            <ErrorNotice error={mutation.error} onRetry={() => void reload()} />
          )}
          <Outlet />
        </main>
        <footer className="admin-footer">
          <span>Feito para simplificar o dia a dia da sua loja.</span>
          <span>
            {services.mode === "api" ? "Sua loja conectada" : "Demonstração local"}
          </span>
        </footer>
      </div>
    </div>
  )
}
