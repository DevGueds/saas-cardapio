import { test } from "node:test"
import assert from "node:assert/strict"
import {
  customerMessageRelevant,
  customerWhatsappMessage,
} from "../../src/modules/engagement/application/customer-messages.js"

const order = {
  status: "NEW",
  fulfillment: { mode: "DELIVERY" },
  total: 2022,
  subtotal: 2000,
  deliveryFee: 222,
  discount: 200,
  items: [
    {
      productId: "123e4567-e89b-42d3-a456-426614174000",
      name: "Lanche *especial*",
      quantity: 2,
      unitPrice: 1000,
      note: "Informação privada",
      components: ["Queijo extra"],
    },
  ],
  eta: "30–40 min",
  restaurant: { name: "Minha *loja*\n_Mensagem falsa_" },
}
const event = { kind: "ORDER", status: "NEW", orderId: "abcd1234-1234" }

test("customer alerts select actionable stages and suppress outdated or routine events", () => {
  for (const status of [
    "NEW",
    "PREPARING",
    "READY",
    "OUT_FOR_DELIVERY",
    "COMPLETED",
    "CANCELLED",
  ]) {
    assert.equal(
      customerMessageRelevant({ ...event, status }, { ...order, status }),
      ["NEW", "OUT_FOR_DELIVERY", "CANCELLED"].includes(status),
    )
  }
  assert.equal(
    customerMessageRelevant(
      { ...event, status: "READY" },
      {
        ...order,
        status: "READY",
        fulfillment: { mode: "PICKUP" },
      },
    ),
    true,
  )
  assert.equal(
    customerMessageRelevant(
      { ...event, status: "OUT_FOR_DELIVERY" },
      {
        ...order,
        status: "COMPLETED",
      },
    ),
    false,
  )
  assert.equal(customerMessageRelevant(event, { ...order, status: "CANCELLED" }), false)
  assert.equal(customerMessageRelevant({ ...event, kind: "SUBSCRIBED" }, order), true)
})

test("automatic confirmation is formatted, identifies the order and does not require a manual message", () => {
  const text = customerWhatsappMessage(event, order)
  assert.match(text, /^\*✅ Pedido recebido\*\n\*Minha loja Mensagem falsa\*/)
  assert.match(text, /Pedido \*#ABCD1234\*/)
  assert.match(text, /Não é necessário reenviá-lo pelo WhatsApp/)
  assert.match(text, /20,22/)
  assert.match(text, /não confirma pagamento/)
  assert.match(text, /desative o WhatsApp/)
  assert.match(text, /2 × Lanche especial · R\$\s20,00/)
  assert.match(text, /Queijo extra/)
  assert.match(text, /Taxa de entrega: R\$\s2,22/)
  assert.match(text, /Desconto: −R\$\s2,00/)
  assert.match(text, /Prazo estimado na confirmação/)
  assert.doesNotMatch(text, /Informação privada/)
})

test("milestones stay brief, give a next action and never restart the original ETA", () => {
  const delivery = customerWhatsappMessage(
    { ...event, status: "OUT_FOR_DELIVERY" },
    { ...order, status: "OUT_FOR_DELIVERY" },
  )
  assert.match(delivery, /Fique disponível para receber/)
  assert.doesNotMatch(delivery, /30–40|Resumo do pedido|Lanche/)
  const pickup = customerWhatsappMessage(
    { ...event, status: "READY" },
    { ...order, status: "READY", fulfillment: { mode: "PICKUP" } },
  )
  assert.match(pickup, /Informe o número do pedido/)
  assert.doesNotMatch(pickup, /30–40|endereço|Taxa de entrega/)
  const initialPickup = customerWhatsappMessage(event, {
    ...order,
    deliveryFee: 0,
    total: 1800,
    fulfillment: { mode: "PICKUP" },
  })
  assert.match(initialPickup, /Retirada no estabelecimento/)
  assert.match(initialPickup, /Total do pedido: \*R\$\s18,00\*/)
  assert.doesNotMatch(initialPickup, /Taxa de entrega|endereço/)
  assert.throws(() =>
    customerWhatsappMessage(event, { ...order, fulfillment: { mode: "PICKUP" } }),
  )
})

test("long carts are bounded and corrupt receipt totals cannot be sent as valid amounts", () => {
  const item = order.items[0]!
  const many = {
    ...order,
    subtotal: 200000,
    total: 200022,
    items: Array.from({ length: 100 }, () => ({
      ...item,
      name: "N".repeat(120),
      components: Array.from({ length: 60 }, () => "C".repeat(250)),
    })),
  }
  const text = customerWhatsappMessage(event, many)
  assert.equal(text.split("\n").filter((line) => line.startsWith("- ")).length, 6)
  assert.match(text, /Outros produtos e detalhes/)
  assert.ok(text.length < 2500)
  assert.throws(() => customerWhatsappMessage(event, { ...order, subtotal: 1999 }))
  assert.throws(() => customerWhatsappMessage(event, { ...order, total: 2023 }))
  assert.throws(() => customerWhatsappMessage(event, { ...order, items: [] }))
})

test("financial messages distinguish partial receipts, settlement, cancellation and reversal", () => {
  const payment = { ...event, kind: "PAYMENT" }
  const partial = customerWhatsappMessage(payment, order, 1011)
  assert.match(partial, /Saldo a pagar: \*R\$\s10,11\*/)
  assert.match(partial, /ainda não está quitado/)
  const full = customerWhatsappMessage(payment, order, 2022)
  assert.match(full, /Saldo a pagar: \*R\$\s0,00\*/)
  assert.match(full, /Quitado nos registros da loja/)
  const cancelled = customerWhatsappMessage(
    { ...event, kind: "REVERSAL" },
    { ...order, status: "CANCELLED" },
    1000,
  )
  assert.match(cancelled, /não realiza um estorno bancário/)
  assert.match(cancelled, /sem saldo a cobrar/)
  assert.doesNotMatch(cancelled, /Saldo a pagar|Quitado nos registros/)
  for (const bad of [NaN, 10.1, -1, 2023])
    assert.throws(() => customerWhatsappMessage(payment, order, bad))
})
