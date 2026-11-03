import { useMemo, useState, type CSSProperties } from "react"
import { Link } from "react-router"
import {
  ArrowRight,
  BookOpen,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Store,
  UserRound,
} from "lucide-react"
import { can, roleLabels } from "@cardapio/domain/permissions"
import type { AppError, RestaurantAccess, SessionView } from "@cardapio/contracts"
import Brand from "../../../shared/presentation/Brand"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"
import EmailVerificationNotice from "./EmailVerificationNotice"

function searchable(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
}

export default function StoreSelector({
  session,
  stores,
  error,
  signingOut,
  onLogout,
  onRefresh,
  onCreate,
}: {
  session: SessionView
  stores: RestaurantAccess[]
  error: AppError | null
  signingOut: boolean
  onLogout(): void
  onRefresh(): Promise<void>
  onCreate(): void
}) {
  const [query, setQuery] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const indexedStores = useMemo(
    () =>
      stores.map((store) => ({
        store,
        search: searchable(`${store.name} ${store.slug}`),
      })),
    [stores],
  )
  const search = searchable(query.trim())
  const showSearch = stores.length > 4 || query.length > 0
  const visible = indexedStores.filter((entry) => entry.search.includes(search))
  const initials = session.user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
  async function refresh() {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }
  return (
    <main className="stores-page">
      <div className="stores-container">
        <nav className="stores-account-bar" aria-label="Sua conta">
          <Brand compact />
          <div className="stores-account-actions">
            <Link className="stores-profile" to="/minha-conta">
              <span className="stores-avatar" aria-hidden="true">
                {initials}
              </span>
              <span>Meu perfil e contato</span>
            </Link>
            <button
              className="secondary-button stores-logout"
              disabled={signingOut}
              onClick={onLogout}
            >
              <LogOut size={16} aria-hidden="true" /> Sair da conta
            </button>
          </div>
        </nav>
        <EmailVerificationNotice session={session} />
        {error && <ErrorNotice error={error} />}
        <header className="stores-welcome glass-surface">
          <div>
            <p className="eyebrow">Seu espaço de gestão</p>
            <h1>
              Qual loja vamos
              <br className="stores-title-break" /> cuidar hoje?
            </h1>
            <p className="stores-greeting">
              Olá, {session.user.name}. Escolha uma loja e vamos começar.
            </p>
            <span className="stores-count">
              <Store size={15} aria-hidden="true" />
              {stores.length === 1
                ? "1 loja na sua conta"
                : `${stores.length} lojas na sua conta`}
            </span>
          </div>
          <div className="stores-welcome-art" aria-hidden="true">
            <div className="stores-art-tile">
              <Store size={52} strokeWidth={1.3} />
            </div>
            <span className="stores-art-small stores-art-small--menu">
              <BookOpen size={22} />
            </span>
            <span className="stores-art-small stores-art-small--account">
              <UserRound size={22} />
            </span>
          </div>
        </header>
        <section className="stores-workspace" aria-labelledby="stores-heading">
          <header className="stores-section-heading">
            <div>
              <h2 id="stores-heading">Suas lojas</h2>
              <p>Um painel para cada negócio. Tudo na mesma conta.</p>
            </div>
            {stores.length > 0 && (
              <button className="primary-button" onClick={onCreate}>
                <Plus size={18} aria-hidden="true" />
                Criar nova loja
              </button>
            )}
          </header>
          {showSearch && (
            <label className="stores-search">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">
                Buscar loja por nome ou endereço do cardápio
              </span>
              <ValidatedInput
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar uma loja…"
              />
            </label>
          )}
          {showSearch && (
            <p className="sr-only" role="status">
              {visible.length}{" "}
              {visible.length === 1 ? "loja encontrada" : "lojas encontradas"}
            </p>
          )}
          {stores.length === 0 ? (
            <div className="stores-empty glass-surface">
              <span className="stores-empty-icon">
                <Store size={28} aria-hidden="true" />
              </span>
              <h3>Sua primeira loja começa aqui</h3>
              <p>
                Crie sua loja para montar o cardápio e receber pedidos. Se você faz parte
                de uma equipe, peça ao proprietário para liberar o acesso com seu e-mail.
              </p>
              <button className="primary-button" onClick={onCreate}>
                <Plus size={18} aria-hidden="true" />
                Criar nova loja
              </button>
            </div>
          ) : visible.length ? (
            <div className="stores-grid">
              {visible.map(({ store }, index) => (
                <Link
                  className="account-store-card glass-surface"
                  key={store.id}
                  style={
                    { "--store-delay": `${Math.min(index, 5) * 45}ms` } as CSSProperties
                  }
                  to={`/admin/${can(store.role, "catalog:write") ? "menu" : "orders"}?restaurant=${store.id}`}
                >
                  <div className="store-card-heading">
                    <span className="store-card-icon">
                      <Store size={26} aria-hidden="true" />
                    </span>
                    <span className="store-role">{roleLabels[store.role]}</span>
                  </div>
                  <div className="store-card-details">
                    <h3>{store.name}</h3>
                    <p>/menu/{store.slug}</p>
                  </div>
                  <div className="store-card-footer">
                    <span>Abrir painel</span>
                    <span className="store-card-arrow">
                      <ArrowRight size={19} aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="stores-empty glass-surface">
              <Search size={26} aria-hidden="true" />
              <h3>Nenhuma loja encontrada</h3>
              <p>Tente outro nome ou limpe a busca para ver todas as suas lojas.</p>
              <button className="secondary-button" onClick={() => setQuery("")}>
                Limpar busca
              </button>
            </div>
          )}
          <footer className="stores-footer">
            <p>Recebeu um novo acesso? Atualize para ver a loja aqui.</p>
            <button
              className="secondary-button"
              onClick={() => void refresh()}
              disabled={refreshing}
              aria-busy={refreshing}
            >
              <RefreshCw size={15} aria-hidden="true" />
              {refreshing ? "Atualizando acessos…" : "Atualizar meus acessos"}
            </button>
          </footer>
        </section>
      </div>
    </main>
  )
}
