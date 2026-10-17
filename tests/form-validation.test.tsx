import { useState } from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { moneyField, passwordField } from "@cardapio/contracts"
import ValidatedForm from "../src/shared/presentation/form-validation/ValidatedForm"
import { InputField, SelectField } from "../src/shared/presentation/Fields"
function Form({ onSubmit }: { onSubmit(): void }) {
  const [name, setName] = useState(""),
    [price, setPrice] = useState("")
  return (
    <ValidatedForm
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <InputField
        label="Nome"
        validation="personName"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <InputField
        label="Preço"
        validation="money"
        schema={moneyField(true)}
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <InputField
        label="E-mail"
        name="email"
        type="email"
        defaultValue="JOAO@EXEMPLO.COM"
      />
      <InputField label="Telefone" name="phone" type="tel" defaultValue="11987654321" />
      <button>Salvar</button>
    </ValidatedForm>
  )
}
describe("accessible field validation", () => {
  it("blocks invalid submit, focuses the first error, associates feedback, and preserves values", async () => {
    const submit = vi.fn(),
      user = userEvent.setup()
    render(<Form onSubmit={submit} />)
    await user.type(screen.getByLabelText("Nome"), "123")
    await user.type(screen.getByLabelText("Preço"), "1,23abc")
    await user.click(screen.getByRole("button", { name: "Salvar" }))
    expect(submit).not.toHaveBeenCalled()
    const name = screen.getByLabelText("Nome")
    expect(name).toHaveFocus()
    expect(name).toHaveAttribute("aria-invalid", "true")
    expect(name).toHaveAccessibleDescription(expect.stringContaining("Use letras"))
    expect(screen.getByLabelText("Preço")).toHaveValue("1,23abc")
    await user.clear(name)
    await user.type(name, "Conceição")
    await user.clear(screen.getByLabelText("Preço"))
    await user.type(screen.getByLabelText("Preço"), "28.90")
    await user.click(screen.getByRole("button", { name: "Salvar" }))
    expect(submit).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText("Preço")).toHaveValue("28,90")
    expect(name).toHaveAttribute("aria-invalid", "false")
  })
  it("normalizes controlled and uncontrolled fields on blur, keeping passwords exact", async () => {
    const user = userEvent.setup()
    render(
      <>
        <Form onSubmit={() => {}} />
        <InputField
          label="Senha"
          type="password"
          schema={passwordField}
          defaultValue=" frase  "
        />
      </>,
    )
    await user.click(screen.getByLabelText("E-mail"))
    await user.tab()
    expect(screen.getByLabelText("E-mail")).toHaveValue("joao@exemplo.com")
    await user.tab()
    expect(screen.getByLabelText("Telefone")).toHaveValue("(11) 98765-4321")
    await user.click(screen.getByLabelText("Senha"))
    await user.tab()
    expect(screen.getByLabelText("Senha")).toHaveValue(" frase  ")
  })
  it("validates even when Enter submits an untouched form and clears unmounted field registrations", () => {
    const submit = vi.fn()
    const view = render(
      <ValidatedForm
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <InputField label="Obrigatório" required />
        <button>Salvar</button>
      </ValidatedForm>,
    )
    fireEvent.submit(screen.getByRole("button").closest("form")!)
    expect(submit).not.toHaveBeenCalled()
    view.rerender(
      <ValidatedForm
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <button>Salvar</button>
      </ValidatedForm>,
    )
    fireEvent.submit(screen.getByRole("button").closest("form")!)
    expect(submit).toHaveBeenCalledOnce()
  })
  it("ignores disabled fieldsets but rejects invalid selects and numeric exponents", async () => {
    const submit = vi.fn(),
      user = userEvent.setup()
    render(
      <ValidatedForm
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <fieldset disabled>
          <InputField label="Desabilitado" required />
        </fieldset>
        <SelectField label="Bairro" required defaultValue="">
          <option value="">Selecione</option>
          <option value="centro">Centro</option>
        </SelectField>
        <InputField
          label="Quantidade"
          type="number"
          min={1}
          max={20}
          defaultValue="1e1"
        />
        <button>Salvar</button>
      </ValidatedForm>,
    )
    await user.click(screen.getByRole("button"))
    expect(screen.getByLabelText("Bairro")).toHaveFocus()
    expect(screen.getByLabelText("Quantidade")).toHaveAttribute("aria-invalid", "true")
    await user.selectOptions(screen.getByLabelText("Bairro"), "centro")
    await user.clear(screen.getByLabelText("Quantidade"))
    await user.type(screen.getByLabelText("Quantidade"), "2")
    await user.click(screen.getByRole("button"))
    expect(submit).toHaveBeenCalledOnce()
  })
  it("reveals collapsed sections containing the first invalid field", async () => {
    const user = userEvent.setup()
    render(
      <ValidatedForm>
        <details>
          <summary>Mais opções</summary>
          <InputField label="Latitude" validation="coordinate" defaultValue="Infinity" />
        </details>
        <button>Salvar</button>
      </ValidatedForm>,
    )
    await user.click(screen.getByRole("button"))
    expect(screen.getByLabelText("Latitude").closest("details")).toHaveAttribute("open")
    expect(screen.getByLabelText("Latitude")).toHaveFocus()
  })
})
