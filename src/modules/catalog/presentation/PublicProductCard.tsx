import { AlertCircle, Check, Minus, Plus } from "lucide-react"
import { formatMoney } from "../../../shared/domain/money"
import ImageWithFallback from "../../../shared/presentation/ImageWithFallback"
import type { Product } from "../domain/catalog"

export default function PublicProductCard({
  product,
  quantity,
  disabled,
  onQuantityChange,
}: {
  product: Product
  quantity: number
  disabled: boolean
  onQuantityChange(delta: number): void
}) {
  return (
    <article
      className={`product-card ${product.available ? "" : "product-card--soldout"}`}
    >
      <div className="product-card__content">
        {product.popular && product.available && (
          <span className="popular-label">
            <Check size={13} strokeWidth={3} /> Mais pedido
          </span>
        )}
        {!product.available && (
          <span className="soldout-badge-text">
            <AlertCircle size={12} /> Esgotado
          </span>
        )}
        <h3>{product.name}</h3>
        <p>{product.description}</p>
        <strong>{formatMoney(product.price)}</strong>
      </div>
      <div className="product-card__media">
        <ImageWithFallback src={product.imageUrl} alt={product.name} />
        {!product.available ? (
          <>
            <div className="soldout-media-overlay">
              <span className="soldout-badge">Esgotado</span>
            </div>
            <span className="soldout-pill">Esgotado</span>
          </>
        ) : quantity === 0 ? (
          <button
            className="add-button"
            type="button"
            disabled={disabled}
            aria-label={`Adicionar ${product.name}`}
            onClick={() => onQuantityChange(1)}
          >
            <Plus size={21} strokeWidth={2.5} />
          </button>
        ) : (
          <div className="inline-stepper" aria-label={`Quantidade de ${product.name}`}>
            <button
              type="button"
              aria-label={`Remover uma unidade de ${product.name}`}
              disabled={disabled}
              onClick={() => onQuantityChange(-1)}
            >
              <Minus size={15} />
            </button>
            <span>{quantity}</span>
            <button
              type="button"
              aria-label={`Adicionar uma unidade de ${product.name}`}
              disabled={disabled || quantity >= 999}
              onClick={() => onQuantityChange(1)}
            >
              <Plus size={15} />
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
