import { useServices } from "./ServicesProvider"
import { Navigate, useParams } from "react-router"

import PublicMenuPage from "../../modules/catalog/presentation/PublicMenuPage"

import MenuScope from "./MenuScope"

export default function PublicRoute() {
  const { slug: requestedSlug } = useParams()
  const { mode } = useServices()
  if (!requestedSlug && mode === "api") return <Navigate to="/login" replace />
  const slug = requestedSlug ?? "burger-house"

  return (
    <MenuScope key={slug} slug={slug}>
      <PublicMenuPage />
    </MenuScope>
  )
}
