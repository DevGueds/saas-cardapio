import { createContext, useContext, useState, type ReactNode } from "react"
import { ArrowUpRight, Check, ShieldCheck, Trash2 } from "lucide-react"
import Dialog from "../Dialog"
import {
  legalDocuments,
  LEGAL_VERSION,
  privacyController,
  type LegalDocumentKind,
} from "../../legal/documents"
import type { PrivacyNoticeStore } from "../../application/privacy-notice"
import type { DraftManager } from "../../application/drafts"

const Context = createContext<{ open(kind: LegalDocumentKind): void } | null>(null)
export function useLegal() {
  const context = useContext(Context)
  if (!context) throw new Error("LegalProvider is required")
  return context
}
export default function LegalProvider({
  children,
  notice,
  drafts,
}: {
  children: ReactNode
  notice: PrivacyNoticeStore
  drafts: DraftManager
}) {
  const [document, setDocument] = useState<LegalDocumentKind | null>(null)
  const [visible, setVisible] = useState(() => !notice.acknowledged(LEGAL_VERSION))
  const [clearResult, setClearResult] = useState<"done" | "error" | null>(null)
  const selected = document ? legalDocuments[document] : null
  return (
    <Context.Provider
      value={{
        open: (kind) => {
          setClearResult(null)
          setDocument(kind)
        },
      }}
    >
      {children}
      {visible && (
        <aside className="privacy-notice" aria-label="Aviso de privacidade">
          <ShieldCheck size={21} aria-hidden="true" />
          <p>
            <strong>Seu pedido. Sua privacidade.</strong>
            <span>Usamos apenas cookies essenciais e dados necessários ao serviço.</span>
          </p>
          <button
            type="button"
            className="privacy-notice__link"
            onClick={() => setDocument("privacy")}
          >
            Saiba mais
          </button>
          <button
            type="button"
            className="privacy-notice__dismiss"
            onClick={() => {
              notice.acknowledge(LEGAL_VERSION)
              setVisible(false)
            }}
          >
            Entendi
            <Check size={16} aria-hidden="true" />
          </button>
        </aside>
      )}
      {selected && (
        <Dialog
          title={selected.title}
          className="legal-dialog"
          onClose={() => setDocument(null)}
        >
          <p className="legal-version">
            Versão {LEGAL_VERSION} · Atualização em 29 de outubro de 2026
          </p>
          <p className="legal-lead">{selected.introduction}</p>
          <div className="legal-document">
            {selected.sections.map((section) => (
              <section key={section.title}>
                <h3>{section.title}</h3>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </section>
            ))}
          </div>
          {document === "cookies" && (
            <section className="device-data-card">
              <h3>Limpar meu preenchimento</h3>
              <p>
                Remove nomes, telefones, endereços e observações dos rascunhos de checkout
                deste dispositivo. Os pedidos enviados e seus links de acompanhamento são
                mantidos.
              </p>
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setClearResult(drafts.clearCustomerDetails?.() ? "done" : "error")
                }
              >
                <Trash2 size={17} aria-hidden="true" />
                Limpar dados de preenchimento
              </button>
              {clearResult && (
                <p
                  role="status"
                  className={clearResult === "error" ? "error-notice" : "success-notice"}
                >
                  {clearResult === "done"
                    ? "Os dados de preenchimento foram removidos deste dispositivo."
                    : "Não foi possível remover todos os rascunhos. Tente novamente ou limpe os dados do site no navegador."}
                </p>
              )}
            </section>
          )}
          <footer className="legal-dialog__footer">
            <a href={`${import.meta.env.BASE_URL}privacidade`}>
              Central de Privacidade
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <a href={`mailto:${privacyController.email}`}>{privacyController.email}</a>
          </footer>
        </Dialog>
      )}
    </Context.Provider>
  )
}
