import { Link } from "react-router"

export default function NotFoundPage() {
  return (
    <main className="state-page">
      <h1>Página não encontrada</h1>
      <Link className="primary-button" to="/">
        Voltar ao cardápio
      </Link>
    </main>
  )
}
