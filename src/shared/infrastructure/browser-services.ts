import type { AccessPolicy, DiagnosticLogger, ExclusiveLock } from "../application/ports"

import { Failure } from "../domain/failure"

export class DemoAccessPolicy implements AccessPolicy {
  constructor(private readonly mode: string | undefined) {}

  assertRead() {
    if (this.mode !== "demo")
      throw new Failure(
        "CONFIGURATION",
        "Aplicação indisponível. Configure explicitamente o modo demonstração.",
      )
  }

  assertAdmin() {
    if (this.mode !== "demo")
      throw new Failure(
        "ACCESS_DENIED",
        "Administração indisponível sem autorização verificável.",
      )
  }
}

export { browserIds } from "./browser-ids"

export const consoleDiagnostics: DiagnosticLogger = {
  record: (event) => console.error("[cardapio]", JSON.stringify(event)),
}

export class BrowserExclusiveLock implements ExclusiveLock {
  async run<T>(name: string, action: () => Promise<T>): Promise<T> {
    if (!globalThis.navigator?.locks?.request)
      throw new Failure(
        "CAPABILITY_UNAVAILABLE",
        "Este navegador não permite gravação segura entre abas. Use um navegador atualizado em HTTPS ou localhost.",
      )

    return navigator.locks.request(name, { mode: "exclusive" }, action)
  }
}
