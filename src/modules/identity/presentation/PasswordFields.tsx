import { useId, useState } from "react"
import { z } from "zod"
import { passwordField } from "@cardapio/contracts"
import { passwordStrength } from "@cardapio/domain/password-strength"
import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"

const labels = {
  empty: "Ainda não informada",
  weak: "Fraca",
  medium: "Média",
  strong: "Forte",
  "very-strong": "Muito forte",
}
const scores = { empty: 0, weak: 1, medium: 2, strong: 3, "very-strong": 4 }
export default function PasswordFields({
  name = "password",
  label = "Senha *",
}: {
  name?: string
  label?: string
}) {
  const id = useId()
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [visible, setVisible] = useState(false)
  const strength = passwordStrength(password)
  return (
    <div className="password-fields">
      <div className="field">
        <label htmlFor={`${id}-password`}>{label}</label>
        <div className="password-control">
          <ValidatedInput
            id={`${id}-password`}
            name={name}
            schema={passwordField}
            type={visible ? "text" : "password"}
            required
            autoComplete="new-password"
            autoCapitalize="none"
            spellCheck={false}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={`${id}-help ${id}-strength`}
          />
          <button
            type="button"
            className="password-visibility"
            aria-label={visible ? "Ocultar senhas" : "Mostrar senhas"}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        <div className="password-meter" data-strength={strength.level} aria-hidden="true">
          {[1, 2, 3, 4].map((part) => (
            <span key={part} data-filled={part <= scores[strength.level]} />
          ))}
        </div>
        <p
          id={`${id}-strength`}
          className="password-strength"
          role="status"
          aria-live="polite"
        >
          Força da senha: <strong>{labels[strength.level]}</strong>
          {strength.accepted ? " · Pode continuar" : ""}
        </p>
        <small className="field-help" id={`${id}-help`}>
          Use de 8 a 128 caracteres. Aceitamos força média ou maior. Misture maiúsculas,
          minúsculas, números e símbolos; uma frase longa com palavras diferentes também
          ajuda. Evite sequências, repetições e senhas comuns.
        </small>
      </div>
      <label className="field" htmlFor={`${id}-confirmation`}>
        <span>Confirme a senha *</span>
        <ValidatedInput
          id={`${id}-confirmation`}
          name="passwordConfirmation"
          type={visible ? "text" : "password"}
          required
          autoComplete="new-password"
          autoCapitalize="none"
          spellCheck={false}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          schema={z
            .string()
            .min(1, "Repita a senha para confirmar.")
            .refine(
              (value) => value === password,
              "As senhas precisam ser iguais. Confira os dois campos.",
            )}
          aria-describedby={`${id}-match`}
        />
        <small className="field-help" id={`${id}-match`} role="status">
          {confirmation
            ? confirmation === password
              ? "As senhas coincidem."
              : "As senhas ainda não coincidem."
            : "Digite a mesma senha novamente."}
        </small>
      </label>
    </div>
  )
}
