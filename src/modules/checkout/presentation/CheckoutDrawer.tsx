import { useState, type FormEvent } from "react"

import { ShoppingBag } from "lucide-react"

import { useMenu } from "../../../app/presentation/MenuScope"

import { useServices } from "../../../app/presentation/ServicesProvider"

import { formatMoney } from "../../../shared/domain/money"

import Dialog from "../../../shared/presentation/Dialog"

import ErrorNotice from "../../../shared/presentation/ErrorNotice"

import { useMutation } from "../../../shared/presentation/use-mutation"

import type { DeliveryDetails } from "../domain/order-message"

import type { CartController } from "./use-cart"

import CartItems from "./CartItems"

import DeliveryForm from "./DeliveryForm"

const emptyDetails: DeliveryDetails = {
  name: "",
  phone: "",
  address: "",
  notes: "",
  payment: "Pix",
  cashChange: "",
}

export default function CheckoutDrawer({
  controller,
  onClose,
}: {
  controller: CartController
  onClose(): void
}) {
  const { menu, loading, error: loadError, reload } = useMenu()

  const services = useServices()

  const mutation = useMutation()

  const [details, setDetails] = useState(emptyDetails)

  const [prepared, setPrepared] = useState<{
    url: string
    revision: number
    cart: string
    details: string
  } | null>(null)

  const blocked = loading || !!loadError || mutation.pending

  const total = controller.subtotal + menu.restaurant.deliveryFee

  const canPrepare =
    !blocked &&
    !controller.changed &&
    !controller.unavailable &&
    menu.restaurant.isOpen &&
    menu.restaurant.whatsappConfigured &&
    controller.cart.lines.length > 0

  const currentLink =
    prepared &&
    !blocked &&
    prepared.revision === menu.revision &&
    prepared.cart === JSON.stringify(controller.cart) &&
    prepared.details === JSON.stringify(details)
      ? prepared.url
      : null

  async function prepare(event: FormEvent) {
    event.preventDefault()
    if (!canPrepare) return

    setPrepared(null)

    const cartSnapshot = controller.cart

    const detailsSnapshot = details

    const result = await mutation.run(() =>
      services.checkout.execute(
        menu.restaurant.id,
        menu.revision,
        cartSnapshot,
        detailsSnapshot,
      ),
    )

    if (result?.ok)
      setPrepared({
        ...result.value,
        cart: JSON.stringify(cartSnapshot),
        details: JSON.stringify(detailsSnapshot),
      })
  }

  return (
    <Dialog
      title="Seu carrinho"
      onClose={onClose}
      busy={mutation.pending}
      className="checkout-dialog"
    >
      {controller.cart.lines.length === 0 ? (
        <div className="empty-cart">
          <ShoppingBag size={38} />
          <h3>Seu carrinho está vazio</h3>
          <p>Adicione seus favoritos para começar o pedido.</p>
          <button type="button" onClick={onClose}>
            Explorar cardápio
          </button>
        </div>
      ) : (
        <form className="checkout-form" onSubmit={(event) => void prepare(event)}>
          {loadError && <ErrorNotice error={loadError} onRetry={() => void reload()} />}
          <CartItems
            controller={controller}
            products={menu.products}
            disabled={blocked}
          />
          {controller.changed && (
            <div role="alert" className="info-notice">
              O catálogo mudou: há produtos removidos ou preços atualizados. Confira os
              novos valores antes de continuar.
              <button
                type="button"
                className="secondary-button"
                disabled={blocked}
                onClick={controller.reconcile}
              >
                Atualizar itens do carrinho
              </button>
            </div>
          )}
          {controller.unavailable && !controller.changed && (
            <p className="error-notice" role="alert">
              Remova os produtos esgotados para continuar.
            </p>
          )}
          <DeliveryForm value={details} onChange={setDetails} disabled={blocked} />
          <div className="order-summary">
            <div>
              <span>Subtotal</span>
              <strong>{formatMoney(controller.subtotal)}</strong>
            </div>
            <div>
              <span>Taxa de entrega</span>
              <strong>{formatMoney(menu.restaurant.deliveryFee)}</strong>
            </div>
            <div className="order-summary__total">
              <span>Total</span>
              <strong>{formatMoney(total)}</strong>
            </div>
          </div>
          {mutation.error && (
            <ErrorNotice error={mutation.error} onRetry={() => void reload()} />
          )}
          {!menu.restaurant.isOpen && (
            <p className="error-notice">
              A loja está fechada e não está recebendo pedidos.
            </p>
          )}
          {!menu.restaurant.whatsappConfigured && (
            <p className="info-notice">
              A loja ainda não configurou o WhatsApp para receber pedidos.
            </p>
          )}
          <div className="checkout-actions">
            <button className="whatsapp-button" disabled={!canPrepare}>
              {mutation.pending ? "Validando pedido…" : "Preparar pedido para WhatsApp"}
            </button>
            {currentLink && (
              <a
                className="whatsapp-button"
                href={currentLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir WhatsApp e enviar pedido
              </a>
            )}
            <p>
              Confirme o envio no WhatsApp. A abertura do aplicativo não confirma
              recebimento ou pagamento.
            </p>
          </div>
        </form>
      )}
    </Dialog>
  )
}
