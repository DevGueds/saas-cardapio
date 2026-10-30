import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import TurnstileChallenge from "../src/shared/presentation/TurnstileChallenge"
afterEach(() => {
  Reflect.deleteProperty(window, "turnstile")
})
describe("Turnstile UI", () => {
  it("clears expired tokens, retries errors, resets when switching actions and removes the widget", async () => {
    const renderWidget = vi.fn().mockReturnValue("widget"),
      remove = vi.fn(),
      onToken = vi.fn()
    Object.assign(window, { turnstile: { render: renderWidget, remove } })
    const view = render(
      <TurnstileChallenge siteKey="test-site" action="register" onToken={onToken} />,
    )
    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(1))
    let options = renderWidget.mock.calls[0]![1]
    expect(options.action).toBe("register")
    expect(options.size).toBe("compact")
    act(() => options.callback("proof"))
    expect(onToken).toHaveBeenLastCalledWith("proof")
    act(() => options["expired-callback"]())
    expect(onToken).toHaveBeenLastCalledWith("")
    act(() => options["error-callback"]())
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível concluir")
    fireEvent.click(screen.getByRole("button", { name: "Tentar verificação novamente" }))
    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(2))
    view.rerender(
      <TurnstileChallenge siteKey="test-site" action="login" onToken={onToken} />,
    )
    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(3))
    options = renderWidget.mock.calls[2]![1]
    expect(options.action).toBe("login")
    expect(onToken).toHaveBeenLastCalledWith("")
    view.unmount()
    expect(remove).toHaveBeenCalledTimes(3)
  })
  it("keeps an actionable error and a working retry if the external script cannot load", async () => {
    const onToken = vi.fn()
    const view = render(
      <TurnstileChallenge siteKey="test-site" action="login" onToken={onToken} />,
    )
    const script = document.querySelector(
      'script[src^="https://challenges.cloudflare.com/"]',
    )!
    expect(script).not.toBeNull()
    fireEvent.error(script)
    expect(await screen.findByRole("alert")).toHaveTextContent("Confira sua conexão")
    fireEvent.click(screen.getByRole("button", { name: "Tentar verificação novamente" }))
    const retry = document.querySelector(
      'script[src^="https://challenges.cloudflare.com/"]',
    )!
    expect(retry).not.toBe(script)
    fireEvent.error(retry)
    await screen.findByRole("alert")
    expect(onToken).toHaveBeenLastCalledWith("")
    view.unmount()
  })
})
