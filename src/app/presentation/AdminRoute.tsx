import ApiAdminRoute from "../../modules/identity/presentation/ApiAdminRoute"
import { useEffect, useState } from "react"

import type { Result } from "../../shared/application/result"

import ErrorNotice from "../../shared/presentation/ErrorNotice"

import { useServices } from "./ServicesProvider"

import AdminLayout from "./AdminLayout"

import MenuScope from "./MenuScope"

export default function AdminRoute() {
  const services = useServices()
  return services.mode === "api" ? <ApiAdminRoute /> : <DemoAdminRoute />
}

function DemoAdminRoute() {
  const services = useServices()

  const [access, setAccess] = useState<Result<void> | null>(null)

  useEffect(() => {
    let active = true
    void services.checkAdmin().then((result) => {
      if (active) setAccess(result)
    })
    return () => {
      active = false
    }
  }, [services])

  if (!access)
    return (
      <main className="state-page">
        <p role="status">Verificando acesso…</p>
      </main>
    )

  if (!access.ok)
    return (
      <main className="state-page">
        <h1>Administração indisponível</h1>
        <ErrorNotice error={access.error} />
      </main>
    )

  return (
    <MenuScope slug="burger-house">
      <AdminLayout />
    </MenuScope>
  )
}
