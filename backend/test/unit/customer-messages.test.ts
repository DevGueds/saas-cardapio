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
  assert.match(text, /^\*Minha loja Mensagem falsa\*\n\*✅ Pedido recebido\*/)
  assert.match(text, /Pedido \*#ABCD1234\*/)
  assert.match(text, /Não é necessário reenviá-lo pelo WhatsApp/)
  assert.match(text, /20,22/)
  assert.match(text, /não confirma pagamento/)
  assert.match(text, /desative o WhatsApp/)
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
