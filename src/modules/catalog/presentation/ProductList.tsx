import ImageWithFallback from "../../../shared/presentation/ImageWithFallback"
import { Pencil, Trash2 } from "lucide-react"

import type { Category, Product } from "../domain/catalog"

import { formatMoney } from "../../../shared/domain/money"

interface Props {
  categories: readonly Category[]
  products: readonly Product[]
  view: "grid" | "table"
  disabled: boolean

  onEdit(product: Product): void
  onDelete(product: Product): void
  onAvailability(product: Product): void
}

function ProductActions({
  product,
  disabled,
  onEdit,
  onDelete,
  onAvailability,
}: Pick<Props, "disabled" | "onEdit" | "onDelete" | "onAvailability"> & {
  product: Product
}) {
  return (
    <div className="product-actions">
      <button
        className={`availability-button ${product.available ? "is-available" : ""}`}
        type="button"
        disabled={disabled}
        aria-label={`${product.available ? "Pausar" : "Disponibilizar"} ${product.name}`}
        onClick={() => onAvailability(product)}
      >
        {product.available ? "Disponível" : "Esgotado"}
      </button>
      <button
        className="action-icon"
        type="button"
        disabled={disabled}
        aria-label={`Editar ${product.name}`}
        onClick={() => onEdit(product)}
      >
        <Pencil size={17} />
      </button>
      <button
        className="action-icon danger"
        type="button"
        disabled={disabled}
        aria-label={`Excluir ${product.name}`}
        onClick={() => onDelete(product)}
      >
        <Trash2 size={17} />
      </button>
    </div>
  )
}

export default function ProductList(props: Props) {
  return (
    <div className="catalog-groups">
      {props.categories.map((category) => {
        const items = props.products.filter(
          (product) => product.categoryId === category.id,
        )

        if (!items.length) return null

        return (
          <section key={category.id} aria-labelledby={`category-${category.id}`}>
            <div className="catalog-group-title">
              <h2 id={`category-${category.id}`}>{category.name}</h2>
              <span>{items.length} itens</span>
            </div>
            {props.view === "grid" ? (
              <div className="management-grid">
                {items.map((product) => (
                  <article className="management-card" key={product.id}>
                    <div className="management-image">
                      <ImageWithFallback src={product.imageUrl} alt={product.name} />
                      {product.popular && (
                        <span className="management-featured">Mais vendido</span>
                      )}
                    </div>
                    <div className="management-details">
                      <h3>{product.name}</h3>
                      <p>{product.description || "Sem descrição"}</p>
                      <strong>{formatMoney(product.price)}</strong>
                      <ProductActions {...props} product={product} />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="table-scroll">
                <table className="catalog-table">
                  <caption className="sr-only">Produtos de {category.name}</caption>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Preço</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <strong>{product.name}</strong>
                          <small>{product.description}</small>
                        </td>
                        <td>{formatMoney(product.price)}</td>
                        <td>
                          <ProductActions {...props} product={product} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
