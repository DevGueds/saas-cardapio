import { can, roleLabels } from "@cardapio/domain/permissions"
import { useCallback, useEffect, useState } from "react"
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router"
import { ArrowRight, Plus, Store } from "lucide-react"
import type { AppError, RestaurantAccess, SessionView } from "@cardapio/contracts"
import { useServices } from "../../../app/presentation/ServicesProvider"
import MenuScope from "../../../app/presentation/MenuScope"
import AdminLayout from "../../../app/presentation/AdminLayout"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import { useMutation } from "../../../shared/presentation/use-mutation"
import AccountContext from "./AccountContext"
import CreateStoreDialog from "./CreateStoreDialog"
import EmailVerificationNotice from "./EmailVerificationNotice"
export default function ApiAdminRoute() {
  const { auth } = useServices(),
    navigate = useNavigate(),
    location = useLocation()
  const [params] = useSearchParams()
  const selected = params.get("restaurant")
  const [data, setData] = useState<{
    session: SessionView
    stores: RestaurantAccess[]
  } | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [creating, setCreating] = useState(false)
  const mutation = useMutation()
  const reload = useCallback(async () => {
    if (!auth) return
    const session = await auth.session()
    if (!session.ok) {
      setError(session.error)
      setData(null)
      return
    }
    if (["ENROLL", "VERIFY"].includes(session.value.mfa ?? "")) {
      navigate("/mfa", { replace: true })
      return
    }
    if (session.value.emailVerification?.required) {
      navigate("/confirmar-email", { replace: true })
      return
    }
    const stores = await auth.restaurants()
    if (!stores.ok) {
      setError(stores.error)
      setData(null)
      return
    }
    setData({ session: session.value, stores: stores.value })
    setError(null)
  }, [auth, navigate])
  useEffect(() => {
    void reload()
  }, [reload])
  useEffect(
    () =>
      auth?.subscribeExpired((reason) =>
        navigate(
          reason === "MFA_REQUIRED"
            ? "/mfa"
            : reason === "EMAIL_VERIFICATION_REQUIRED"
              ? "/confirmar-email"
              : "/login",
          {
            replace: true,
            state: { returnTo: location.pathname + location.search },
          },
        ),
      ),
    [auth, navigate, location.pathname, location.search],
  )
  useEffect(() => {
    const verification = data?.session.emailVerification
    if (!verification || verification.verified) return
    const timer = window.setTimeout(
      () =>
        navigate("/confirmar-email", {
          replace: true,
          state: { returnTo: location.pathname + location.search },
        }),
      Math.min(2147483647, Math.max(0, Date.parse(verification.deadline) - Date.now())),
    )
    return () => window.clearTimeout(timer)
  }, [data?.session.emailVerification, navigate, location.pathname, location.search])
  if (error?.code === "UNAUTHENTICATED")
    return (
      <Navigate
        to="/login"
        replace
        state={{ returnTo: location.pathname + location.search }}
      />
    )
  if (error)
    return (
      <main className="state-page">
        <h1>Não foi possível acessar suas lojas</h1>
        <ErrorNotice error={error} onRetry={() => void reload()} />
        <Link to="/login">Voltar para o acesso</Link>
      </main>
    )
  if (!data)
    return (
      <main className="state-page">
        <p role="status">Carregando suas lojas…</p>
      </main>
    )
  const restaurant = data.stores.find((store) => store.id === selected)
  if (selected && !restaurant)
    return (
      <main className="state-page">
        <h1>Loja indisponível para sua conta</h1>
        <Link className="primary-button" to="/admin">
          Escolher outra loja
        </Link>
      </main>
    )
  if (restaurant)
    return (
      <AccountContext value={{ restaurant, session: data.session }}>
        <MenuScope
          key={restaurant.id}
          slug={restaurant.slug}
          restaurantId={restaurant.id}
        >
          <AdminLayout />
        </MenuScope>
      </AccountContext>
    )
  async function logout() {
    if (!auth) return
    const result = await mutation.run(() => auth.logout())
    if (result?.ok) navigate("/login", { replace: true })
  }
  return (
    <main className="stores-page">
      <EmailVerificationNotice session={data.session} />
      <header className="page-heading">
        <div>
          <p className="eyebrow">Sua conta</p>
          <h1>Qual loja vamos cuidar hoje?</h1>
          <p className="page-description">
            Olá, {data.session.user.name}. Escolha uma loja para abrir o painel.
          </p>
        </div>
        <button
          className="secondary-button"
          onClick={() => void logout()}
          disabled={mutation.pending}
        >
          Sair da conta
        </button>
      </header>
      <Link className="secondary-button" to="/minha-conta">
        Meu perfil e contato
      </Link>
      {mutation.error && <ErrorNotice error={mutation.error} />}
      <div className="stores-grid">
        {data.stores.map((store) => (
          <Link
            className="account-store-card"
            key={store.id}
            to={`/admin/${!can(store.role, "catalog:write") ? "orders" : "menu"}?restaurant=${store.id}`}
          >
            <Store size={28} aria-hidden="true" />
            <h2>{store.name}</h2>
            <span>/menu/{store.slug}</span>
            <small>{roleLabels[store.role]}</small>
            <strong>
              Abrir painel <ArrowRight size={18} aria-hidden="true" />
            </strong>
          </Link>
        ))}
      </div>
      {!data.stores.length && (
        <p className="info-notice">
          Sua conta ainda não tem lojas disponíveis. Se você faz parte de uma equipe,
          informe seu e-mail ao proprietário para ele liberar o acesso. Você também pode
          criar sua própria loja.
        </p>
      )}
      <button className="secondary-button" onClick={() => void reload()}>
        Atualizar meus acessos
      </button>
      <button className="primary-button" onClick={() => setCreating(true)}>
        <Plus size={18} aria-hidden="true" />
        Criar nova loja
      </button>
      {creating && (
        <CreateStoreDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false)
            void reload().then(() => navigate(`/admin/menu?restaurant=${id}`))
          }}
        />
      )}
    </main>
  )
}
