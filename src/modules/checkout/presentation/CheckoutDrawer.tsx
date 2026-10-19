import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import { useState, type FormEvent } from "react"
import { Link } from "react-router"
import { CheckCircle2, MessageCircle, ShoppingBag } from "lucide-react"
import { emptyCommerce } from "@cardapio/domain/commerce"
import type { PreparedOrderView } from "@cardapio/contracts"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { formatMoney } from "../../../shared/domain/money"
import { useDraft } from "../../../shared/presentation/DraftsProvider"
import DraftNotice from "../../../shared/presentation/DraftNotice"
import Dialog from "../../../shared/presentation/Dialog"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import { InputField, ToggleField } from "../../../shared/presentation/Fields"
import { useMutation } from "../../../shared/presentation/use-mutation"
import { checkoutDraftSchema } from "../application/drafts"
import type { CartController } from "./use-cart"
import CartItems from "./CartItems"
import DeliveryForm from "./DeliveryForm"
import FulfillmentForm from "./FulfillmentForm"
import { useQuote } from "./use-quote"
import { useReceipts, trackingPath } from "./RecentOrders"
export default function CheckoutDrawer({
  controller,
  onClose,
}: {
  controller: CartController
  onClose(): void
}) {
  const { menu, loading, error: loadError, reload } = useMenu(),
    services = useServices(),
    mutation = useMutation(),
    api = services.mode === "api"
  const delivery = menu.commerce?.delivery ?? emptyCommerce().delivery
  const draft = useDraft(
    `${services.mode ?? "demo"}:customer:${menu.restaurant.id}:checkout`,
    {
      details: {
        name: "",
        phone: "",
        address: "",
        notes: "",
        payment: "Pix" as const,
        cashChange: "",
      },
      mode: delivery.enabled ? ("DELIVERY" as const) : ("PICKUP" as const),
      zoneId: "",
      couponCode: "",
      cep: "",
      whatsappConsent: false,
    },
    checkoutDraftSchema.parse,
  )
  const value = draft.value,
    details = value.details,
    receipts = useReceipts(menu.restaurant.id)
  const options = {
    whatsappConsent: api && value.whatsappConsent,
    fulfillment: {
      mode: value.mode,
      ...(value.zoneId && value.mode === "DELIVERY" ? { zoneId: value.zoneId } : {}),
    },
    couponCode: value.couponCode,
  }
  const pricing = useQuote(menu, controller.cart, options)
  const [resetting, setResetting] = useState(false)
  const [recoveryNotice, setRecoveryNotice] = useState("")
  const [prepared, setPrepared] = useState<
    (PreparedOrderView & { signature: string; recovered?: boolean }) | null
  >(null)
  const signature = JSON.stringify({
      revision: menu.revision,
      cart: controller.cart,
      details,
      options,
    }),
    blocked = loading || !!loadError || mutation.pending
  const canPrepare =
    !blocked &&
    !pricing.loading &&
    !!pricing.quote &&
    !draft.issue &&
    !controller.changed &&
    !controller.unavailable &&
    menu.restaurant.isOpen &&
    (api || menu.restaurant.whatsappConfigured) &&
    controller.cart.lines.length > 0 &&
    controller.subtotal >= menu.restaurant.minOrder
  const currentLink =
    prepared && !blocked && prepared.signature === signature ? prepared.url : null
  async function prepare(event: FormEvent) {
    event.preventDefault()
    if (!canPrepare || !pricing.quote) return
    setPrepared(null)
    const result = await mutation.run(() =>
      services.checkout.execute(
        menu.restaurant.id,
        menu.revision,
        controller.cart,
        details,
        { ...options, expectedTotal: pricing.quote!.total },
      ),
    )
    if (result?.ok) completed(result.value)
  }
  async function recover() {
    if (!services.checkout.recover) return
    const result = await mutation.run(() =>
      services.checkout.recover!(menu.restaurant.id),
    )
    if (result?.ok) {
      if (result.value) completed({ ...result.value, recovered: true })
      else
        setRecoveryNotice(
          "Ainda não há confirmação dessa tentativa. Você pode repetir o envio com os mesmos dados ou confirmar com a loja antes de liberar outra tentativa.",
        )
    }
  }
  function completed(value: PreparedOrderView & { recovered?: boolean }) {
    setPrepared({ ...value, signature })
    if (value.orderId && value.trackingToken) {
      const persisted = receipts.set((previous) =>
        [
          {
            orderId: value.orderId!,
            trackingToken: value.trackingToken!,
            createdAt: new Date().toISOString(),
          },
          ...previous.filter((r) => r.orderId !== value.orderId),
        ].slice(0, 10),
      )
      if (persisted) {
        if (!value.recovered) {
          controller.clear()
          draft.clear()
        }
        services.checkout.reset?.(menu.restaurant.id)
      }
    }
  }
  return (
    <Dialog
      title="Seu carrinho"
      onClose={onClose}
      busy={mutation.pending}
      className="checkout-dialog"
    >
      {!prepared && services.checkout.hasPending?.(menu.restaurant.id) && (
        <aside className="info-notice">
          <p>
            Há um envio anterior sem confirmação neste navegador. Você pode consultá-lo
            mesmo se a loja fechou ou o cardápio mudou.
          </p>
          <button
            type="button"
            className="secondary-button"
            disabled={mutation.pending}
            onClick={() => void recover()}
          >
            Recuperar envio anterior
          </button>
          <button
            type="button"
            className="text-button"
            disabled={mutation.pending}
            onClick={() => setResetting(true)}
          >
            Resolver tentativa pendente
          </button>
          {recoveryNotice && <p role="status">{recoveryNotice}</p>}
          {controller.cart.lines.length === 0 && mutation.error && (
            <ErrorNotice error={mutation.error} />
          )}
        </aside>
      )}
      {resetting && (
        <Dialog title="Revisar tentativa de envio" onClose={() => setResetting(false)}>
          <div className="editor-form">
            <p>
              Uma resposta pode ter se perdido depois de a loja receber o pedido. Só
              libere uma nova tentativa se você confirmou com a loja que o pedido anterior
              não foi registrado. Seus itens e endereço serão mantidos.
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setResetting(false)}
              >
                Voltar e conferir
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => {
                  services.checkout.reset?.(menu.restaurant.id)
                  mutation.clearError()
                  setResetting(false)
                }}
              >
                Confirmei com a loja: liberar tentativa
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {prepared?.orderId ? (
        <div className="empty-cart">
          <CheckCircle2 size={40} />
          <h3>
            {prepared.recovered
              ? "Seu envio anterior já foi registrado"
              : "Pedido enviado para a loja!"}
          </h3>
          {prepared.recovered && (
            <p>
              Recuperamos o pedido anterior. Os itens que você alterou continuam no
              carrinho para revisão.
            </p>
          )}
          {receipts.issue && <DraftNotice draft={receipts} />}
          <p>
            Seu número é <strong>#{prepared.orderId.slice(0, 8).toUpperCase()}</strong>.
            Aguarde a confirmação da loja. O pagamento será combinado diretamente com ela.
          </p>
          {prepared.trackingToken && (
            <Link
              className="primary-button"
              to={trackingPath(
                menu.restaurant.slug,
                prepared.orderId,
                prepared.trackingToken,
              )}
            >
              Acompanhar meu pedido
            </Link>
          )}
          {prepared.url && (
            <a
              className="secondary-button"
              href={prepared.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Conversar com a loja no WhatsApp
            </a>
          )}
          {prepared.recovered && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                controller.clear()
                draft.clear()
                onClose()
              }}
            >
              Limpar carrinho deste pedido e voltar
            </button>
          )}
          <button className="text-button" onClick={onClose}>
            Voltar ao cardápio
          </button>
        </div>
      ) : controller.cart.lines.length === 0 ? (
        <div className="empty-cart">
          <ShoppingBag size={38} />
          <h3>Seu carrinho está vazio</h3>
          <p>Adicione seus favoritos para começar o pedido.</p>
          {controller.draft.issue && <DraftNotice draft={controller.draft} />}
          <button type="button" onClick={onClose}>
            Explorar cardápio
          </button>
        </div>
      ) : (
        <ValidatedForm className="checkout-form" onSubmit={(e) => void prepare(e)}>
          {loadError && <ErrorNotice error={loadError} onRetry={() => void reload()} />}
          <p className="checkout-intro">Confira seus itens e escolha como receber.</p>
          <DraftNotice draft={draft} />
          {controller.draft.issue && <DraftNotice draft={controller.draft} />}
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
              Remova os produtos esgotados ou refaça as escolhas dos combos para
              continuar.
            </p>
          )}
          <FulfillmentForm
            value={options}
            cep={value.cep}
            onCep={(cep) => draft.set((v) => ({ ...v, cep }))}
            onAddress={(address) =>
              draft.set((v) => ({ ...v, details: { ...v.details, address } }))
            }
            onChange={(next) =>
              draft.set((v) => ({
                ...v,
                mode: next.fulfillment?.mode ?? "DELIVERY",
                zoneId: next.fulfillment?.zoneId ?? "",
              }))
            }
            disabled={blocked}
          />
          <DeliveryForm
            value={details}
            onChange={(details) => draft.set((v) => ({ ...v, details }))}
            disabled={blocked}
            pickup={value.mode === "PICKUP"}
            total={pricing.quote?.total}
          />
          {api && (
            <div className="checkout-consent">
              <ToggleField
                label="Quero receber atualizações deste pedido e dos pagamentos pelo WhatsApp"
                checked={value.whatsappConsent}
                disabled={blocked}
                onChange={(whatsappConsent) =>
                  draft.set((v) => ({ ...v, whatsappConsent }))
                }
              />
              <p className="field-help">
                Opcional. Se a loja ativou esse canal, enviaremos mensagens ao número
                informado. Você pode cancelar no acompanhamento do pedido.
              </p>
            </div>
          )}
          {!!menu.commerce?.promotions.length && (
            <InputField
              label="Cupom de desconto"
              validation="coupon"
              placeholder="Digite seu cupom"
              maxLength={30}
              value={value.couponCode}
              disabled={blocked}
              onChange={(e) =>
                draft.set((v) => ({ ...v, couponCode: e.target.value.toUpperCase() }))
              }
              help="Um benefício por pedido. Sem cupom, aplicamos a melhor promoção automática válida."
            />
          )}
          <div className="order-summary" aria-live="polite">
            <div>
              <span>Subtotal</span>
              <strong>{formatMoney(controller.subtotal)}</strong>
            </div>
            <div>
              <span>{value.mode === "PICKUP" ? "Retirada" : "Taxa de entrega"}</span>
              <strong>
                {pricing.quote ? formatMoney(pricing.quote.deliveryFee) : "A confirmar"}
              </strong>
            </div>
            {!!pricing.quote?.discount && (
              <div className="discount-line">
                <span>{pricing.quote.promotionName}</span>
                <strong>−{formatMoney(pricing.quote.discount)}</strong>
              </div>
            )}
            <div className="order-summary__total">
              <span>Total</span>
              <strong>
                {pricing.quote
                  ? formatMoney(pricing.quote.total)
                  : pricing.loading
                    ? "Calculando…"
                    : "Selecione a entrega"}
              </strong>
            </div>
            {pricing.quote && <small>Previsão: {pricing.quote.eta}</small>}
          </div>
          {pricing.error && (
            <ErrorNotice error={pricing.error} onRetry={() => void reload()} />
          )}
          {mutation.error && (
            <ErrorNotice error={mutation.error} onRetry={() => void reload()} />
          )}
          {controller.subtotal < menu.restaurant.minOrder && (
            <p className="info-notice">
              Pedido mínimo de {formatMoney(menu.restaurant.minOrder)} em produtos. Faltam{" "}
              {formatMoney(menu.restaurant.minOrder - controller.subtotal)}.
            </p>
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
              <MessageCircle size={19} />
              {mutation.pending
                ? "Validando pedido…"
                : api
                  ? "Enviar pedido para a loja"
                  : "Preparar pedido para WhatsApp"}
            </button>
            {currentLink && (
              <div className="checkout-ready">
                <p role="status">
                  <CheckCircle2 size={19} />
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
        </ValidatedForm>
      )}
    </Dialog>
  )
}
