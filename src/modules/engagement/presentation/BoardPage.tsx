import { memo, useEffect, useState, useSyncExternalStore } from "react"
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router"
import { Maximize, RefreshCw, Monitor, Smartphone } from "lucide-react"
import type { BoardOrder } from "@cardapio/contracts"
import { useServices } from "../../../app/presentation/ServicesProvider"
import FeatureBoundary from "../../../shared/presentation/FeatureBoundary"
import { BoardStore, boardStages } from "../application/board-store"
const labels = {
  NEW: "Recebidos",
  PREPARING: "Em preparo",
  READY: "Prontos",
  OUT_FOR_DELIVERY: "Em entrega",
}
const Card = memo(function BoardCard({ store, id }: { store: BoardStore; id: string }) {
  const order = useSyncExternalStore(
    (fn) => store.subscribe(id, fn),
    () => store.get(id),
  )
  if (!order) return null
  return (
    <article className={`public-order public-order--${order.status.toLowerCase()}`}>
      <span>Pedido</span>
      <strong>#{order.id.slice(0, 8).toUpperCase()}</strong>
      <time dateTime={order.createdAt}>
        {new Date(order.createdAt).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </time>
    </article>
  )
})
const Column = memo(function BoardColumn({
  store,
  stage,
}: {
  store: BoardStore
  stage: BoardOrder["status"]
}) {
  const ids = useSyncExternalStore(
    (fn) => store.subscribe(`column:${stage}`, fn),
    () => store.column(stage),
  )
  return (
    <section
      className={`public-board-column public-board-column--${stage.toLowerCase()}`}
      aria-label={labels[stage]}
    >
      <h2>
        {labels[stage]} <span>{ids.length}</span>
      </h2>
      <div>
        {ids.length ? (
          ids.map((id) => (
            <FeatureBoundary key={id} label="Pedido">
              <Card store={store} id={id} />
            </FeatureBoundary>
          ))
        ) : (
          <p className="board-empty">Nenhum pedido nesta etapa</p>
        )}
      </div>
    </section>
  )
})
function LiveBoard({ slug, token }: { slug: string; token: string }) {
  const { engagement } = useServices(),
    [store] = useState(() => new BoardStore()),
    [retry, setRetry] = useState(0),
    [params] = useSearchParams(),
    navigate = useNavigate(),
    [screenError, setScreenError] = useState("")
  const meta = useSyncExternalStore((fn) => store.subscribe("meta", fn), store.metadata),
    tv = params.get("view") !== "mobile"
  useEffect(() => {
    if (!engagement) return
    const abort = new AbortController()
    void engagement.board(
      slug,
      token,
      { snapshot: store.snapshot, delta: store.delta, status: store.status },
      abort.signal,
    )
    return () => abort.abort()
  }, [engagement, slug, token, retry, store])
  useEffect(() => {
    document.title = `${meta.name} · Pedidos ao vivo`
  }, [meta.name])
  return (
    <main className={`public-board ${tv ? "public-board--tv" : "public-board--mobile"}`}>
      <header>
        <div>
          <p className="eyebrow">Seu pedido, em cada etapa</p>
          <h1>{meta.name}</h1>
          <p
            role="status"
            className={
              meta.connected ? "board-connection" : "board-connection is-offline"
            }
          >
            {engagement
              ? meta.message
              : "O painel ao vivo requer o modo conectado à API."}
          </p>
        </div>
        <div className="board-actions">
          <button
            className="secondary-button"
            onClick={() =>
              void navigate({
                search: `?view=${tv ? "mobile" : "tv"}`,
                hash: `#${token}`,
              })
            }
          >
            {tv ? <Smartphone size={18} /> : <Monitor size={18} />}
            {tv ? "Modo celular" : "Modo TV"}
          </button>
          <button
            className="icon-button"
            aria-label="Tela cheia"
            onClick={() => {
              if (!document.fullscreenEnabled) {
                setScreenError("Use a opção de tela cheia do navegador deste aparelho.")
                return
              }
              void document.documentElement
                .requestFullscreen()
                .catch(() =>
                  setScreenError(
                    "Não foi possível abrir a tela cheia. Use o menu do navegador.",
                  ),
                )
            }}
          >
            <Maximize size={20} />
          </button>
          {!meta.connected && (
            <button
              className="icon-button"
              aria-label="Reconectar painel"
              onClick={() => setRetry((v) => v + 1)}
            >
              <RefreshCw size={20} />
            </button>
          )}
        </div>
      </header>
      {screenError && <p role="status">{screenError}</p>}
      {!meta.connected && (
        <p className="info-notice">
          As etapas exibidas podem estar desatualizadas até a conexão voltar.
        </p>
      )}
      {meta.truncated && (
        <p className="info-notice">
          Exibindo os 500 pedidos mais antigos em andamento nas últimas 24 horas. Consulte
          a equipe se seu número não aparecer.
        </p>
      )}
      <div className="public-board-grid">
        {boardStages.map((stage) => (
          <Column key={stage} store={store} stage={stage} />
        ))}
      </div>
      <footer>
        <p>
          Confira o número no acompanhamento do seu pedido. Pedidos concluídos saem deste
          painel.
        </p>
        <Link className="text-button" to={`/menu/${slug}`}>
          Abrir cardápio
        </Link>
      </footer>
    </main>
  )
}
export default function BoardPage() {
  const { slug = "" } = useParams(),
    token = useLocation().hash.slice(1)
  return <LiveBoard key={`${slug}:${token}`} slug={slug} token={token} />
}
