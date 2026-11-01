import { useEffect, useState, useSyncExternalStore } from "react"
import { Wifi, WifiOff } from "lucide-react"
import {
  getConnectionRetryCount,
  getConnectionSnapshot,
  subscribeConnection,
  subscribeConnectionRetry,
} from "../browser-connectivity"

export default function ConnectionNotice() {
  const connection = useSyncExternalStore(subscribeConnection, getConnectionSnapshot)
  const retries = useSyncExternalStore(subscribeConnectionRetry, getConnectionRetryCount)
  const [restored, setRestored] = useState(false)
  useEffect(() => {
    let wasOffline = getConnectionSnapshot() === "offline"
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = subscribeConnection(() => {
      if (getConnectionSnapshot() === "offline") {
        wasOffline = true
        clearTimeout(timer)
        setRestored(false)
      } else if (wasOffline) {
        wasOffline = false
        setRestored(true)
        timer = setTimeout(() => setRestored(false), 5000)
      }
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [])
  const offline = connection === "offline"
  if (!offline && !retries && !restored) return null
  const Icon = offline ? WifiOff : Wifi
  return (
    <aside className="connection-notice" role="status" aria-live="polite">
      <Icon size={20} aria-hidden="true" />
      <div>
        <strong>
          {offline
            ? "Sem conexão com a internet"
            : retries
              ? "Conexão instável. Tentando novamente…"
              : "Conexão disponível"}
        </strong>
        <p>
          {offline
            ? "Você pode consultar o que já carregou. Reconecte-se para salvar alterações ou enviar pedidos."
            : "Tentando atualizar os dados automaticamente."}
        </p>
      </div>
    </aside>
  )
}
