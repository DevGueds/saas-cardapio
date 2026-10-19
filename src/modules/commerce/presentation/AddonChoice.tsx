import { useState } from "react"
import { Minus, Plus } from "lucide-react"
import { priceLine } from "@cardapio/domain/quote"
import type { Product } from "@cardapio/domain/catalog"
import { formatMoney } from "@cardapio/domain/money"
import { addonSelectionsSchema } from "@cardapio/contracts"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useDraft } from "../../../shared/presentation/DraftsProvider"
import DraftNotice from "../../../shared/presentation/DraftNotice"
import Dialog from "../../../shared/presentation/Dialog"
export default function AddonChoice({
  product,
  disabled,
  onClose,
  onAdd,
}: {
  product: Product
  disabled: boolean
  onClose(): void
  onAdd(selections: Record<string, number>): void
}) {
  const { menu } = useMenu(),
    { mode } = useServices(),
    [issue, setIssue] = useState("")
  const draft = useDraft(
    `${mode ?? "demo"}:customer:${menu.restaurant.id}:addons-${product.id}`,
    {} as Record<string, number>,
    addonSelectionsSchema.parse,
  )
  const groups = (menu.commerce?.addonGroups ?? []).filter(
    (g) => g.active && g.productIds.includes(product.id),
  )
  let price: number | null = null,
    incomplete = ""
  try {
    price = priceLine(menu, {
      productId: product.id,
      addons: draft.value,
      quantity: 1,
      unitPrice: product.price,
      note: "",
    }).unitPrice
  } catch {
    incomplete =
      "Revise as quantidades e a disponibilidade dos adicionais para continuar."
  }
  const change = (id: string, qty: number) =>
    draft.set((old) => {
      const next = { ...old }
      if (qty > 0) next[id] = qty
      else delete next[id]
      return next
    })
  return (
    <Dialog
      title={`Personalizar ${product.name}`}
      onClose={onClose}
      className="combo-choice-dialog"
    >
      <div className="combo-choice">
        <DraftNotice draft={draft} />
        <p>{product.description}</p>
        {groups.map((g) => {
          const count = g.options.reduce((s, o) => s + (draft.value[o.id] ?? 0), 0)
          return (
            <fieldset className="combo-options" key={g.id}>
              <legend>
                {g.name}
                <small>
                  {g.min ? `Obrigatório · mínimo ${g.min}` : "Opcional"} · máximo {g.max}{" "}
                  · {count} selecionados
                </small>
              </legend>
              {g.options.map((o) => {
                const qty = draft.value[o.id] ?? 0
                return (
                  <div className="addon-row" key={o.id}>
                    <div>
                      <strong>{o.name}</strong>
                      <p>
                        {o.price ? `+ ${formatMoney(o.price)}` : "Grátis"}
                        {!o.available && " · Esgotado"}
                      </p>
                    </div>
                    <div
                      className="inline-stepper"
                      role="group"
                      aria-label={`Quantidade de ${o.name}`}
                    >
                      <button
                        type="button"
                        aria-label={`Remover ${o.name}`}
                        disabled={disabled || qty === 0}
                        onClick={() => change(o.id, qty - 1)}
                      >
                        <Minus size={16} />
                      </button>
                      <span aria-live="polite">{qty}</span>
                      <button
                        type="button"
                        aria-label={`Adicionar ${o.name}`}
                        disabled={
                          disabled ||
                          !o.available ||
                          qty >= o.maxQuantity ||
                          count >= g.max
                        }
                        onClick={() => change(o.id, qty + 1)}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </fieldset>
          )
        })}
        <p className="field-help">O valor dos adicionais é por unidade do produto.</p>
        {(incomplete || issue) && <p role="status">{issue || incomplete}</p>}
        <div className="combo-choice-footer">
          <strong>
            {price === null
              ? `A partir de ${formatMoney(product.price)}`
              : formatMoney(price)}
          </strong>
          <button
            className="primary-button"
            disabled={disabled || price === null || !!draft.issue}
            onClick={() => {
              try {
                onAdd(draft.value)
                draft.clear()
              } catch {
                setIssue("O cardápio mudou. Feche e escolha os adicionais novamente.")
              }
            }}
          >
            Adicionar ao carrinho
          </button>
        </div>
        <button type="button" className="text-button" onClick={() => draft.set({})}>
          Limpar escolhas
        </button>
      </div>
    </Dialog>
  )
}
