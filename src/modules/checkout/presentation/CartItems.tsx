import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react"

import type { Product } from "../../catalog/domain/catalog"

import { formatMoney } from "../../../shared/domain/money"

import type { CartController } from "./use-cart"

export default function CartItems({
  controller,
  products,
  disabled,
}: {
  controller: CartController
  products: readonly Product[]
  disabled: boolean
}) {
  return (
    <div className="cart-items">
      {controller.cart.lines.map((line) => {
        const product = products.find((item) => item.id === line.productId)

        const name = product?.name ?? "Produto removido do cardápio"

        return (
          <div className="cart-item" key={line.productId}>
            {product?.imageUrl ? (
              <img src={product.imageUrl} alt="" />
            ) : (
              <ShoppingBag size={32} />
            )}
            <div className="cart-item__info">
              <h3>
                {name}
                {!product?.available && (
                  <small className="unavailable-label"> · Indisponível</small>
                )}
              </h3>
              <strong>{formatMoney(line.unitPrice * line.quantity)}</strong>
              <input
                className="item-note"
                aria-label={`Observação para ${name}`}
                maxLength={500}
                placeholder="Adicionar observação"
                disabled={disabled}
                value={line.note}
                onChange={(event) =>
                  controller.setNote(line.productId, event.target.value)
                }
              />
            </div>
            <div className="quantity-stepper">
              <button
                type="button"
                aria-label={`Diminuir ${name}`}
                disabled={disabled}
                onClick={() => controller.updateQuantity(line.productId, -1)}
              >
                {line.quantity === 1 ? <Trash2 size={15} /> : <Minus size={15} />}
              </button>
              <span aria-live="polite">{line.quantity}</span>
              <button
                type="button"
                aria-label={`Aumentar ${name}`}
                disabled={disabled || !product?.available || line.quantity >= 999}
                onClick={() => controller.updateQuantity(line.productId, 1)}
              >
                <Plus size={15} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
