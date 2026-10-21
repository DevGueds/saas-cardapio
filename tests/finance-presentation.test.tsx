import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { PaymentView, ReportOrder } from "@cardapio/contracts"
import PaymentTable from "../src/modules/payments/presentation/PaymentTable"
import ReportOrders from "../src/modules/payments/presentation/ReportOrders"
import { financeTime } from "../src/modules/payments/presentation/payment-labels"

vi.mock("../src/modules/payments/presentation/payment-labels", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("../src/modules/payments/presentation/payment-labels")
    >()
  return { ...original, financeTime: vi.fn(original.financeTime) }
})
const orders: ReportOrder[] = Array.from({ length: 120 }, (_, index) => ({
  id: `order-${String(index).padStart(3, "0")}`,
  createdAt: "2026-10-20T12:00:00Z",
  status: index === 119 ? "CANCELLED" : "NEW",
  subtotal: 1001,
  deliveryFee: 101,
  discount: 0,
  total: 1102,
  paid: index === 118 ? 1102 : 0,
  fulfillment: "DELIVERY",
}))
describe("financial detail and render isolation", () => {
  it("searches all report orders, paginates and never shows cancelled orders as debt", () => {
    render(<ReportOrders orders={orders} />)
    expect(screen.getAllByRole("row")).toHaveLength(26)
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }))
    expect(screen.getByText("Página 2 de 5")).toBeInTheDocument()
  })
  it("finds a receipt beyond the old 100-order preview and filters current balances precisely", () => {
    render(<ReportOrders orders={orders} />)
    fireEvent.change(screen.getByLabelText("Buscar número do pedido"), {
      target: { value: "119" },
    })
    expect(screen.getAllByRole("row")).toHaveLength(2)
    expect(screen.getByText("Cancelado · sem cobrança")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Buscar número do pedido"), {
      target: { value: "" },
    })
    fireEvent.change(screen.getByLabelText("Saldo do pedido"), {
      target: { value: "settled" },
    })
    expect(screen.getAllByRole("row")).toHaveLength(2)
    expect(screen.queryByText("Cancelado · sem cobrança")).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Saldo do pedido"), {
      target: { value: "pending" },
    })
    expect(screen.getByRole("status")).toHaveTextContent("118 de 120 pedidos")
  })
  it("does not recalculate a 100-receipt table during unrelated modal edits, but refreshes changed data", () => {
    const payments: PaymentView[] = Array.from({ length: 100 }, (_, i) => ({
      id: `payment-${i}`,
      orderId: null,
      amount: 101,
      method: "PIX",
      description: `Venda ${i}`,
      createdAt: "2026-10-20T12:00:00Z",
      recordedBy: "owner",
      reversedAt: null,
      reversedBy: null,
      reversalReason: null,
    }))
    const onReverse = vi.fn(),
      props = { payments, reverse: true, disabled: false, onReverse }
    const view = render(
      <>
        <input aria-label="Texto do modal" defaultValue="" />
        <PaymentTable {...props} />
      </>,
    )
    vi.mocked(financeTime).mockClear()
    for (let i = 0; i < 20; i++)
      view.rerender(
        <>
          <input aria-label="Texto do modal" defaultValue={String(i)} />
          <PaymentTable {...props} />
        </>,
      )
    expect(financeTime).not.toHaveBeenCalled()
    view.rerender(
      <PaymentTable
        {...props}
        payments={[{ ...payments[0]!, amount: 202 }, ...payments.slice(1)]}
      />,
    )
    expect(within(screen.getAllByRole("row")[1]!).getByText(/2,02/)).toBeInTheDocument()
    fireEvent.click(
      within(screen.getAllByRole("row")[1]!).getByRole("button", { name: "Reverter" }),
    )
    expect(onReverse).toHaveBeenCalledWith(expect.objectContaining({ amount: 202 }))
  })
})
