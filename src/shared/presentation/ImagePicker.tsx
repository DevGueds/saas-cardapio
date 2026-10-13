import { useEffect, useRef, useState } from "react"

import { Camera } from "lucide-react"

import type { ImageReader } from "../application/image-reader"

import type { AppError } from "../application/result"

import ErrorNotice from "./ErrorNotice"

export default function ImagePicker({
  label,
  value,
  onChange,
  reader,
  disabled = false,
  onBusyChange,
}: {
  label: string
  value: string
  onChange(value: string): void
  reader: ImageReader
  disabled?: boolean
  onBusyChange?(busy: boolean): void
}) {
  const input = useRef<HTMLInputElement>(null)

  const lifetime = useRef({ current: 0, busy: false })

  useEffect(() => {
    const state = lifetime.current
    return () => {
      state.current++
    }
  }, [])

  const [error, setError] = useState<AppError | null>(null)

  const [busy, setBusy] = useState(false)

  async function select(file?: File) {
    if (!file || disabled || lifetime.current.busy) return

    const request = ++lifetime.current.current

    lifetime.current.busy = true

    setBusy(true)
    onBusyChange?.(true)
    setError(null)

    const result = await reader.read(file)

    if (request === lifetime.current.current) {
      if (result.ok) onChange(result.value)
      else setError(result.error)

      lifetime.current.busy = false

      setBusy(false)
      onBusyChange?.(false)
    }
  }

  return (
    <div className="image-picker">
      <span className="field-label">{label}</span>
      <input
        ref={input}
        type="file"
        aria-label={label}
        accept="image/png,image/jpeg,image/webp"
        hidden
        disabled={disabled || busy}
        onChange={(event) => {
          void select(event.target.files?.[0])
          event.target.value = ""
        }}
      />
      <button
        type="button"
        className="image-dropzone"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          void select(event.dataTransfer.files[0])
        }}
      >
        {value ? <img src={value} alt={`Prévia: ${label}`} /> : <Camera size={28} />}
        <span>
          {busy ? "Validando imagem…" : "Clique ou arraste uma imagem"}
          <small>PNG, JPEG ou WebP · até 5 MB</small>
        </span>
      </button>
      {value && (
        <button
          type="button"
          className="text-button"
          disabled={disabled || busy}
          onClick={() => {
            lifetime.current.current++
            onChange("")
          }}
        >
          Remover imagem
        </button>
      )}
      {error && <ErrorNotice error={error} />}
    </div>
  )
}
