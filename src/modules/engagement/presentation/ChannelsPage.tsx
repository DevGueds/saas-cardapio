import { useCallback, useState } from "react"
import { ExternalLink, RefreshCw, Monitor, MessageCircle } from "lucide-react"
import { can } from "@cardapio/domain/permissions"
import type { ChannelSettings, WhatsappState } from "@cardapio/contracts"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useAccount } from "../../identity/presentation/AccountContext"
import { useResource } from "../../../shared/presentation/use-resource"
import { useMutation } from "../../../shared/presentation/use-mutation"
import { InputField, SelectField, ToggleField } from "../../../shared/presentation/Fields"
import PageHeading from "../../../shared/presentation/PageHeading"
import Dialog from "../../../shared/presentation/Dialog"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import FeatureBoundary from "../../../shared/presentation/FeatureBoundary"
import QrDesigner from "../../../shared/presentation/QrDesigner"
import type { EngagementService } from "../application/ports"
function ChannelControls({
  service,
  settings,
  reload,
}: {
  service: EngagementService
  settings: ChannelSettings
  reload(): Promise<void>
}) {
  const { menu } = useMenu(),
    id = menu.restaurant.id,
    mutation = useMutation()
  const [origin, setOrigin] = useState(window.location.origin),
    [screen, setScreen] = useState("tv"),
    [confirmation, setConfirmation] = useState<
      "board" | "rotate" | "whatsapp" | "disconnect" | null
    >(null),
    [connection, setConnection] = useState<
      (WhatsappState & { generatedAt?: number }) | null
    >(null)
  const deliveries = useResource(useCallback(() => service.deliveries(id), [service, id]))
  let boardUrl = ""
  try {
    const base = new URL(origin)
    if (["http:", "https:"].includes(base.protocol) && !base.username && !base.password)
      boardUrl = `${base.origin}${import.meta.env.BASE_URL}painel/${menu.restaurant.slug}?view=${screen}#${settings.boardToken}`
  } catch {
    /* Keep incomplete address editable. */
  }
  async function confirm() {
    if (confirmation === "disconnect") {
      const result = await mutation.run(
        () => service.whatsapp(id, "disconnect"),
        "WhatsApp desconectado.",
      )
      if (result?.ok) {
        setConnection(result.value)
        setConfirmation(null)
      }
      return
    }
    const result = await mutation.run(
      () =>
        service.update(id, {
          expectedRevision: settings.revision,
          boardEnabled:
            confirmation === "board" ? !settings.boardEnabled : settings.boardEnabled,
          whatsappEnabled:
            confirmation === "whatsapp"
              ? !settings.whatsappEnabled
              : settings.whatsappEnabled,
          rotateBoard: confirmation === "rotate",
        }),
      "Configuração salva.",
    )
    if (result?.ok) {
      setConfirmation(null)
      await reload()
    }
  }
  const deliveryLabels: Record<string, string> = {
    PENDING: "Na fila",
    PROCESSING: "Enviando",
    SENT: "Aceito pelo serviço",
    FAILED: "Falhou",
    UNKNOWN: "Sem confirmação · conferir",
    SKIPPED: "Não enviado",
  }
  return (
    <div className="channels-grid">
      {mutation.error && !confirmation && (
        <ErrorNotice error={mutation.error} onRetry={() => void reload()} />
      )}
      <section className="settings-card">
        <div className="section-heading">
          <div>
            <Monitor size={26} />
            <h2>Painel público de pedidos</h2>
          </div>
          <span className="offer-badge">
            {settings.boardEnabled ? "Ativo" : "Desativado"}
          </span>
        </div>
        <p>
          Clientes acompanham o número e a etapa do pedido em uma TV ou no celular. Sem
          nomes, telefones, itens ou valores.
        </p>
        <ToggleField
          label="Disponibilizar painel público"
          checked={settings.boardEnabled}
          disabled={mutation.pending}
          onChange={() => setConfirmation("board")}
        />
        {settings.boardEnabled && (
          <>
            <div className="form-row">
              <SelectField
                label="Enviar link para"
                value={screen}
                onChange={(e) => setScreen(e.target.value)}
              >
                <option value="tv">TV · quadro amplo</option>
                <option value="mobile">Celular · quadro vertical</option>
              </SelectField>
              <InputField
                label="Endereço da loja na rede"
                type="url"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                help="Use o IP deste computador para abrir em aparelhos na mesma rede local, ou seu domínio HTTPS."
              />
            </div>
            {boardUrl ? (
              <>
                <a
                  className="secondary-button"
                  href={boardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={17} /> Abrir painel para{" "}
                  {screen === "tv" ? "TV" : "celular"}
                </a>
                <FeatureBoundary label="Compartilhar painel">
                  <QrDesigner
                    url={boardUrl}
                    logo={menu.restaurant.logoUrl}
                    title={`Link e QR Code para ${screen === "tv" ? "TV" : "celular"}`}
                    filename={`painel-${screen}-${menu.restaurant.slug}`}
                  />
                </FeatureBoundary>
              </>
            ) : (
              <p role="status">Informe um endereço HTTP ou HTTPS válido.</p>
            )}
            <button
              className="text-button"
              disabled={mutation.pending}
              onClick={() => setConfirmation("rotate")}
            >
              Gerar novo link e invalidar o anterior
            </button>
          </>
        )}
      </section>
      <section className="settings-card">
        <MessageCircle size={26} />
        <h2>Atualizações automáticas no WhatsApp</h2>
        <p>
          Conecte o número da loja e ative os envios. Cada cliente escolhe se quer receber
          mensagens sobre o próprio pedido e pode cancelar pelo acompanhamento.
        </p>
        {!settings.whatsappConfigured ? (
          <p className="info-notice">
            O provedor de WhatsApp ainda não foi configurado neste ambiente.
          </p>
        ) : (
          <>
            <p role="status">
              {connection
                ? {
                    unconfigured: "Serviço não configurado",
                    disconnected: "Número desconectado",
                    connecting: "Aguardando conexão do aparelho",
                    connected: "Número conectado",
                  }[connection.state]
                : "Verifique a conexão para consultar o número da loja."}
            </p>
            <div className="qr-actions">
              <button
                className="secondary-button"
                disabled={mutation.pending}
                onClick={() =>
                  void mutation
                    .run(() => service.whatsapp(id, "connect"))
                    .then((r) => {
                      if (r?.ok) setConnection({ ...r.value, generatedAt: Date.now() })
                    })
                }
              >
                Conectar número da loja
              </button>
              <button
                className="secondary-button"
                disabled={mutation.pending}
                onClick={() =>
                  void mutation
                    .run(() => service.whatsapp(id, "state"))
                    .then((r) => {
                      if (r?.ok) setConnection(r.value)
                    })
                }
              >
                <RefreshCw size={17} /> Verificar conexão
              </button>
              <button
                className="text-button"
                disabled={mutation.pending}
                onClick={() => setConfirmation("disconnect")}
              >
                Desconectar número
              </button>
            </div>
            {connection?.qr && (
              <div className="whatsapp-pairing">
                <img
                  src={connection.qr}
                  width={300}
                  height={300}
                  alt="QR Code para conectar o WhatsApp da loja"
                />
                <p>
                  No WhatsApp da loja, abra{" "}
                  <strong>Aparelhos conectados → Conectar aparelho</strong>. Depois de
                  escanear, clique em Verificar conexão. Se expirar, clique em Conectar
                  número da loja novamente.
                </p>
              </div>
            )}
            <ToggleField
              label="Enviar atualizações automáticas aos clientes que autorizaram"
              checked={settings.whatsappEnabled}
              disabled={mutation.pending}
              onChange={() => setConfirmation("whatsapp")}
            />
          </>
        )}
      </section>
      <section className="settings-card">
        <div className="section-heading">
          <div>
            <h2>Envios recentes</h2>
            <p>
              “Aceito pelo serviço” confirma o recebimento pelo provedor, sem garantir
              leitura no aparelho.
            </p>
          </div>
          <button
            className="secondary-button"
            disabled={deliveries.loading}
            onClick={() => void deliveries.reload()}
          >
            <RefreshCw size={17} /> Atualizar envios
          </button>
        </div>
        {deliveries.error && (
          <ErrorNotice
            error={deliveries.error}
            onRetry={() => void deliveries.reload()}
          />
        )}
        <p className="field-help">
          Envios sem confirmação não são repetidos automaticamente. Confira no WhatsApp
          conectado antes de falar com o cliente. Os alertas push tentam novamente em
          falhas temporárias.
        </p>
        {deliveries.data?.length ? (
          <div
            className="finance-table-scroll"
            role="region"
            aria-label="Histórico de envios"
            tabIndex={0}
          >
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Canal</th>
                  <th>Situação</th>
                  <th>Tentativas</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.data.map((d) => (
                  <tr key={d.id}>
                    <td>#{d.orderId.slice(0, 8).toUpperCase()}</td>
                    <td>{d.channel === "PUSH" ? "Push" : "WhatsApp"}</td>
                    <td>{deliveryLabels[d.state]}</td>
                    <td>{d.attempts}</td>
                    <td>{new Date(d.createdAt).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            {deliveries.loading
              ? "Carregando envios…"
              : "Ainda não há envios nesta loja."}
          </p>
        )}
      </section>
      {confirmation && (
        <Dialog
          title={
            confirmation === "rotate"
              ? "Substituir o link público?"
              : confirmation === "disconnect"
                ? "Desconectar o WhatsApp?"
                : "Confirmar alteração do canal"
          }
          onClose={() => setConfirmation(null)}
          busy={mutation.pending}
        >
          <div className="editor-form">
            <p>
              {confirmation === "rotate"
                ? "TVs e celulares com o link anterior perderão acesso. Compartilhe o novo link após confirmar."
                : confirmation === "disconnect"
                  ? "Os envios por WhatsApp ficarão indisponíveis até conectar o número novamente."
                  : confirmation === "board"
                    ? settings.boardEnabled
                      ? "O painel deixará de mostrar os pedidos nas TVs e celulares conectados."
                      : "Pessoas com o link poderão ver os números e as etapas dos pedidos em andamento nas últimas 24 horas."
                    : settings.whatsappEnabled
                      ? "Novos envios automáticos de WhatsApp serão interrompidos. Mensagens já aceitas pelo provedor não podem ser recolhidas."
                      : "A loja enviará atualizações de pedidos e pagamentos aos clientes que autorizaram."}
            </p>
            {mutation.error && (
              <ErrorNotice error={mutation.error} onRetry={() => void reload()} />
            )}
            <div className="form-actions">
              <button
                className="secondary-button"
                disabled={mutation.pending}
                onClick={() => setConfirmation(null)}
              >
                Cancelar
              </button>
              <button
                className="primary-button"
                disabled={mutation.pending}
                onClick={() => void confirm()}
              >
                Confirmar alteração
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
function ConnectedChannels({ service }: { service: EngagementService }) {
  const { menu } = useMenu(),
    resource = useResource(
      useCallback(
        () => service.settings(menu.restaurant.id),
        [service, menu.restaurant.id],
      ),
    )
  return (
    <>
      <PageHeading
        eyebrow="Sua loja conectada"
        title="Painel ao vivo e mensagens"
        description="Compartilhe o andamento dos pedidos e avise seus clientes a cada etapa."
      />
      {resource.error && (
        <ErrorNotice error={resource.error} onRetry={() => void resource.reload()} />
      )}
      {resource.loading && <p role="status">Carregando canais…</p>}
      {resource.data && !resource.error && (
        <ChannelControls
          service={service}
          settings={resource.data}
          reload={resource.reload}
        />
      )}
    </>
  )
}
export default function ChannelsPage() {
  const { engagement } = useServices(),
    account = useAccount()
  if (account && !can(account.restaurant.role, "catalog:write"))
    return (
      <p className="info-notice">Seu perfil não permite gerenciar os canais da loja.</p>
    )
  return engagement ? (
    <ConnectedChannels service={engagement} />
  ) : (
    <p className="info-notice">
      O painel ao vivo e as mensagens automáticas estão disponíveis no modo conectado à
      API.
    </p>
  )
}
