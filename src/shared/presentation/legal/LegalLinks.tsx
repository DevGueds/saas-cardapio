import { useLegal } from "./LegalProvider"
export default function LegalLinks({ center = true }: { center?: boolean }) {
  const legal = useLegal()
  return (
    <nav className="legal-links" aria-label="Informações legais">
      <button type="button" onClick={() => legal.open("terms")}>
        Termos de Uso
      </button>
      <button type="button" onClick={() => legal.open("privacy")}>
        Privacidade
      </button>
      <button type="button" onClick={() => legal.open("cookies")}>
        Dados do dispositivo
      </button>
      {center && <a href={`${import.meta.env.BASE_URL}privacidade`}>Seus direitos</a>}
    </nav>
  )
}
