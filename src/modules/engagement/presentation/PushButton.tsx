import { useEffect, useState } from "react"
import { Bell, BellOff } from "lucide-react"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useMutation } from "../../../shared/presentation/use-mutation"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import type { PushTarget } from "../application/ports"
export default function PushButton({ target }: { target: PushTarget }) {
  const { engagement, devicePush } = useServices(),
    mutation = useMutation(),
    [key, setKey] = useState(""),
    [notice, setNotice] = useState("Carregando configuração de alertas…")
  useEffect(() => {
    let active = true
    if (engagement)
      void engagement.pushConfiguration().then((result) => {
        if (!active) return
        if (result.ok && result.value.enabled) {
          setKey(result.value.publicKey)
          setNotice("")
        } else
          setNotice(
            result.ok
              ? "Os alertas deste aparelho ainda não foram configurados pela loja."
              : result.error.message,
          )
      })
    return () => {
      active = false
    }
  }, [engagement])
  if (!engagement || !devicePush) return null
  const unavailable = devicePush.unsupported()
  return (
    <section className="push-controls" aria-label="Alertas neste aparelho">
      {(unavailable || notice) && (
        <p className="field-help" role="status">
          {unavailable || notice}
        </p>
      )}
      {mutation.error && <ErrorNotice error={mutation.error} />}
      <div className="qr-actions">
        <button
          className="secondary-button"
          disabled={!!unavailable || !key || mutation.pending}
          onClick={() =>
            void mutation.run(
              async () => {
                const subscription = await devicePush.subscribe(key)
                if (!subscription.ok) return subscription
                return engagement.push(target, subscription.value)
              },
              "restaurantId" in target
                ? "Alertas ativados enquanto sua sessão estiver válida. Renove após entrar novamente."
                : "Alertas deste pedido ativados neste aparelho por até 30 dias.",
            )
          }
        >
          <Bell size={17} /> Ativar ou renovar alertas
        </button>
        <button
          className="text-button"
          disabled={mutation.pending}
          onClick={() =>
            void mutation.run(async () => {
              const current = await devicePush.current()
              if (!current.ok) return current
              if (!current.value) return { ok: true as const, value: undefined }
              return engagement.push(target, current.value, true)
            }, "Alertas deste pedido ou loja desativados neste aparelho.")
          }
        >
          <BellOff size={17} /> Desativar alertas
        </button>
      </div>
      <p className="field-help">
        No iPhone/iPad, abra pela Tela de Início. A permissão é solicitada somente quando
        você ativa os alertas.
      </p>
    </section>
  )
}
