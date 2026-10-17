import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"
import type { Combo } from "@cardapio/domain/commerce"
import { priceLine } from "@cardapio/domain/quote"
import { formatMoney } from "@cardapio/domain/money"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useDraft } from "../../../shared/presentation/DraftsProvider"
import DraftNotice from "../../../shared/presentation/DraftNotice"
import Dialog from "../../../shared/presentation/Dialog"
import ImageWithFallback from "../../../shared/presentation/ImageWithFallback"
import { comboSelectionsSchema } from "../application/offer-drafts"
export default function ComboChoice({
  combo,
  disabled,
  onClose,
  onAdd,
}: {
  combo: Combo
  disabled: boolean
  onClose(): void
  onAdd(selections: Record<string, string>): void
}) {
  const { menu } = useMenu(),
    { mode } = useServices()
  const draft = useDraft(
    `${mode ?? "demo"}:customer:${menu.restaurant.id}:combo-${combo.id}`,
    {} as Record<string, string>,
    comboSelectionsSchema.parse,
  )
  const selections = draft.value,
    setSelections = draft.set
  let price: number | null = null
  try {
    price = priceLine(menu, {
      productId: combo.id,
      kind: "COMBO",
      selections,
      quantity: 1,
      unitPrice: combo.price,
      note: "",
    }).unitPrice
  } catch {
    /* Missing choices keep the action disabled. */
  }
  return (
    <Dialog title={combo.name} onClose={onClose} className="combo-choice-dialog">
      <div className="combo-choice">
        <DraftNotice draft={draft} />
        <ImageWithFallback src={combo.imageUrl} alt="" />
        <p>{combo.description}</p>
        {combo.items.length > 0 && (
          <section>
            <h3>Já vem no combo</h3>
            <ul className="combo-included">
              {combo.items.map((item) => (
                <li key={item.productId}>
                  {item.quantity}×{" "}
                  {menu.products.find((p) => p.id === item.productId)?.name}
                </li>
              ))}
            </ul>
          </section>
        )}
        {combo.groups.map((group) => (
          <fieldset className="combo-options" key={group.id}>
            <legend>
              {group.name}
              <small>Escolha 1 opção</small>
            </legend>
            {group.options.map((option) => {
              const product = menu.products.find((p) => p.id === option.productId)
              return (
                <label
                  key={option.productId}
                  className={!product?.available ? "is-unavailable" : ""}
                >
                  <ValidatedInput
                    type="radio"
                    name={group.id}
                    checked={selections[group.id] === option.productId}
                    disabled={disabled || !product?.available}
                    onChange={() =>
                      setSelections((v) => ({ ...v, [group.id]: option.productId }))
                    }
                  />
                  <span>
                    {product?.name ?? "Indisponível"}
                    {!product?.available && <small>Esgotado</small>}
                  </span>
                  <strong>
                    {option.extraPrice
                      ? `+ ${formatMoney(option.extraPrice)}`
                      : "Incluído"}
                  </strong>
                </label>
              )
            })}
          </fieldset>
        ))}
        <div className="combo-choice-footer">
          <strong>{formatMoney(price ?? combo.price)}</strong>
          <button
            className="primary-button"
            disabled={disabled || price === null || !!draft.issue}
            onClick={() => {
              onAdd(selections)
              draft.clear()
            }}
          >
            Adicionar combo ao carrinho
          </button>
        </div>
        {price === null && (
          <p className="field-help">Complete as escolhas disponíveis para adicionar.</p>
        )}
      </div>
    </Dialog>
  )
}
