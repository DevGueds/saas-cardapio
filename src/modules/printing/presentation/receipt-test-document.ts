import type { PrintingSettings, ReceiptDocument, ReceiptKind } from "@cardapio/contracts"

/** Only the explicitly labelled printer test uses synthetic data. */
export function receiptTestDocument(
  settings: PrintingSettings,
  kind: ReceiptKind,
  profileId: string,
): ReceiptDocument {
  const now = new Date().toISOString()
  const kitchen = kind === "KITCHEN",
    payment = kind === "PAYMENT"
  return {
    profile: settings.profiles.find((p) => p.id === profileId) ?? settings.profiles[0]!,
    template: settings.templates[kind],
    snapshot: {
      kind,
      generatedAt: now,
      restaurant: {
        id: "00000000-0000-4000-8000-000000000001",
        name: "TESTE — DADOS FICTÍCIOS — NÃO PREPARAR",
        address: "Endereço fictício para conferir alinhamento",
        phone: "",
        logo: settings.logo,
      },
      source: {
        orderId: "00000000-0000-4000-8000-000000000002",
        paymentId: payment ? "00000000-0000-4000-8000-000000000003" : null,
        orderRevision: 1,
        createdAt: now,
        status: "NEW",
        paymentStatus: payment ? "VALID" : null,
      },
      customer: kitchen
        ? null
        : {
            name: "Cliente de teste",
            phone: "",
            address:
              "Rua de exemplo, 123 — Bairro de teste\nCidade de teste / SP — referência: portão azul",
            notes: "Dados fictícios. Não preparar nem entregar.",
            payment: "Pix",
            cashChange: "",
          },
      items: payment
        ? []
        : [
            {
              name: "Lanche de teste com descrição longa para conferir a quebra de linha",
              quantity: 2,
              unitPrice: kitchen ? null : 1001,
              total: kitchen ? null : 2002,
              components: ["Adicional de teste incluído no preço"],
              note: "Sem cebola — observação de teste",
            },
          ],
      totals: kitchen
        ? null
        : {
            subtotal: 2002,
            deliveryFee: 200,
            discount: 102,
            total: 2100,
            paid: 1001,
            outstanding: 1099,
          },
      payment: payment
        ? {
            amount: 1001,
            method: "PIX",
            description: "Registro fictício para teste",
            createdAt: now,
            reversedAt: null,
            reversalReason: null,
          }
        : null,
      notes: kitchen ? "" : "TESTE — nenhum pedido ou recebimento foi registrado.",
    },
  }
}
