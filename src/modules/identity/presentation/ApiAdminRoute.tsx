import { useCallback, useEffect, useState } from "react"
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router"
import type { AppError, RestaurantAccess, SessionView } from "@cardapio/contracts"
import { useServices } from "../../../app/presentation/ServicesProvider"
import MenuScope from "../../../app/presentation/MenuScope"
import AdminLayout from "../../../app/presentation/AdminLayout"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import { useMutation } from "../../../shared/presentation/use-mutation"
import AccountContext from "./AccountContext"
import CreateStoreDialog from "./CreateStoreDialog"
import StoreSelector from "./StoreSelector"
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
    <>
      <StoreSelector
        session={data.session}
        stores={data.stores}
        error={mutation.error}
        signingOut={mutation.pending}
        onLogout={() => void logout()}
        onRefresh={reload}
        onCreate={() => setCreating(true)}
      />
      {creating && (
        <CreateStoreDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false)
            void reload().then(() => navigate(`/admin/menu?restaurant=${id}`))
          }}
        />
      )}
    </>
  )
}
