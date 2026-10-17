import { z } from "zod"
import { Link } from "react-router"
import { useDraft } from "../../../shared/presentation/DraftsProvider"
import { useServices } from "../../../app/presentation/ServicesProvider"
const schema = z
  .array(
    z.strictObject({
      orderId: z.string().max(100),
      trackingToken: z.string().regex(/^[a-f0-9]{64}$/),
      createdAt: z.string(),
    }),
  )
  .max(10)
export function useReceipts(restaurantId: string) {
  const { mode } = useServices()
  return useDraft(
    `${mode ?? "demo"}:customer:${restaurantId}:receipts`,
    [],
    schema.parse,
    30 * 86400000,
  )
}
export function trackingPath(slug: string, id: string, token: string) {
  return `/pedido/${encodeURIComponent(slug)}/${encodeURIComponent(id)}#${token}`
}
export default function RecentOrders({
  restaurantId,
  slug,
}: {
  restaurantId: string
  slug: string
}) {
  const receipts = useReceipts(restaurantId)
  if (!receipts.value.length) return null
  return (
    <aside className="recent-orders">
      <div>
        <strong>Seus pedidos recentes</strong>
        <small>Acompanhe as etapas e a previsão da loja.</small>
      </div>
      <div>
        {receipts.value.slice(0, 3).map((order) => (
          <Link
            className="secondary-button"
            key={order.orderId}
            to={trackingPath(slug, order.orderId, order.trackingToken)}
          >
            Acompanhar #{order.orderId.slice(0, 8).toUpperCase()}
          </Link>
        ))}
      </div>
      <button className="text-button" onClick={receipts.clear}>
        Esquecer links neste dispositivo
      </button>
    </aside>
  )
}
