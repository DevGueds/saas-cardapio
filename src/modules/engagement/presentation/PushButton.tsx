import { useCallback } from "react"
import { Bell, BellOff } from "lucide-react"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useMutation } from "../../../shared/presentation/use-mutation"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import type { PushTarget } from "../application/ports"
import { useResource } from "../../../shared/presentation/use-resource"
export default function PushButton({ target }: { target: PushTarget }) {
  const { engagement, devicePush } = useServices(),
    mutation = useMutation()
  const configuration = useResource(
    useCallback(
      async () =>
        engagement
          ? engagement.pushConfiguration()
          : { ok: true as const, value: { enabled: false, publicKey: "" } },
      [engagement],
    ),
  )
  const key =
    !configuration.loading && !configuration.error && configuration.data?.enabled
      ? configuration.data.publicKey
      : ""
  const notice = configuration.loading
    ? "Carregando configuração de alertas…"
    : configuration.data && !configuration.data.enabled
      ? "Os alertas deste aparelho ainda não foram configurados pela loja."
      : ""
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
      {configuration.error && (
        <ErrorNotice
          error={configuration.error}
          onRetry={() => void configuration.reload()}
        />
      )}
      <div className="qr-actions">
        <button
          type="button"
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
          type="button"
          className="text-button"
          disabled={!!unavailable || mutation.pending}
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
