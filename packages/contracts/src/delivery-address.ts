import { z } from "zod"
import { Failure } from "@cardapio/domain/failure"
import {
  addressKinds,
  addressTextLimits,
  parseAddressText,
  parseDeliveryAddress,
  type AddressTextField,
  type DeliveryAddress,
} from "@cardapio/domain/delivery-address"

export function addressTextField(
  field: AddressTextField,
  context?: Pick<DeliveryAddress, "noNumber" | "kind">,
) {
  return z.string().transform((value, ctx) => {
    try {
      return parseAddressText(field, value, context)
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message:
          error instanceof Failure ? error.message : "Confira este campo do endereço.",
      })
      return z.NEVER
    }
  })
}
// Preserve incomplete input in drafts and allow pickup without a delivery address.
export const deliveryAddressDraftSchema = z.strictObject({
  street: z.string().max(addressTextLimits.street),
  number: z.string().max(addressTextLimits.number),
  noNumber: z.boolean(),
  complement: z.string().max(addressTextLimits.complement),
  neighborhood: z.string().max(addressTextLimits.neighborhood),
  city: z.string().max(addressTextLimits.city),
  state: z.string().max(addressTextLimits.state),
  postalCode: z.string().max(addressTextLimits.postalCode),
  reference: z.string().max(addressTextLimits.reference),
  kind: z.enum(addressKinds),
})
export const deliveryAddressSchema = deliveryAddressDraftSchema.transform(
  (value, ctx) => {
    try {
      return parseDeliveryAddress(value)
    } catch (error) {
      if (error instanceof Failure && Object.keys(error.fields).length)
        for (const [field, message] of Object.entries(error.fields))
          ctx.addIssue({ code: "custom", path: [field], message })
      else ctx.addIssue({ code: "custom", message: "Confira o endereço de entrega." })
      return z.NEVER
    }
  },
)
