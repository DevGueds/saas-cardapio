import { useState, type FormEvent } from "react"

import { CheckCircle2, MessageCircle, ShoppingBag } from "lucide-react"

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
  const api = services.mode === "api"

  const [details, setDetails] = useState(emptyDetails)

  const [prepared, setPrepared] = useState<{
    url: string
    orderId?: string
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
    (api || menu.restaurant.whatsappConfigured) &&
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
      onClose={() => {
        if (prepared?.orderId) {
          controller.clear()
          services.checkout.reset?.(menu.restaurant.id)
        }
        onClose()
      }}
      busy={mutation.pending}
      className="checkout-dialog"
    >
      {prepared?.orderId ? (
        <div className="empty-cart">
          <CheckCircle2 size={38} />
          <h3>Pedido enviado para a loja!</h3>
          <p>
            Seu número é <strong>#{prepared.orderId.slice(0, 8).toUpperCase()}</strong>.
            Aguarde a confirmação da loja. O pagamento será combinado diretamente com ela.
          </p>
          {prepared.url && (
            <a
              className="whatsapp-button"
              href={prepared.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Conversar com a loja no WhatsApp
            </a>
          )}
          <button
            className="primary-button"
            onClick={() => {
              controller.clear()
              services.checkout.reset?.(menu.restaurant.id)
              onClose()
            }}
          >
            Voltar ao cardápio
          </button>
        </div>
      ) : controller.cart.lines.length === 0 ? (
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
          <p className="checkout-intro">
            Confira seus itens e preencha os dados para entrega.
          </p>
          <div className="checkout-title">
            <span>1</span>
            <h3>Seu pedido</h3>
            <small>
              {controller.itemCount} {controller.itemCount === 1 ? "item" : "itens"}
            </small>
          </div>
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
          {!api && !menu.restaurant.whatsappConfigured && (
            <p className="info-notice">
              A loja ainda não configurou o WhatsApp para receber pedidos.
            </p>
          )}
          <div className="checkout-actions">
            <button
              className={currentLink ? "secondary-button" : "whatsapp-button"}
              disabled={!canPrepare}
            >
              <MessageCircle size={19} aria-hidden="true" />
              {mutation.pending
                ? "Validando pedido…"
                : api
                  ? "Enviar pedido para a loja"
                  : "Preparar pedido para WhatsApp"}
            </button>
            {currentLink && (
              <div className="checkout-ready">
                <p role="status">
                  <CheckCircle2 size={19} aria-hidden="true" />
                  Pedido preparado! Agora envie para a loja.
                </p>
                <a
                  className="whatsapp-button"
                  href={currentLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir WhatsApp e enviar pedido
                </a>
              </div>
            )}
            <p>
              {api
                ? "Ao enviar, o pedido será registrado no painel da loja. Aguarde a confirmação do restaurante; o envio não confirma pagamento."
                : "Confirme o envio no WhatsApp. A abertura do aplicativo não confirma recebimento ou pagamento."}
            </p>
          </div>
        </form>
      )}
    </Dialog>
  )
}
