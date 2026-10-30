import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { passwordField, currentPasswordField } from "@cardapio/contracts"
import { passwordStrength } from "@cardapio/domain/password-strength"
import PasswordFields from "../src/modules/identity/presentation/PasswordFields"
import ValidatedForm from "../src/shared/presentation/form-validation/ValidatedForm"

describe("password policy and live feedback", () => {
  it("keeps eight characters as the minimum, rejects common passwords and preserves exact Unicode and spaces", () => {
    for (const value of [
      "12345678",
      "Password1!",
      "S3nh4!2026",
      "Qwerty9!",
      "abc123!A",
      "aaaaaaaA1!",
      "🍕".repeat(8),
      "x".repeat(129),
    ]) {
      expect(passwordField.safeParse(value).success, value).toBe(false)
      expect(passwordStrength(value).accepted, value).toBe(false)
    }
    for (const value of [
      "M7!qR2@x",
      " Frase-9!  ",
      "café manga lua estrela",
      "🍕Ma9!rQ🍋",
    ]) {
      expect(passwordField.parse(value)).toBe(value)
      expect(passwordStrength(value).accepted).toBe(true)
    }
    // Existing passwords remain usable for login, regardless of the new signup policy.
    expect(currentPasswordField.parse("12345678")).toBe("12345678")
    expect(passwordStrength("M7!qR2@x").level).toBe("medium")
    expect(passwordStrength("R8!xQ2@kL5#z").level).toBe("strong")
    expect(passwordStrength("café manga lua estrela vento").level).toBe("very-strong")
  })
  it("announces strength, blocks weak or mismatched values, and keeps the exact password when showing it", () => {
    const submit = vi.fn()
    render(
      <ValidatedForm
        onSubmit={(event) => {
          event.preventDefault()
          submit(new FormData(event.currentTarget))
        }}
      >
        <PasswordFields />
        <button>Continuar</button>
      </ValidatedForm>,
    )
    const password = screen.getByLabelText("Senha *", { exact: true })
    const confirmation = screen.getByLabelText("Confirme a senha *", { exact: true })
    fireEvent.change(password, { target: { value: "12345678" } })
    fireEvent.change(confirmation, { target: { value: "12345678" } })
    expect(screen.getByText("Fraca", { exact: true })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }))
    expect(submit).not.toHaveBeenCalled()
    fireEvent.change(password, { target: { value: "M7!qR2@x" } })
    expect(screen.getByText("Média", { exact: true })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }))
    expect(submit).not.toHaveBeenCalled()
    expect(confirmation).toHaveAttribute("aria-invalid", "true")
    fireEvent.change(confirmation, { target: { value: "M7!qR2@x" } })
    fireEvent.click(screen.getByRole("button", { name: "Mostrar senhas" }))
    expect(password).toHaveAttribute("type", "text")
    expect(password).toHaveValue("M7!qR2@x")
    expect(screen.getByText("As senhas coincidem.")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }))
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit.mock.calls[0]![0].get("password")).toBe("M7!qR2@x")
  })
})
