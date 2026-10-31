import { useState } from "react"
import { Minus, Plus, Check } from "lucide-react"
import { priceLine } from "@cardapio/domain/quote"
import type { Product } from "@cardapio/domain/catalog"
import type { AddonGroup } from "@cardapio/domain/menu-options"
import { formatMoney } from "@cardapio/domain/money"
import { addonSelectionsSchema } from "@cardapio/contracts"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useDraft } from "../../../shared/presentation/DraftsProvider"
import DraftNotice from "../../../shared/presentation/DraftNotice"
import Dialog from "../../../shared/presentation/Dialog"
import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"

export default function AddonChoice({
  product,
  disabled,
  onClose,
  onAdd,
}: {
  product: Product
  disabled: boolean
  onClose(): void
  onAdd(selections: Record<string, number>, quantity: number): void
}) {
  const { menu } = useMenu(),
    { mode } = useServices(),
    [issue, setIssue] = useState(""),
    [quantity, setQuantity] = useState(1)
  const draft = useDraft(
    `${mode ?? "demo"}:customer:${menu.restaurant.id}:addons-${product.id}`,
    {} as Record<string, number>,
    addonSelectionsSchema.parse,
  )
  const groups = (menu.commerce?.addonGroups ?? []).filter(
    (group) => group.active && group.productIds.includes(product.id),
  )
  let valid = false
  try {
    priceLine(menu, {
      productId: product.id,
      addons: draft.value,
      quantity,
      unitPrice: product.price,
      note: "",
    })
    valid = true
  } catch {
    /* Keep all choices visible while required groups are incomplete. */
  }
  const extra = groups.reduce(
    (sum, group) =>
      sum +
      group.options.reduce(
        (value, option) => value + option.price * (draft.value[option.id] ?? 0),
        0,
      ),
    0,
  )
  const total = (product.price + extra) * quantity
  const missing = groups.find(
    (group) =>
      group.options.reduce((sum, option) => sum + (draft.value[option.id] ?? 0), 0) <
      group.min,
  )
  function change(id: string, nextQuantity: number, singleGroup?: AddonGroup) {
    setIssue("")
    draft.set((old) => {
      const next = { ...old }
      if (singleGroup) for (const option of singleGroup.options) delete next[option.id]
      if (nextQuantity > 0) next[id] = nextQuantity
      else delete next[id]
      return next
    })
  }
  return (
    <Dialog
      title={`Personalizar ${product.name}`}
      onClose={onClose}
      className="product-choice-dialog"
    >
      <div className="product-choice">
        <DraftNotice draft={draft} />
        <div className="product-choice__intro">
          {product.imageUrl && <img src={product.imageUrl} alt="" />}
          <p>{product.description}</p>
          <strong>{formatMoney(product.price)}</strong>
        </div>
        {groups.map((group) => {
          const count = group.options.reduce(
              (sum, option) => sum + (draft.value[option.id] ?? 0),
              0,
            ),
            complete = count >= group.min && count <= group.max
          const help =
            group.min === group.max
              ? `Escolha ${group.max === 1 ? "1 opção" : `${group.max} opções`}`
              : group.min
                ? `Escolha de ${group.min} a ${group.max}`
                : `Escolha até ${group.max}`
          return (
            <fieldset className="addon-choice-group" key={group.id}>
              <legend>
                <span>
                  <strong>{group.name}</strong>
                  <span
                    className={`addon-choice-badge ${group.min ? "addon-choice-badge--required" : ""} ${complete && count ? "addon-choice-badge--complete" : ""}`}
                  >
                    {complete && count ? (
                      <>
                        <Check size={12} aria-hidden="true" /> Pronto
                      </>
                    ) : group.min ? (
                      "Obrigatório"
                    ) : (
                      "Opcional"
                    )}
                  </span>
                </span>
                <small>
                  {help} · {count}/{group.max} selecionados
                </small>
              </legend>
              {group.max === 1 && group.min === 0 && (
                <label className="addon-choice-option">
                  <span>Sem adicional</span>
                  <ValidatedInput
                    type="radio"
                    name={`addon-${group.id}`}
                    checked={count === 0}
                    disabled={disabled}
                    onChange={() => change("", 0, group)}
                  />
                </label>
              )}
              {group.options.map((option) => {
                const selected = draft.value[option.id] ?? 0
                const description = (
                  <span>
                    <strong>{option.name}</strong>
                    <small>
                      {option.available
                        ? option.price
                          ? `+ ${formatMoney(option.price)}`
                          : "Sem custo"
                        : "Esgotado"}
                    </small>
                  </span>
                )
                if (group.max === 1 || option.maxQuantity === 1)
                  return (
                    <label className="addon-choice-option" key={option.id}>
                      {description}
                      <ValidatedInput
                        type={group.max === 1 ? "radio" : "checkbox"}
                        name={
                          group.max === 1 ? `addon-${group.id}` : `addon-${option.id}`
                        }
                        aria-label={option.name}
                        checked={selected > 0}
                        disabled={
                          disabled ||
                          (!option.available && selected === 0) ||
                          (group.max > 1 && count >= group.max && selected === 0)
                        }
                        onChange={(event) =>
                          change(
                            option.id,
                            event.target.checked ? 1 : 0,
                            group.max === 1 ? group : undefined,
                          )
                        }
                      />
                    </label>
                  )
                return (
                  <div className="addon-choice-option" key={option.id}>
                    {description}
                    <div
                      className="inline-stepper"
                      role="group"
                      aria-label={`Quantidade de ${option.name}`}
                    >
                      <button
                        type="button"
                        aria-label={`Remover ${option.name}`}
                        disabled={disabled || selected === 0}
                        onClick={() => change(option.id, selected - 1)}
                      >
                        <Minus size={16} aria-hidden="true" />
                      </button>
                      <span aria-live="polite">{selected}</span>
                      <button
                        type="button"
                        aria-label={`Adicionar ${option.name}`}
                        disabled={
                          disabled ||
                          !option.available ||
                          selected >= option.maxQuantity ||
                          count >= group.max
                        }
                        onClick={() => change(option.id, selected + 1)}
                      >
                        <Plus size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </fieldset>
          )
        })}
        <p className="product-choice__notice">
          As escolhas e o valor dos adicionais valem para cada unidade deste produto.
        </p>
        <button type="button" className="text-button" onClick={() => draft.set({})}>
          Limpar escolhas
        </button>
        <footer className="product-choice__footer">
          {(missing || !valid || issue) && (
            <p className="product-choice__notice" role="status">
              {issue ||
                (missing
                  ? `Escolha as opções de “${missing.name}” para continuar.`
                  : "As opções mudaram. Limpe as escolhas e revise os adicionais.")}
            </p>
          )}
          <div className="inline-stepper" role="group" aria-label="Quantidade do produto">
            <button
              type="button"
              aria-label="Diminuir quantidade do produto"
              disabled={disabled || quantity <= 1}
              onClick={() => setQuantity((value) => value - 1)}
            >
              <Minus size={17} aria-hidden="true" />
            </button>
            <span aria-live="polite">{quantity}</span>
            <button
              type="button"
              aria-label="Aumentar quantidade do produto"
              disabled={disabled || quantity >= 999}
              onClick={() => setQuantity((value) => value + 1)}
            >
              <Plus size={17} aria-hidden="true" />
            </button>
          </div>
          <button
            className="primary-button"
            disabled={disabled || !valid || !!draft.issue}
            onClick={() => {
              try {
                onAdd(draft.value, quantity)
                draft.clear()
              } catch {
                setIssue("O cardápio mudou. Feche e escolha os adicionais novamente.")
              }
            }}
          >
            <span>Adicionar ao carrinho</span>
            <strong aria-hidden="true">{formatMoney(total)}</strong>
          </button>
        </footer>
      </div>
    </Dialog>
  )
}
