import { can } from "@cardapio/domain/permissions"
import FeatureBoundary from "../../shared/presentation/FeatureBoundary"
import { useAccount } from "../../modules/identity/presentation/AccountContext"
import { useEffect, useRef, useState } from "react"
import { Outlet, useLocation } from "react-router"
import { Menu } from "lucide-react"
import NotificationBell from "../../modules/engagement/presentation/NotificationBell"
import { useMutation } from "../../shared/presentation/use-mutation"
import ErrorNotice from "../../shared/presentation/ErrorNotice"
import Dialog from "../../shared/presentation/Dialog"
import { useMenu } from "./MenuScope"
import { useServices } from "./ServicesProvider"
import AdminNavigation from "./AdminNavigation"
import LegalLinks from "../../shared/presentation/legal/LegalLinks"

export default function AdminLayout() {
  const { menu, error: loadError, loading, reload } = useMenu()
  const services = useServices()
  const account = useAccount()
  const canManage = !account || can(account.restaurant.role, "catalog:write")
  const mutation = useMutation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [confirmClosing, setConfirmClosing] = useState(false)
  const main = useRef<HTMLElement>(null)
  const location = useLocation()
  const { restaurant } = menu
  const section = location.pathname.endsWith("printing")
    ? "Impressão e comprovantes"
    : location.pathname.endsWith("security")
      ? "Segurança da equipe"
      : location.pathname.endsWith("addons")
        ? "Adicionais"
        : location.pathname.endsWith("appearance")
          ? "Aparência e QR Code"
          : location.pathname.endsWith("channels")
            ? "Painel e notificações"
            : location.pathname.endsWith("finance")
              ? "Caixa e relatórios"
              : location.pathname.endsWith("offers")
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
    document.title = `${section} · ${restaurant.name} · Pede Aqui`
  }, [section, restaurant.name])

  async function toggleStore() {
    if (mutation.pending || loading || loadError) return
    const result = await mutation.run(
      () => services.restaurant.setOpen(restaurant.id, menu.revision, !restaurant.isOpen),
      restaurant.isOpen
        ? "Loja fechada para novos pedidos."
        : "Loja aberta para pedidos.",
    )
    if (result?.ok) setConfirmClosing(false)
  }

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#admin-content">
        Pular para o conteúdo
      </a>
      <aside className="admin-sidebar" aria-label="Painel administrativo">
        <FeatureBoundary label="Navegação">
          <AdminNavigation />
        </FeatureBoundary>
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
            <FeatureBoundary label="Notificações">
              <NotificationBell />
            </FeatureBoundary>
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
                onClick={() => {
                  if (restaurant.isOpen) setConfirmClosing(true)
                  else void toggleStore()
                }}
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
          <FeatureBoundary label={section} resetKeys={[location.pathname, restaurant.id]}>
            <Outlet />
          </FeatureBoundary>
        </main>
        <footer className="admin-footer">
          <span>Pede Aqui · Menos cliques. Mais controle.</span>
          <LegalLinks />
          <span>
            {services.mode === "api" ? "Sua loja conectada" : "Demonstração local"}
          </span>
        </footer>
      </div>
      {confirmClosing && (
        <Dialog
          title="Fechar a loja para novos pedidos?"
          busy={mutation.pending}
          onClose={() => setConfirmClosing(false)}
        >
          <p>
            Novos pedidos ficarão pausados. Continue atendendo os pedidos já recebidos e
            reabra quando estiver pronto.
          </p>
          {mutation.error && <ErrorNotice error={mutation.error} />}
          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={mutation.pending}
              onClick={() => setConfirmClosing(false)}
            >
              Manter loja aberta
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={mutation.pending || loading || !!loadError}
              onClick={() => void toggleStore()}
            >
              Confirmar fechamento
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
