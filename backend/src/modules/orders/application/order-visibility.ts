import type { OrderView, Role } from "@cardapio/contracts"
/** Keep privacy rules identical for reads and mutation responses. */
export function visibleOrder(order: OrderView, role: Role): OrderView {
  if (role !== "KITCHEN" && role !== "VIEWER") return order
  return {
    ...order,
    ...(order.fulfillment
      ? {
          fulfillment: {
            mode: order.fulfillment.mode,
            ...(order.fulfillment.zoneId ? { zoneId: order.fulfillment.zoneId } : {}),
          },
        }
      : {}),
    items:
      role === "VIEWER"
        ? order.items.map((item) => ({ ...item, note: "" }))
        : order.items,
    customer: {
      ...order.customer,
      name: "Cliente",
      phone: "",
      address: "Dados restritos",
      cashChange: "",
      ...(role === "VIEWER" ? { notes: "" } : {}),
    },
  }
}
