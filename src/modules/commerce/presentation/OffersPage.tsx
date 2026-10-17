import { useState } from "react"
import { useSearchParams } from "react-router"
import { Plus, PackagePlus, TicketPercent, Pencil, Trash2 } from "lucide-react"
import { can } from "@cardapio/domain/permissions"
import { emptyCommerce } from "@cardapio/domain/commerce"
import { comboAvailable, promotionActive } from "@cardapio/domain/quote"
import { formatMoney } from "@cardapio/domain/money"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useAccount } from "../../identity/presentation/AccountContext"
import PageHeading from "../../../shared/presentation/PageHeading"
import ImageWithFallback from "../../../shared/presentation/ImageWithFallback"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import Dialog from "../../../shared/presentation/Dialog"
import { useMutation } from "../../../shared/presentation/use-mutation"
import ComboForm from "./ComboForm"
import PromotionForm from "./PromotionForm"
export default function OffersPage() {
  const { menu, reload, loading, error } = useMenu(),
    { commerce } = useServices(),
    account = useAccount(),
    mutation = useMutation()
  const [params, setParams] = useSearchParams(),
    [notice, setNotice] = useState(""),
    [deleting, setDeleting] = useState<{
      id: string
      name: string
      kind: "combos" | "promotions"
    } | null>(null)
  const data = menu.commerce ?? emptyCommerce(),
    kind = params.get("tab") === "promotions" ? "promotions" : "combos",
    editor = params.get("edit")
  const readOnly = !!account && !can(account.restaurant.role, "catalog:write"),
    blocked = readOnly || loading || !!error || mutation.pending || !commerce
  const navigate = (key: string, value: string | null) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key === "tab") next.delete("edit")
      return next
    })
  const saved = () => {
    navigate("edit", null)
    setNotice("Oferta salva no cardápio.")
  }
  async function remove() {
    if (!deleting || !commerce) return
    const result = await mutation.run(() =>
      commerce.remove(menu.restaurant.id, menu.revision, deleting.kind, deleting.id),
    )
    if (result?.ok) {
      setDeleting(null)
      setNotice("Oferta excluída. Pedidos anteriores foram preservados.")
    }
  }
  return (
    <section className="offers-page">
      <PageHeading
        eyebrow="Mais motivos para pedir"
        title="Combos e promoções"
        description="Combine favoritos, crie ofertas e deixe o cliente escolher com facilidade."
      >
        <button
          className="primary-button"
          disabled={blocked}
          onClick={() => navigate("edit", "new")}
        >
          <Plus size={19} />
          {kind === "combos" ? "Novo combo" : "Nova promoção"}
        </button>
      </PageHeading>
      <div className="offer-tabs" role="group" aria-label="Tipo de oferta">
        {(
          [
            ["combos", "Combos", PackagePlus],
            ["promotions", "Promoções", TicketPercent],
          ] as const
        ).map(([id, label, Icon]) => (
          <button key={id} aria-pressed={kind === id} onClick={() => navigate("tab", id)}>
            <Icon size={20} />
            {label}
            <span>{data[id].length}</span>
          </button>
        ))}
      </div>
      {notice && (
        <p className="success-notice" role="status">
          {notice}
        </p>
      )}
      {mutation.error && (
        <ErrorNotice error={mutation.error} onRetry={() => void reload()} />
      )}
      {data[kind].length ? (
        <div className="offer-grid">
          {kind === "combos"
            ? data.combos.map((combo) => (
                <article className="offer-card" key={combo.id}>
                  <ImageWithFallback src={combo.imageUrl} alt="" />
                  <div className="offer-card__body">
                    <span
                      className={`offer-badge ${comboAvailable(combo, menu) ? "" : "offer-badge--off"}`}
                    >
                      {comboAvailable(combo, menu)
                        ? "Disponível"
                        : combo.active
                          ? "Aguardando produtos"
                          : "Pausado"}
                    </span>
                    <h2>{combo.name}</h2>
                    <p>{combo.description || "Uma combinação feita pela loja."}</p>
                    <strong className="offer-price">{formatMoney(combo.price)}</strong>
                    <small>
                      {combo.items.length} item(ns) fixo(s) · {combo.groups.length}{" "}
                      escolha(s)
                    </small>
                    <div className="offer-actions">
                      <button
                        className="secondary-button"
                        disabled={blocked}
                        onClick={() => navigate("edit", combo.id)}
                      >
                        <Pencil size={16} /> Editar combo
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Excluir ${combo.name}`}
                        disabled={blocked}
                        onClick={() => setDeleting({ ...combo, kind })}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </article>
              ))
            : data.promotions.map((p) => (
                <article className="offer-card promotion-card" key={p.id}>
                  <div className="promotion-symbol">
                    <TicketPercent size={34} />
                    <strong>
                      {p.kind === "PERCENT"
                        ? `${p.value}% OFF`
                        : p.kind === "FIXED"
                          ? `${formatMoney(p.value)} OFF`
                          : "Entrega grátis"}
                    </strong>
                  </div>
                  <div className="offer-card__body">
                    <span
                      className={`offer-badge ${promotionActive(p, Date.now()) ? "" : "offer-badge--off"}`}
                    >
                      {!p.active
                        ? "Pausada"
                        : Date.now() < Date.parse(p.startsAt)
                          ? "Agendada"
                          : promotionActive(p, Date.now())
                            ? "Em vigor"
                            : "Encerrada / esgotada"}
                    </span>
                    <h2>{p.name}</h2>
                    <p>{p.code ? `Cupom: ${p.code}` : "Aplicada automaticamente"}</p>
                    <small>
                      A partir de {formatMoney(p.minSubtotal)} · {p.used}
                      {p.maxUses ? ` de ${p.maxUses}` : ""} uso(s)
                    </small>
                    <small>Até {new Date(p.endsAt).toLocaleString("pt-BR")}</small>
                    <div className="offer-actions">
                      <button
                        className="secondary-button"
                        disabled={blocked}
                        onClick={() => navigate("edit", p.id)}
                      >
                        <Pencil size={16} /> Editar promoção
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Excluir ${p.name}`}
                        disabled={blocked}
                        onClick={() => setDeleting({ ...p, kind })}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
        </div>
      ) : (
        <div className="empty-search">
          <PackagePlus size={40} />
          <h2>
            {kind === "combos"
              ? "Sua próxima combinação começa aqui"
              : "Dê um motivo a mais para pedir"}
          </h2>
          <p>
            {kind === "combos"
              ? "Junte produtos do catálogo e adicione escolhas, como bebida ou acompanhamento."
              : "Crie descontos automáticos, cupons ou entrega grátis com prazo e limite."}
          </p>
          <button
            className="primary-button"
            disabled={blocked}
            onClick={() => navigate("edit", "new")}
          >
            Criar {kind === "combos" ? "primeiro combo" : "primeira promoção"}
          </button>
        </div>
      )}
      {editor &&
        !readOnly &&
        (kind === "combos"
          ? (editor === "new" || data.combos.some((c) => c.id === editor)) && (
              <ComboForm
                key={editor}
                combo={data.combos.find((c) => c.id === editor)}
                onClose={() => navigate("edit", null)}
                onSaved={saved}
              />
            )
          : (editor === "new" || data.promotions.some((p) => p.id === editor)) && (
              <PromotionForm
                key={editor}
                promotion={data.promotions.find((p) => p.id === editor)}
                onClose={() => navigate("edit", null)}
                onSaved={saved}
              />
            ))}
      {deleting && (
        <Dialog
          title="Excluir oferta"
          busy={mutation.pending}
          onClose={() => setDeleting(null)}
        >
          <div className="editor-form">
            <p>
              Excluir “{deleting.name}”? Ela deixará de aparecer nos próximos pedidos.
            </p>
            {mutation.error && (
              <ErrorNotice error={mutation.error} onRetry={() => void reload()} />
            )}
            <div className="form-actions">
              <button
                className="secondary-button"
                disabled={mutation.pending}
                onClick={() => setDeleting(null)}
              >
                Manter oferta
              </button>
              <button
                className="danger-button"
                disabled={blocked}
                onClick={() => void remove()}
              >
                Confirmar exclusão
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  )
}
