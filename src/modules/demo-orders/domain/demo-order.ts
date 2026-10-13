export type DemoOrderStatus = "new" | "preparing" | "delivery"

export type DemoOrder = Readonly<{
  id: string
  time: string
  customer: string
  items: readonly string[]
  total: number

  paymentMethod: string
  paymentStatus: "confirmed" | "pending"
  status: DemoOrderStatus
}>

export function advanceDemoOrder(order: DemoOrder): DemoOrder {
  return { ...order, status: order.status === "new" ? "preparing" : "delivery" }
}
