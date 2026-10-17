import { useEffect, useState } from "react"
import type { OrderView, AppError } from "@cardapio/contracts"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useMutation } from "../../../shared/presentation/use-mutation"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import { SelectField } from "../../../shared/presentation/Fields"
export default function CourierAssignment({
  order,
  onSaved,
}: {
  order: OrderView
  onSaved(): void
}) {
  const { orders } = useServices(),
    [couriers, setCouriers] = useState<{ userId: string; name: string }[]>([]),
    [selected, setSelected] = useState(order.courierId ?? ""),
    [error, setError] = useState<AppError | null>(null),
    [loading, setLoading] = useState(true),
    mutation = useMutation()
  useEffect(() => {
    let active = true
    if (orders)
      void orders.couriers(order.restaurantId).then((result) => {
        if (!active) return
        if (result.ok) setCouriers(result.value)
        else setError(result.error)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [orders, order.restaurantId])
  async function save() {
    if (!orders) return
    const result = await mutation.run(() =>
      orders.assign(order.restaurantId, order.id, order.revision, selected || null),
    )
    if (result?.ok) onSaved()
  }
  return (
    <section className="courier-assignment">
      <h3>Responsável pela entrega</h3>
      {(error || mutation.error) && <ErrorNotice error={(error || mutation.error)!} />}
      <SelectField
        label="Entregador"
        value={selected}
        disabled={loading || mutation.pending}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">Sem entregador atribuído</option>
        {couriers.map((c) => (
          <option key={c.userId} value={c.userId}>
            {c.name}
          </option>
        ))}
      </SelectField>
      {!loading && !couriers.length && (
        <p className="field-help">
          O proprietário pode adicionar pessoas com perfil Entregador em Equipe.
        </p>
      )}
      <button
        className="secondary-button"
        disabled={
          loading || mutation.pending || !!error || selected === (order.courierId ?? "")
        }
        onClick={() => void save()}
      >
        {mutation.pending ? "Atribuindo…" : "Salvar entregador"}
      </button>
    </section>
  )
}
