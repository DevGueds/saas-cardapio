import { Executor } from "./application/execute"
import { browserIds, consoleDiagnostics } from "./infrastructure/browser-services"
export const browserExecutor = new Executor(consoleDiagnostics, browserIds)
