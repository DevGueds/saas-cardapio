import { memo, useLayoutEffect, useRef, useState } from "react"
import {
  postalCodeField,
  type AppError,
  type PostalAddress,
  type Result,
} from "@cardapio/contracts"
import { InputField } from "../../shared/presentation/Fields"
import ErrorNotice from "../../shared/presentation/ErrorNotice"
import { useServices } from "./ServicesProvider"

function PostalCodeLookup({
  value,
  onChange,
  onFound,
  contextKey,
  disabled = false,
  label = "CEP (opcional)",
  section = "shipping",
  help = "Ao sair do campo, buscamos o endereço. Confira os dados e informe o número.",
}: {
  value: string
  onChange(value: string): void
  onFound(address: PostalAddress): void
  contextKey: string
  disabled?: boolean
  label?: string
  section?: string
  help?: string
}) {
  const { maps, reportUnexpected } = useServices()
  const digits = value.replace(/\D/g, "")
  const currentKey = `${contextKey}:${digits}:${disabled}`
  const generation = useRef({ value: 0 }),
    lastAutomatic = useRef(""),
    active = useRef<{ key: string; request: number } | null>(null)
  const [state, setState] = useState<{
    key: string
    pending: boolean
    error: AppError | null
  }>({ key: currentKey, pending: false, error: null })
  // Reset feedback when inputs change, including A → B → A while a request is pending.
  if (state.key !== currentKey) setState({ key: currentKey, pending: false, error: null })
  useLayoutEffect(() => {
    const counter = generation.current
    counter.value++
    active.current = null
    return () => {
      counter.value++
    }
  }, [currentKey])
  const pending = state.pending && state.key === currentKey
  async function lookup(automatic = false, input = value) {
    const cep = input.replace(/\D/g, "")
    if (
      disabled ||
      !maps ||
      !postalCodeField.safeParse(input).success ||
      active.current?.key === currentKey
    )
      return
    if (automatic && lastAutomatic.current === cep) return
    lastAutomatic.current = cep
    const request = ++generation.current.value
    active.current = { key: currentKey, request }
    setState({ key: currentKey, pending: true, error: null })
    let result: Result<PostalAddress>
    try {
      result = await maps.lookup(cep)
    } catch (error) {
      result = await reportUnexpected(error)
    }
    if (active.current?.request === request) active.current = null
    if (request !== generation.current.value) return
    setState({
      key: currentKey,
      pending: false,
      error: result.ok ? null : result.error,
    })
    if (result.ok) onFound(result.value)
  }
  return (
    <div className="postal-lookup">
      <div className="postal-search">
        <InputField
          label={label}
          name={`${section}-postal-code`}
          autoComplete={`section-${section} shipping postal-code`}
          inputMode="numeric"
          validation="cep"
          maxLength={9}
          value={value}
          disabled={disabled}
          onChange={(event) => {
            if (event.target.value.replace(/\D/g, "") !== digits)
              lastAutomatic.current = ""
            onChange(event.target.value)
          }}
          onBlur={(event) => void lookup(true, event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              void lookup()
            }
          }}
          help={maps ? help : "Você pode preencher o endereço manualmente."}
        />
        {maps && (
          <button
            type="button"
            className="secondary-button"
            disabled={disabled || pending}
            onClick={() => void lookup()}
          >
            {pending ? "Buscando…" : "Buscar CEP"}
          </button>
        )}
      </div>
      {pending && (
        <p className="field-help" role="status">
          Consultando endereço… Você pode continuar preenchendo.
        </p>
      )}
      {state.key === currentKey && state.error && <ErrorNotice error={state.error} />}
    </div>
  )
}
export default memo(PostalCodeLookup)
