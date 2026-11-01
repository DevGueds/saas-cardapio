import { useCallback, useEffect } from "react"
import { Link, useLocation, useParams } from "react-router"
import { CheckCircle2, Clock3, CookingPot, Bike, ShoppingBag, Store } from "lucide-react"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { formatMoney } from "@cardapio/domain/money"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import { orderTime, shortOrder } from "./order-labels"
import CustomerNotifications from "../../engagement/presentation/CustomerNotifications"
import FeatureBoundary from "../../../shared/presentation/FeatureBoundary"
import { canRefreshConnection } from "../../../shared/browser-connectivity"
import { useResource } from "../../../shared/presentation/use-resource"
export default function TrackingPage() {
  const { slug = "", orderId = "" } = useParams(),
    location = useLocation(),
    { tracking } = useServices(),
    token = location.hash.slice(1)
  const load = useCallback(async () => {
    if (!tracking) return { ok: true as const, value: null }
    const result = await tracking(slug, orderId, token)
    return result.ok
      ? {
          ok: true as const,
          value: {
            order: result.value,
            updated: new Date().toLocaleTimeString("pt-BR"),
          },
        }
      : result
  }, [slug, orderId, token, tracking])
  const { data: resource, error, reload, loading } = useResource(load)
  const data = resource?.order
  const updated = resource?.updated
  useEffect(() => {
    const interval = setInterval(() => {
      if (tracking && canRefreshConnection()) void reload({ dedupe: true })
    }, 15000)
    return () => clearInterval(interval)
  }, [tracking, reload])
  const pickup = data?.fulfillment?.mode === "PICKUP"
  const stages = [
    {
      status: "NEW",
      label: "Pedido recebido",
      description: "Aguardando a confirmação da loja",
      Icon: ShoppingBag,
    },
    {
      status: "PREPARING",
      label: "Em preparo",
      description: "A cozinha está preparando seus itens",
      Icon: CookingPot,
    },
    {
      status: "READY",
      label: pickup ? "Pronto para retirar" : "Pronto para sair",
      description: pickup
        ? "Seu pedido está esperando no balcão"
        : "Aguardando a saída para entrega",
      Icon: Store,
    },
    ...(!pickup
      ? [
          {
            status: "OUT_FOR_DELIVERY",
            label: "Saiu para entrega",
            description: "O pedido está a caminho",
            Icon: Bike,
          },
        ]
      : []),
    {
      status: "COMPLETED",
      label: pickup ? "Retirado" : "Entregue",
      description: "Pedido concluído pela loja",
      Icon: CheckCircle2,
    },
  ]
  const current = stages.findIndex((s) => s.status === data?.status)
  return (
    <main className="tracking-page">
      <header>
        <Link className="public-wordmark" to={`/menu/${slug}`}>
          <ShoppingBag size={22} /> {data?.restaurantName ?? "Acompanhar pedido"}
        </Link>
        <Link className="secondary-button" to={`/menu/${slug}`}>
          Voltar ao cardápio
        </Link>
      </header>
      <section className="tracking-card">
        <p className="eyebrow">Cada etapa, bem pertinho</p>
        <h1>Pedido #{shortOrder(orderId)}</h1>
        {!tracking && (
          <p className="info-notice">
            Acompanhamento disponível apenas para pedidos registrados na loja conectada.
          </p>
        )}
        {error && <ErrorNotice error={error} onRetry={() => void reload()} />}
        {!data && tracking && !error && <p role="status">Buscando seu pedido…</p>}
        {data && (
          <>
            {data.status === "CANCELLED" ? (
              <div className="info-notice">
                <h2>Pedido cancelado</h2>
                <p>
                  Fale com a loja para esclarecer o cancelamento e combinar qualquer
                  pagamento já realizado.
                </p>
              </div>
            ) : (
              <>
                <div className="tracking-estimate">
                  <Clock3 size={25} />
                  <div>
                    <strong>Previsão informada: {data.eta || "consulte a loja"}</strong>
                    <p>
                      {data.region || (pickup ? "Retirada na loja" : "Entrega local")}
                    </p>
                    <small>
                      A previsão conta a partir do recebimento e pode variar durante o
                      preparo.
                    </small>
                  </div>
                </div>
                <ol className="order-timeline">
                  {stages.map((stage, index) => {
                    const event = data.history?.find((h) => h.status === stage.status),
                      Icon = stage.Icon
                    return (
                      <li
                        key={stage.status}
                        className={
                          index === current
                            ? "is-current"
                            : index < current
                              ? "is-complete"
                              : ""
                        }
                        aria-current={index === current ? "step" : undefined}
                      >
                        <span>
                          <Icon size={22} />
                        </span>
                        <div>
                          <h2>{stage.label}</h2>
                          <p>{stage.description}</p>
                          {event && (
                            <time dateTime={event.at}>{orderTime(event.at)}</time>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </>
            )}
            <section className="tracking-items">
              <h2>Resumo do pedido</h2>
              {data.items.map((item, index) => (
                <div key={index}>
                  <div>
                    <strong>
                      {item.quantity}× {item.name}
                    </strong>
                    {item.components?.map((c, n) => (
                      <small key={n}>{c}</small>
                    ))}
                  </div>
                  <span>{formatMoney(item.quantity * item.unitPrice)}</span>
                </div>
              ))}
              <div>
                <span>Entrega</span>
                <span>{formatMoney(data.deliveryFee)}</span>
              </div>
              {!!data.discount && (
                <div>
                  <span>{data.promotionName ?? "Desconto"}</span>
                  <span>−{formatMoney(data.discount)}</span>
                </div>
              )}
              <div className="tracking-total">
                <strong>Total</strong>
                <strong>{formatMoney(data.total)}</strong>
              </div>
            </section>
            <p className="field-help">
              Atualizado às {updated}. Consulta a cada 15 segundos. As etapas são
              informadas pela loja; este acompanhamento não confirma pagamento.
            </p>
            <button
              className="text-button"
              disabled={loading}
              onClick={() => void reload()}
            >
              Atualizar acompanhamento
            </button>
            <FeatureBoundary label="Notificações do pedido">
              <CustomerNotifications slug={slug} orderId={orderId} token={token} />
            </FeatureBoundary>
          </>
        )}
      </section>
    </main>
  )
}
