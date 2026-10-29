import type { ReceiptKind } from "@cardapio/contracts"
export const receiptLabels: Record<ReceiptKind, string> = {
  ORDER: "Resumo do pedido",
  KITCHEN: "Comanda de preparo",
  DELIVERY: "Guia de entrega",
  PAYMENT: "Comprovante de recebimento",
}
export const receiptShortLabels: Record<ReceiptKind, string> = {
  ORDER: "Pedido",
  KITCHEN: "Cozinha",
  DELIVERY: "Entrega",
  PAYMENT: "Recebimento",
}
