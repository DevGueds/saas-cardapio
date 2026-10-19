import { useEffect, useState } from "react"
import { Link } from "react-router"
import { Bell } from "lucide-react"
import { toast } from "react-toastify"
import type { AppError, Inbox } from "@cardapio/contracts"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useMenu } from "../../../app/presentation/MenuScope"
import Dialog from "../../../shared/presentation/Dialog"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import { useMutation } from "../../../shared/presentation/use-mutation"
import type { EngagementService } from "../application/ports"
import PushButton from "./PushButton"
function InboxBell({ service, id }: { service: EngagementService; id: string }) {
  const [inbox, setInbox] = useState<Inbox | null>(null),
    [error, setError] = useState<AppError | null>(null),
    [open, setOpen] = useState(false),
    [retry, setRetry] = useState(0),
    mutation = useMutation()
  useEffect(() => {
    let active = true,
      running = false,
      seen: Set<string> | null = null
    const refresh = async () => {
      if (running || document.hidden) return
      running = true
      const result = await service.inbox(id)
      running = false
      if (!active) return
      if (!result.ok) {
        setError(result.error)
        return
      }
      setError(null)
      setInbox(result.value)
      if (seen) {
        const fresh = result.value.items.filter(
          (n) => !seen!.has(n.id) && n.createdAt > result.value.readAt,
        )
        if (fresh.length) {
          const latest = fresh[0]!
          toast.info(
            fresh.length === 1
              ? `${latest.title}: ${latest.message}`
              : `${fresh.length} novas atualizações de pedidos. Abra as notificações para conferir.`,
            { toastId: `notification:${latest.id}`, role: "status", autoClose: 7000 },
          )
        }
      }
      seen = new Set(result.value.items.map((n) => n.id))
    }
    void refresh()
    const timer = setInterval(() => void refresh(), 8000),
      focus = () => void refresh()
    window.addEventListener("focus", focus)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener("focus", focus)
    }
  }, [service, id, retry])
  return (
    <>
      <button
        type="button"
        className="icon-button notification-bell"
        aria-label={`Notificações${inbox?.unread ? `, ${inbox.unread} não lidas` : ""}${error ? ", atualização indisponível" : ""}`}
        onClick={() => setOpen(true)}
      >
        <Bell size={20} />
        {inbox && inbox.unread > 0 && (
          <span>{inbox.unread > 99 ? "99+" : inbox.unread}</span>
        )}
        {error && <small>!</small>}
      </button>
      {open && (
        <Dialog
          title="Notificações da loja"
          onClose={() => setOpen(false)}
          className="notifications-dialog"
        >
          <div className="editor-form">
            {error && (
              <ErrorNotice error={error} onRetry={() => setRetry((v) => v + 1)} />
            )}
            {mutation.error && <ErrorNotice error={mutation.error} />}
            <PushButton target={{ restaurantId: id }} />
            <p className="field-help">
              Até 100 atualizações recentes. Histórico disponível por 30 dias, conforme as
              permissões do seu perfil.
            </p>
            {inbox && (
              <>
                <button
                  className="text-button"
                  disabled={mutation.pending || !inbox.items.length}
                  onClick={() =>
                    void mutation
                      .run(
                        () => service.read(id, inbox.items[0]!.createdAt),
                        "Notificações marcadas como lidas.",
                      )
                      .then((r) => {
                        if (r?.ok) setRetry((v) => v + 1)
                      })
                  }
                >
                  Marcar estas notificações como lidas
                </button>
                <ul className="notification-list">
                  {inbox.items.map((n) => (
                    <li
                      key={n.id}
                      className={n.createdAt > inbox.readAt ? "is-unread" : ""}
                    >
                      <Link
                        to={`/admin/orders?restaurant=${id}`}
                        onClick={() => setOpen(false)}
                      >
                        <strong>{n.title}</strong>
                        <p>{n.message}</p>
                        <time dateTime={n.createdAt}>
                          {new Date(n.createdAt).toLocaleString("pt-BR")}
                        </time>
                      </Link>
                    </li>
                  ))}
                </ul>
                {!inbox.items.length && <p>Ainda não há atualizações de pedidos.</p>}
              </>
            )}
          </div>
        </Dialog>
      )}
    </>
  )
}
export default function NotificationBell() {
  const { engagement } = useServices(),
    { menu } = useMenu()
  return engagement ? (
    <InboxBell key={menu.restaurant.id} service={engagement} id={menu.restaurant.id} />
  ) : null
}
