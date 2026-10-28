import {
  receiptKindSchema,
  updatePrintingSettingsSchema,
  uuid,
} from "@cardapio/contracts"
import { canPrintReceipt, receiptKinds } from "@cardapio/domain/printing"
import { Failure } from "@cardapio/domain/failure"
import type { Actor } from "../../identity/domain/identity.js"
import type { AccessPolicy } from "../../identity/application/ports.js"
import type { Operation } from "../../../shared/application/operation.js"
import type { Clock } from "../../../shared/application/ports.js"
import { validate } from "../../../shared/application/validate.js"
import type { PrintingLogoValidator, PrintingRepository } from "./ports.js"
import { buildReceipt } from "./snapshot.js"

export class Printing {
  constructor(
    private readonly repository: PrintingRepository,
    private readonly access: AccessPolicy,
    private readonly operation: Operation,
    private readonly clock: Clock,
    private readonly logos: PrintingLogoValidator,
  ) {}
  settings(actor: Actor, restaurantId: string) {
    return this.operation.run("printing.settings", async () => {
      const { scope, role } = await this.access.grant(actor, restaurantId, "orders:read")
      if (!receiptKinds.some((kind) => canPrintReceipt(role, kind)))
        throw new Failure("ACCESS_DENIED", "Seu perfil não pode emitir documentos.")
      return this.repository.settings(scope)
    })
  }
  update(actor: Actor, restaurantId: string, input: unknown) {
    return this.operation.run("printing.update", async () => {
      const scope = await this.access.restaurant(
        actor,
        restaurantId,
        "printing:configure",
      )
      const configuration = validate(updatePrintingSettingsSchema, input)
      if (!(await this.logos.validate(configuration.logo)))
        throw new Failure(
          "VALIDATION",
          "Selecione novamente uma imagem válida para o logo.",
          {
            logo: "O arquivo não é uma imagem PNG válida. Selecione novamente o logo.",
          },
        )
      return this.repository.update(scope, configuration)
    })
  }
  order(actor: Actor, restaurantId: string, orderId: string, inputKind: unknown) {
    return this.operation.run("printing.order", async () => {
      const kind = validate(receiptKindSchema, inputKind)
      if (kind === "PAYMENT")
        throw new Failure(
          "VALIDATION",
          "Selecione um recebimento para emitir seu comprovante.",
        )
      return this.document(actor, restaurantId, validate(uuid, orderId), kind)
    })
  }
  payment(actor: Actor, restaurantId: string, paymentId: string) {
    return this.operation.run("printing.payment", async () =>
      this.document(actor, restaurantId, validate(uuid, paymentId), "PAYMENT"),
    )
  }
  private async document(
    actor: Actor,
    restaurantId: string,
    id: string,
    kind: import("@cardapio/contracts").ReceiptKind,
  ) {
    const { scope, role } = await this.access.grant(
      actor,
      restaurantId,
      kind === "PAYMENT" ? "payments:read" : "orders:read",
    )
    if (!canPrintReceipt(role, kind))
      throw new Failure("ACCESS_DENIED", "Seu perfil não pode emitir este documento.")
    const source = await this.repository.source(scope, kind, id, {
      userId: actor.userId,
      role,
    })
    return buildReceipt(source, kind, this.clock.now().toISOString())
  }
}
