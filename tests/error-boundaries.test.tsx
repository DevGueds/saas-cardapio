import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import FeatureBoundary from "../src/shared/presentation/FeatureBoundary"

test("a broken region preserves siblings, shows a safe diagnostic and retries locally", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
  let broken = true
  function Region() {
    if (broken) throw new Error("private-customer-value")
    return <p>Região recuperada</p>
  }
  const report = vi.fn(async () => ({
    ok: false as const,
    error: {
      code: "UNEXPECTED" as const,
      message: "Falha ao exibir esta área.",
      fields: {},
      diagnosticId: "diag-local-1",
    },
  }))
  try {
    render(
      <>
        <button>Outra área disponível</button>
        <FeatureBoundary label="Histórico" report={report}>
          <Region />
        </FeatureBoundary>
      </>,
    )
    expect(screen.getByRole("button", { name: "Outra área disponível" })).toBeEnabled()
    await waitFor(() => expect(report).toHaveBeenCalledTimes(1))
    await userEvent.click(screen.getByText("Detalhes do diagnóstico"))
    expect(screen.getByText(/diag-local-1/)).toBeVisible()
    expect(screen.queryByText(/private-customer-value/)).not.toBeInTheDocument()
    broken = false
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(screen.getByText("Região recuperada")).toBeVisible()
  } finally {
    consoleError.mockRestore()
  }
})
