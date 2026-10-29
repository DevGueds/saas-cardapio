import { fileURLToPath } from "node:url"
import type { PrintingLogoValidator } from "../application/ports.js"
import type { ParallelTaskRunner } from "../../../shared/infrastructure/parallel-task.js"

function decodeLogo(input: unknown) {
  const scope = globalThis as typeof globalThis & { env: { modulePath: string } }
  const load = process.getBuiltinModule("module").createRequire(scope.env.modulePath)
  const kernel = load(scope.env.modulePath) as typeof import("./png-logo.js")
  return kernel.validLogoPixels(input as string)
}

export class ParallelPrintingLogos implements PrintingLogoValidator {
  constructor(private readonly tasks: Pick<ParallelTaskRunner, "run">) {}
  async validate(logo: string) {
    if (!logo) return true
    return (
      (await this.tasks.run(logo, decodeLogo, {
        modulePath: fileURLToPath(new URL("./png-logo.js", import.meta.url)),
      })) === true
    )
  }
}
