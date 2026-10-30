import { useEffect, useRef, useState } from "react"

type TurnstileApi = {
  render(element: HTMLElement, options: Record<string, unknown>): string
  remove(id: string): void
}
let loading: Promise<TurnstileApi> | undefined
function load() {
  const api = () => (window as Window & { turnstile?: TurnstileApi }).turnstile
  if (api()) return Promise.resolve(api()!)
  if (loading) return loading
  loading = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
    script.async = true
    const timeout = window.setTimeout(() => {
      script.remove()
      loading = undefined
      reject(new Error("turnstile_timeout"))
    }, 12000)
    script.onload = () => {
      window.clearTimeout(timeout)
      if (api()) resolve(api()!)
      else {
        loading = undefined
        reject(new Error("turnstile_unavailable"))
      }
    }
    script.onerror = () => {
      window.clearTimeout(timeout)
      script.remove()
      loading = undefined
      reject(new Error("turnstile_unavailable"))
    }
    document.head.append(script)
  })
  return loading
}
export default function TurnstileChallenge({
  siteKey,
  action,
  onToken,
}: {
  siteKey: string
  action: "login" | "register"
  onToken: (token: string) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(true)
  const [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!container.current || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setCompact(entry.contentRect.width < 300)
    })
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    let active = true,
      widget: string | undefined,
      api: TurnstileApi | undefined
    onToken("")
    void load()
      .then((loaded) => {
        if (!active || !container.current) return
        api = loaded
        widget = api.render(container.current, {
          sitekey: siteKey,
          action,
          size: compact ? "compact" : "flexible",
          language: "pt-br",
          callback: (token: string) => {
            if (active) {
              setFailed(false)
              onToken(token)
            }
          },
          "expired-callback": () => {
            if (active) onToken("")
          },
          "error-callback": () => {
            if (active) {
              onToken("")
              setFailed(true)
            }
          },
        })
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
      if (widget) api?.remove(widget)
    }
  }, [siteKey, action, onToken, attempt, compact])
  return (
    <div className="bot-challenge">
      <p className="field-help">Verificação de segurança</p>
      <div ref={container} />
      {failed && (
        <div role="alert">
          <p>
            Não foi possível concluir a verificação. Confira sua conexão e tente
            novamente.
          </p>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setFailed(false)
              setAttempt(attempt + 1)
            }}
          >
            Tentar verificação novamente
          </button>
        </div>
      )}
    </div>
  )
}
