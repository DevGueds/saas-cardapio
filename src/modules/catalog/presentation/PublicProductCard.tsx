import { AlertCircle, Flame, Minus, Plus } from "lucide-react"
import { memo } from "react"
import { formatMoney } from "../../../shared/domain/money"
import ImageWithFallback from "../../../shared/presentation/ImageWithFallback"
import type { Product } from "../domain/catalog"

function PublicProductCard({
  product,
  quantity,
  disabled,
  onQuantityChange,
  onCustomize,
}: {
  product: Product
  quantity: number
  disabled: boolean
  onQuantityChange(productId: string, delta: number): void
  onCustomize?: (productId: string) => void
}) {
  return (
    <article
      className={`product-card ${product.available ? "" : "product-card--soldout"} ${quantity ? "product-card--selected" : ""}`}
    >
      <div className="product-card__media">
        <ImageWithFallback src={product.imageUrl} alt={product.name} />
      </div>
      <div className="product-card__content">
        {product.popular && product.available && (
          <span className="popular-label">
            <Flame size={13} aria-hidden="true" /> Destaque da loja
          </span>
        )}
        {!product.available && (
          <span className="soldout-badge-text">
            <AlertCircle size={14} aria-hidden="true" /> Esgotado
          </span>
        )}
        <h3>{product.name}</h3>
        <p>{product.description}</p>
        <div className="product-card__bottom">
          <strong>{formatMoney(product.price)}</strong>
          {!product.available ? (
            <span className="soldout-pill">Indisponível</span>
          ) : onCustomize ? (
            <button
              type="button"
              className="add-button"
              disabled={disabled}
              onClick={() => onCustomize(product.id)}
              aria-label={`Adicionar ${product.name}`}
            >
              <Plus size={17} />
              <span>Adicionar{quantity ? ` (${quantity})` : ""}</span>
            </button>
          ) : quantity === 0 ? (
            <button
              className="add-button"
              type="button"
              disabled={disabled}
              aria-label={`Adicionar ${product.name}`}
              onClick={() => onQuantityChange(product.id, 1)}
            >
              <Plus size={17} aria-hidden="true" />
              <span>Adicionar</span>
            </button>
          ) : (
            <div
              className="inline-stepper"
              role="group"
              aria-label={`Quantidade de ${product.name}`}
            >
              <button
                type="button"
                aria-label={`Remover uma unidade de ${product.name}`}
                disabled={disabled}
                onClick={() => onQuantityChange(product.id, -1)}
              >
                <Minus size={17} />
              </button>
              <span aria-live="polite">{quantity}</span>
              <button
                type="button"
                aria-label={`Adicionar uma unidade de ${product.name}`}
                disabled={disabled || quantity >= 999}
                onClick={() => onQuantityChange(product.id, 1)}
              >
                <Plus size={17} />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
export default memo(PublicProductCard)
