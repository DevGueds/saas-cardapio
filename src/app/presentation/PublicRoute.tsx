import { useParams } from "react-router"

import PublicMenuPage from "../../modules/catalog/presentation/PublicMenuPage"

import MenuScope from "./MenuScope"

export default function PublicRoute() {
  const { slug = "burger-house" } = useParams()

  return (
    <MenuScope key={slug} slug={slug}>
      <PublicMenuPage />
    </MenuScope>
  )
}
