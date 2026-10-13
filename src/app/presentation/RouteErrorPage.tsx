import { useEffect, useState } from "react"

import { useRouteError } from "react-router"

import type { Result } from "../../shared/application/result"

import ErrorNotice from "../../shared/presentation/ErrorNotice"

import { useServices } from "./ServicesProvider"

export default function RouteErrorPage() {
  const services = useServices()

  const cause = useRouteError()

  const [error, setError] = useState<Result<never> | null>(null)

  useEffect(() => {
    let active = true
    void services.reportUnexpected(cause).then((result) => {
      if (active) setError(result)
    })
    return () => {
      active = false
    }
  }, [services, cause])

  return (
    <main className="state-page">
      <h1>Não foi possível carregar esta página</h1>
      {error && !error.ok && <ErrorNotice error={error.error} />}
      <button className="primary-button" onClick={() => location.reload()}>
        Recarregar página
      </button>
    </main>
  )
}
