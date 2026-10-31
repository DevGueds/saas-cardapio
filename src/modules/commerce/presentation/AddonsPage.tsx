import { useState } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { can } from "@cardapio/domain/permissions"
import { formatMoney } from "@cardapio/domain/money"
import type { AddonGroup } from "@cardapio/domain/menu-options"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useAccount } from "../../identity/presentation/AccountContext"
import { useMutation } from "../../../shared/presentation/use-mutation"
import PageHeading from "../../../shared/presentation/PageHeading"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import Dialog from "../../../shared/presentation/Dialog"
import { InputField } from "../../../shared/presentation/Fields"
import AddonForm from "./AddonForm"
export default function AddonsPage() {
  const { menu, loading, error, reload } = useMenu(),
    { commerce } = useServices(),
    account = useAccount(),
    mutation = useMutation()
  const [editor, setEditor] = useState<{ group?: AddonGroup } | null>(null),
    [deleting, setDeleting] = useState<AddonGroup | null>(null),
    [search, setSearch] = useState("")
  if (account && !can(account.restaurant.role, "catalog:write"))
    return <p className="info-notice">Seu perfil não permite gerenciar adicionais.</p>
  const groups = menu.commerce?.addonGroups ?? [],
    blocked = loading || !!error || !commerce || mutation.pending
  return (
    <section className="addons-page">
      <PageHeading
        eyebrow="Do jeito do cliente"
        title="Adicionais e extras"
        description="Cadastre uma vez, vincule aos produtos e controle as escolhas sem complicação."
      >
        <button
          className="primary-button"
          disabled={blocked || groups.length >= 100}
          onClick={() => setEditor({})}
        >
          <Plus size={18} /> Novo grupo
        </button>
      </PageHeading>
      {mutation.error && (
        <ErrorNotice error={mutation.error} onRetry={() => void reload()} />
      )}
      <InputField
        label="Buscar grupo de adicionais"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="addon-grid">
        {groups
          .filter((g) =>
            g.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")),
          )
          .map((g) => (
            <article className="settings-card" key={g.id}>
              <span className="offer-badge">
                {g.active ? (g.min ? "Obrigatório" : "Opcional") : "Pausado"}
              </span>
              <h2>{g.name}</h2>
              <p>
                {g.min} a {g.max} escolhas · {g.productIds.length} produtos
              </p>
              <p className="addon-associations">
                <strong>Aparece em:</strong>{" "}
                {g.productIds.length
                  ? menu.products
                      .filter((product) => g.productIds.includes(product.id))
                      .map((product) => product.name)
                      .join(", ")
                  : "Nenhum produto. Edite para escolher onde oferecer."}
              </p>
              <ul className="addon-summary">
                {g.options.map((o) => (
                  <li key={o.id}>
                    <span>
                      {o.name}
                      {!o.available && " · Esgotado"}
                    </span>
                    <strong>{o.price ? formatMoney(o.price) : "Grátis"}</strong>
                  </li>
                ))}
              </ul>
              <div className="addon-row">
                <button
                  className="secondary-button"
                  disabled={blocked}
                  onClick={() => setEditor({ group: g })}
                >
                  <Pencil size={16} /> Editar {g.name}
                </button>
                <button
                  className="icon-button"
                  aria-label={`Excluir grupo ${g.name}`}
                  disabled={blocked}
                  onClick={() => setDeleting(g)}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </article>
          ))}
      </div>
      {!groups.length && (
        <div className="empty-search">
          <h2>O primeiro extra faz a diferença</h2>
          <p>
            Crie um grupo como “Turbine seu lanche” com queijo, bacon e outros adicionais.
          </p>
        </div>
      )}
      {editor && <AddonForm group={editor.group} onClose={() => setEditor(null)} />}
      {deleting && (
        <Dialog
          title="Excluir grupo de adicionais"
          onClose={() => setDeleting(null)}
          busy={mutation.pending}
        >
          <div className="editor-form">
            <p>
              Excluir {deleting.name} de {deleting.productIds.length} produtos? Carrinhos
              em andamento precisarão ser revisados. Os pedidos registrados serão
              preservados.
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
                Manter grupo
              </button>
              <button
                className="danger-button"
                disabled={blocked}
                onClick={() =>
                  void mutation
                    .run(
                      () =>
                        commerce!.removeAddon(
                          menu.restaurant.id,
                          menu.revision,
                          deleting.id,
                        ),
                      "Grupo excluído.",
                    )
                    .then((r) => {
                      if (r?.ok) setDeleting(null)
                    })
                }
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
