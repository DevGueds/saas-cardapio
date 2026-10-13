import { useEffect, useRef, type ReactNode } from "react"

import { X } from "lucide-react"

export default function Dialog({
  title,
  children,
  onClose,
  busy = false,
  className = "",
}: {
  title: string
  children: ReactNode
  onClose(): void
  busy?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const previous = document.activeElement

    const dialog = ref.current

    dialog?.showModal()

    const overflow = document.body.style.overflow

    document.body.style.overflow = "hidden"

    return () => {
      dialog?.close()
      document.body.style.overflow = overflow
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      className={`app-dialog ${className}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <header className="dialog-heading">
        <h2>{title}</h2>
        <button type="button" aria-label="Fechar" disabled={busy} onClick={onClose}>
          <X size={22} />
        </button>
      </header>
      {children}
    </dialog>
  )
}
