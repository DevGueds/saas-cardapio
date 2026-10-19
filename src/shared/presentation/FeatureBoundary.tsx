import { useState, type ReactNode } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { browserExecutor } from "../browser-executor"
import type { AppError, Result } from "../application/result"
import ErrorNotice from "./ErrorNotice"

export default function FeatureBoundary({
  children,
  label,
  resetKeys = [],
  report,
}: {
  children: ReactNode
  label: string
  resetKeys?: unknown[]
  report?(cause?: unknown): Promise<Result<never>>
}) {
  const [diagnostic, setDiagnostic] = useState<AppError | null>(null)
  return (
    <ErrorBoundary
      resetKeys={resetKeys}
      onReset={() => setDiagnostic(null)}
      onError={(cause) => {
        const result = report
          ? report(cause)
          : browserExecutor.run("presentation", "render", async () => {
              throw cause
            })
        void result
          .then((outcome) => {
            if (!outcome.ok) setDiagnostic(outcome.error)
          })
          .catch(() => undefined)
      }}
      fallbackRender={({ resetErrorBoundary }) => (
        <section className="feature-error" role="alert" aria-label={`Falha em ${label}`}>
          <h2>Não foi possível exibir {label.toLocaleLowerCase("pt-BR")}.</h2>
          <p>
            Esta área encontrou um erro. Você pode continuar usando as outras áreas ou
            tentar abrir esta novamente.
          </p>
          {diagnostic && (
            <details>
              <summary>Detalhes do diagnóstico</summary>
              <p>Área afetada: {label}</p>
              <ErrorNotice error={diagnostic} />
            </details>
          )}
          <button type="button" className="secondary-button" onClick={resetErrorBoundary}>
            Tentar novamente
          </button>
        </section>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}
