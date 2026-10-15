import { useAccount } from "../../identity/presentation/AccountContext"
import PageHeading from "../../../shared/presentation/PageHeading"
import { useState } from "react"

import {
  CheckCircle2,
  LayoutGrid,
  List,
  Package,
  PauseCircle,
  Plus,
  Search,
} from "lucide-react"

import { useMenu } from "../../../app/presentation/MenuScope"

import { useServices } from "../../../app/presentation/ServicesProvider"

import { normalizeName } from "../../../shared/domain/validation"

import Dialog from "../../../shared/presentation/Dialog"

import ErrorNotice from "../../../shared/presentation/ErrorNotice"

import { useMutation } from "../../../shared/presentation/use-mutation"

import type { Product } from "../domain/catalog"

import ProductForm from "./ProductForm"

import ProductList from "./ProductList"

export default function CatalogPage() {
  const { menu, loading, error: loadError, reload } = useMenu()

  const services = useServices()
  const account = useAccount()

  const mutation = useMutation()

  const [search, setSearch] = useState("")

  const [categoryId, setCategoryId] = useState("")

  const [view, setView] = useState<"grid" | "table">("grid")

  const [editor, setEditor] = useState<{ product?: Product } | null>(null)

  const [deleting, setDeleting] = useState<{
    product: Product
    revision: number
  } | null>(null)

  const [notice, setNotice] = useState("")

  const blocked =
    loading || !!loadError || mutation.pending || account?.restaurant.role === "STAFF"

  const products = menu.products.filter(
    (product) =>
      (!categoryId || product.categoryId === categoryId) &&
      normalizeName(`${product.name} ${product.description}`).includes(
        normalizeName(search),
      ),
  )

  async function changeAvailability(product: Product) {
    if (blocked) return

    setNotice("")

    const result = await mutation.run(() =>
      services.catalog.setAvailability(
        menu.restaurant.id,
        menu.revision,
        product.id,
        !product.available,
      ),
    )

    if (result?.ok) setNotice("Disponibilidade salva.")
  }

  async function remove() {
    if (!deleting || blocked) return

    setNotice("")

    const result = await mutation.run(() =>
      services.catalog.delete(menu.restaurant.id, deleting.revision, deleting.product.id),
    )

    if (result?.ok) {
      setDeleting(null)
      setNotice("Produto excluído.")
    }
  }

  async function refreshDelete() {
    const latest = await reload()

    if (latest && deleting) setDeleting({ ...deleting, revision: latest.revision })

    mutation.clearError()
  }

  return (
    <div className="catalog-page">
      <PageHeading
        eyebrow="Seu catálogo"
        title="Gestão do Cardápio"
        description="Deixe seus produtos prontos para o próximo pedido."
      >
        <button
          type="button"
          className="primary-button"
          disabled={blocked}
          onClick={() => {
            setNotice("")
            setEditor({})
          }}
        >
          <Plus size={19} aria-hidden="true" /> Novo produto
        </button>
      </PageHeading>
      <div className="catalog-counts" aria-label="Resumo do catálogo">
        <div>
          <span className="stat-icon">
            <Package size={22} aria-hidden="true" />
          </span>
          <div>
            <span>Produtos no cardápio</span>
            <strong>{menu.products.length}</strong>
          </div>
          <small>Seu catálogo completo</small>
        </div>
        <div>
          <span className="stat-icon stat-icon--green">
            <CheckCircle2 size={22} aria-hidden="true" />
          </span>
          <div>
            <span>Disponíveis</span>
            <strong>{menu.products.filter((product) => product.available).length}</strong>
          </div>
          <small>Prontos para pedir</small>
        </div>
        <div>
          <span className="stat-icon stat-icon--amber">
            <PauseCircle size={22} aria-hidden="true" />
          </span>
          <div>
            <span>Esgotados</span>
            <strong>
              {menu.products.filter((product) => !product.available).length}
            </strong>
          </div>
          <small>Você pode reativar quando quiser</small>
        </div>
      </div>
      <section className="catalog-toolbar" aria-label="Busca e visualização">
        <div className="catalog-filters">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Buscar produtos"
              placeholder="Buscar por nome ou ingrediente…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            aria-label="Filtrar categoria"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Todas as categorias</option>
            {menu.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <div className="view-toggle">
            <button
              type="button"
              aria-label="Exibir cards"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              type="button"
              aria-label="Exibir tabela"
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </section>
      {notice && (
        <p className="success-notice" role="status">
          {notice}
        </p>
      )}
      {mutation.error && !deleting && (
        <ErrorNotice error={mutation.error} onRetry={() => void reload()} />
      )}
      {products.length ? (
        <ProductList
          categories={menu.categories}
          products={products}
          view={view}
          disabled={blocked}
          onEdit={(product) => {
            setNotice("")
            setEditor({ product })
          }}
          onDelete={(product) => {
            mutation.clearError()
            setDeleting({ product, revision: menu.revision })
          }}
          onAvailability={(product) => void changeAvailability(product)}
        />
      ) : (
        <div className="empty-search">
          <Search size={30} />
          <h2>Nenhum produto encontrado</h2>
          <p>
            {search || categoryId
              ? "Tente outro nome ou veja todas as categorias."
              : "Seu cardápio começa com o primeiro produto."}
          </p>
          {search || categoryId ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setSearch("")
                setCategoryId("")
              }}
            >
              Limpar filtros
            </button>
          ) : (
            <button
              className="primary-button"
              type="button"
              disabled={blocked}
              onClick={() => setEditor({})}
            >
              <Plus size={18} /> Cadastrar primeiro produto
            </button>
          )}
        </div>
      )}
      {editor && (
        <ProductForm
          product={editor.product}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            setNotice("Produto salvo com sucesso.")
          }}
        />
      )}
      {deleting && (
        <Dialog
          title="Excluir produto"
          onClose={() => setDeleting(null)}
          busy={mutation.pending}
        >
          <div className="editor-form">
            <p>Excluir “{deleting.product.name}” do cardápio?</p>
            <p>Os clientes precisarão remover este item de seus carrinhos.</p>
            {mutation.error && (
              <ErrorNotice error={mutation.error} onRetry={() => void refreshDelete()} />
            )}
            <div className="form-actions">
              <button
                className="secondary-button"
                disabled={mutation.pending}
                onClick={() => setDeleting(null)}
              >
                Cancelar
              </button>
              <button
                className="danger-button"
                disabled={blocked}
                onClick={() => void remove()}
              >
                {mutation.pending ? "Excluindo…" : "Confirmar exclusão"}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
