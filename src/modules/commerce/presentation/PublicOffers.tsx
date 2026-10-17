import { useState } from "react"
import { useSearchParams } from "react-router"
import { PackagePlus, Plus, TicketPercent } from "lucide-react"
import { comboAvailable, promotionActive } from "@cardapio/domain/quote"
import { formatMoney } from "@cardapio/domain/money"
import { normalizeName } from "@cardapio/domain/validation"
import { useMenu } from "../../../app/presentation/MenuScope"
import ComboChoice from "./ComboChoice"
import ImageWithFallback from "../../../shared/presentation/ImageWithFallback"
import type { CartController } from "../../checkout/presentation/use-cart"
export default function PublicOffers({
  controller,
  disabled,
  search = "",
}: {
  controller: CartController
  disabled: boolean
  search?: string
}) {
  const { menu } = useMenu(),
    [params, setParams] = useSearchParams(),
    [notice, setNotice] = useState("")
  const selected =
    menu.commerce?.combos.find(
      (combo) => combo.active && combo.id === params.get("combo"),
    ) ?? null
  const setSelected = (combo: { id: string } | null) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      if (combo) next.set("combo", combo.id)
      else next.delete("combo")
      return next
    })
  const combos = (menu.commerce?.combos ?? []).filter(
      (c) =>
        c.active &&
        normalizeName(`${c.name} ${c.description}`).includes(normalizeName(search)),
    ),
    promotions = (menu.commerce?.promotions ?? []).filter((p) =>
      promotionActive(p, Date.now()),
    )
  if (!combos.length && !promotions.length) return null
  return (
    <section className="public-offers" aria-label="Combos e promoções">
      {promotions.length > 0 && (
        <div className="public-promotions">
          {promotions.map((p) => (
            <article className="coupon-banner" key={p.id}>
              <TicketPercent size={24} />
              <div>
                <strong>{p.name}</strong>
                <p>
                  {p.kind === "PERCENT"
                    ? `${p.value}% de desconto`
                    : p.kind === "FIXED"
                      ? `${formatMoney(p.value)} de desconto`
                      : "Entrega grátis"}
                  {p.minSubtotal ? ` a partir de ${formatMoney(p.minSubtotal)}` : ""}
                  {p.kind === "FREE_DELIVERY"
                    ? " · para entregas"
                    : p.includeCombos
                      ? " · inclui combos"
                      : " · combos não incluídos"}
                </p>
                <small>
                  {p.code ? `Use ${p.code} no carrinho` : "Aplicação automática"} · até{" "}
                  {new Date(p.endsAt).toLocaleDateString("pt-BR")}
                  {p.maxDiscount && p.kind !== "FREE_DELIVERY"
                    ? ` · desconto até ${formatMoney(p.maxDiscount)}`
                    : ""}
                </small>
              </div>
            </article>
          ))}
        </div>
      )}
      {combos.length > 0 && (
        <>
          <div className="section-heading">
            <div>
              <span className="eyebrow">Juntos fica ainda melhor</span>
              <h2>Combos da casa</h2>
            </div>
            <PackagePlus size={26} />
          </div>
          <div className="public-combo-grid">
            {combos.map((combo) => (
              <article className="public-combo-card" key={combo.id}>
                <ImageWithFallback src={combo.imageUrl} alt="" />
                <div>
                  <span className="offer-badge">
                    {combo.groups.length ? "Monte do seu jeito" : "Combinação pronta"}
                  </span>
                  <h3>{combo.name}</h3>
                  <p>{combo.description}</p>
                  <div className="public-combo-card__action">
                    <strong>
                      {combo.groups.some((g) => g.options.some((o) => o.extraPrice > 0))
                        ? "A partir de "
                        : ""}
                      {formatMoney(combo.price)}
                    </strong>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={disabled || !comboAvailable(combo, menu)}
                      onClick={() => setSelected(combo)}
                    >
                      <Plus size={17} />
                      {comboAvailable(combo, menu) ? "Escolher combo" : "Indisponível"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {notice && (
        <p className="success-notice" role="status">
          {notice}
        </p>
      )}
      {selected && (
        <ComboChoice
          key={selected.id}
          combo={selected}
          disabled={disabled}
          onClose={() => setSelected(null)}
          onAdd={(selections) => {
            controller.addCombo(selected, selections)
            setNotice(`${selected.name} adicionado ao carrinho.`)
            setSelected(null)
          }}
        />
      )}
    </section>
  )
}
