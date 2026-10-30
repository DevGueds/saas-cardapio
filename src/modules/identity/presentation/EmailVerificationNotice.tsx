import { Link, useLocation } from "react-router"
import type { SessionView } from "@cardapio/contracts"
export default function EmailVerificationNotice({ session }: { session: SessionView }) {
  const location = useLocation(),
    verification = session.emailVerification
  if (!verification || verification.verified) return null
  return (
    <aside
      className="info-notice email-verification-notice"
      aria-label="Confirmação de e-mail pendente"
    >
      <div>
        <strong>Proteja sua conta: confirme seu e-mail</strong>
        <p>
          Confirme até{" "}
          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
            new Date(verification.deadline),
          )}{" "}
          para continuar usando o painel.
        </p>
      </div>
      <Link
        className="secondary-button"
        to="/confirmar-email"
        state={{ returnTo: location.pathname + location.search }}
      >
        Confirmar e-mail
      </Link>
    </aside>
  )
}
