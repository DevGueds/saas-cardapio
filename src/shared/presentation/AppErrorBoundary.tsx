import { Component, type ReactNode } from "react"

import type { AppError, Result } from "../application/result"

import ErrorNotice from "./ErrorNotice"

export default class AppErrorBoundary extends Component<
  {
    children: ReactNode
    report(cause?: unknown): Promise<Result<never>>
  },
  { failed: boolean; error: AppError | null }
> {
  state: { failed: boolean; error: AppError | null } = {
    failed: false,
    error: null,
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(cause: Error) {
    void this.props.report(cause).then((result) => {
      if (!result.ok) this.setState({ error: result.error })
    })
  }

  render() {
    if (this.state.failed)
      return (
        <main className="state-page">
          <h1>Não foi possível exibir esta página.</h1>
          {this.state.error && <ErrorNotice error={this.state.error} />}
          <button className="primary-button" onClick={() => location.reload()}>
            Recarregar página
          </button>
        </main>
      )

    return this.props.children
  }
}
