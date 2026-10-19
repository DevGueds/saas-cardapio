import type { ReactNode } from "react"
import type { Result } from "../application/result"
import FeatureBoundary from "./FeatureBoundary"
export default function AppErrorBoundary({
  children,
  report,
}: {
  children: ReactNode
  report(cause?: unknown): Promise<Result<never>>
}) {
  return (
    <FeatureBoundary label="Aplicação" report={report}>
      {children}
    </FeatureBoundary>
  )
}
