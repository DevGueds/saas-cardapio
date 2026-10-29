import { defineRailway } from "railway/iac"
import { createStack } from "./stack.ts"
import { loadParameters } from "./parameters.ts"
export default defineRailway((ctx) =>
  createStack(loadParameters(ctx.environment ?? "production")),
)
