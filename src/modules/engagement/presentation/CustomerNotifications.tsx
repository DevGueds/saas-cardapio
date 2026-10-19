import { useCallback } from "react"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useResource } from "../../../shared/presentation/use-resource"
import { useMutation } from "../../../shared/presentation/use-mutation"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import { ToggleField } from "../../../shared/presentation/Fields"
import type { EngagementService } from "../application/ports"
import PushButton from "./PushButton"
function Preferences({
  service,
  slug,
  orderId,
  token,
}: {
  service: EngagementService
  slug: string
  orderId: string
  token: string
}) {
  const resource = useResource(
      useCallback(
        () => service.preferences({ slug, orderId, token }),
        [service, slug, orderId, token],
      ),
    ),
    mutation = useMutation()
  return (
    <section className="customer-notifications">
      <h2>Receber atualizações</h2>
      {resource.error && (
        <ErrorNotice error={resource.error} onRetry={() => void resource.reload()} />
      )}
      {mutation.error && <ErrorNotice error={mutation.error} />}
      {resource.data && (
        <>
          <ToggleField
            label="Receber atualizações deste pedido pelo WhatsApp"
            checked={resource.data.whatsapp}
            disabled={resource.loading || !!resource.error || mutation.pending}
            onChange={(value) =>
              void mutation
                .run(
                  () => service.consent({ slug, orderId, token }, value),
                  value
                    ? "Preferência de WhatsApp salva."
                    : "Mensagens de WhatsApp desativadas para este pedido.",
                )
                .then((r) => {
                  if (r?.ok) void resource.reload()
                })
            }
          />
          <p className="field-help">
            {resource.data.available
              ? "Mensagens sobre etapas e pagamentos, no número informado no pedido."
              : "O envio por WhatsApp depende da ativação deste canal pela loja."}
          </p>
        </>
      )}
      <PushButton target={{ slug, orderId, token }} />
    </section>
  )
}
export default function CustomerNotifications(props: {
  slug: string
  orderId: string
  token: string
}) {
  const { engagement } = useServices()
  return engagement ? (
    <Preferences
      key={`${props.slug}:${props.orderId}:${props.token}`}
      service={engagement}
      {...props}
    />
  ) : null
}
