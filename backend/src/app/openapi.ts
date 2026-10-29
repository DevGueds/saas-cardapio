import { z } from "zod"
import * as contracts from "@cardapio/contracts"
const requestSchemas = {
  LegalAcceptance: contracts.legalAcceptanceSchema,
  PrivacyRequest: contracts.privacyRequestInputSchema,
  PrivacyExport: contracts.privacyExportInputSchema,
  Addon: contracts.saveAddonSchema,
  Appearance: contracts.saveAppearanceSchema,
  Channels: contracts.updateChannelsSchema,
  Push: contracts.pushSubscriptionSchema,
  RemovePush: z.strictObject({ endpoint: z.string().url().max(2048) }),
  Consent: contracts.customerConsentSchema,
  ReadNotifications: z.strictObject({ before: z.iso.datetime() }),
  Login: contracts.loginSchema,
  MfaSetup: contracts.reauthenticationSchema,
  MfaProof: contracts.mfaProofSchema,
  MfaDisable: contracts.mfaDisableSchema,
  SecurityPolicy: contracts.securityPolicyChangeSchema,
  SecurityMember: contracts.securityMemberChangeSchema,
  Payment: contracts.paymentInputSchema,
  PaymentReversal: contracts.reversalSchema,
  PrintingSettings: contracts.updatePrintingSettingsSchema,
  AccountRegistration: contracts.accountRegistrationSchema,
  Combo: contracts.saveComboSchema,
  Promotion: contracts.savePromotionSchema,
  Delivery: contracts.saveDeliverySchema,
  Quote: contracts.quoteRequestSchema,
  Assignment: contracts.assignmentSchema,
  Registration: contracts.registrationSchema,
  Password: contracts.passwordChangeSchema,
  Product: contracts.saveProductSchema,
  Settings: contracts.updateSettingsSchema,
  Checkout: contracts.checkoutSchema,
  Transition: contracts.orderTransitionSchema,
  Tenant: contracts.tenantCreationSchema,
  Restaurant: contracts.restaurantCreationSchema,
  Member: contracts.memberSchema,
  Availability: contracts.availabilitySchema,
  Delete: contracts.deleteSchema,
  Open: contracts.openSchema,
  Hours: contracts.updateHoursSchema,
}
const operations = [
  ["/restaurants/{restaurantId}/hours", "put", "Hours"],
  ["/restaurants/{restaurantId}/analytics", "get"],
  ["/public/restaurants/{slug}/best-sellers", "get", null, true],
  ["/me/privacy", "get"],
  ["/me/privacy/export", "post", "PrivacyExport"],
  ["/me/privacy/acceptance", "post", "LegalAcceptance"],
  ["/me/privacy/requests", "post", "PrivacyRequest"],
  ["/restaurants/{restaurantId}/printing/settings", "get"],
  ["/restaurants/{restaurantId}/printing/settings", "put", "PrintingSettings"],
  ["/restaurants/{restaurantId}/orders/{orderId}/documents/{kind}", "get"],
  ["/restaurants/{restaurantId}/payments/{paymentId}/document", "get"],
  ["/restaurants/{restaurantId}/addons", "put", "Addon"],
  ["/restaurants/{restaurantId}/addons/{groupId}", "delete", "Delete"],
  ["/restaurants/{restaurantId}/appearance", "put", "Appearance"],
  ["/restaurants/{restaurantId}/channels", "get"],
  ["/restaurants/{restaurantId}/channels", "put", "Channels"],
  ["/restaurants/{restaurantId}/notifications", "get"],
  ["/restaurants/{restaurantId}/notifications/read", "post", "ReadNotifications"],
  ["/restaurants/{restaurantId}/notification-deliveries", "get"],
  ["/restaurants/{restaurantId}/push", "post", "Push"],
  ["/restaurants/{restaurantId}/push", "delete", "RemovePush"],
  ["/restaurants/{restaurantId}/whatsapp", "get"],
  ["/restaurants/{restaurantId}/whatsapp/connect", "post"],
  ["/restaurants/{restaurantId}/whatsapp", "delete"],
  ["/public/push/configuration", "get", null, true],
  ["/public/restaurants/{slug}/board/stream", "get", null, true],
  ["/public/restaurants/{slug}/orders/{orderId}/notifications", "get", null, true],
  ["/public/restaurants/{slug}/orders/{orderId}/notifications", "put", "Consent", true],
  ["/public/restaurants/{slug}/orders/{orderId}/push", "post", "Push", true],
  ["/public/restaurants/{slug}/orders/{orderId}/push", "delete", "RemovePush", true],
  ["/restaurants/{restaurantId}/payments", "post", "Payment"],
  ["/restaurants/{restaurantId}/payments", "get"],
  ["/restaurants/{restaurantId}/payments/{paymentId}/reverse", "post", "PaymentReversal"],
  ["/restaurants/{restaurantId}/orders/{orderId}/balance", "get"],
  ["/restaurants/{restaurantId}/reports/financial", "get"],
  ["/auth/register-account", "post", "AccountRegistration", true],
  ["/public/addresses/{cep}", "get", null, true],
  ["/public/restaurants/{slug}/checkout/quote", "post", "Quote", true],
  ["/public/restaurants/{slug}/checkout/attempt", "get", null, true],
  ["/public/restaurants/{slug}/orders/{orderId}", "get", null, true],
  ["/restaurants/{restaurantId}/combos", "put", "Combo"],
  ["/restaurants/{restaurantId}/combos/{offerId}", "delete", "Delete"],
  ["/restaurants/{restaurantId}/promotions", "put", "Promotion"],
  ["/restaurants/{restaurantId}/promotions/{offerId}", "delete", "Delete"],
  ["/restaurants/{restaurantId}/delivery", "put", "Delivery"],
  ["/restaurants/{restaurantId}/couriers", "get"],
  ["/restaurants/{restaurantId}/orders/{orderId}/courier", "put", "Assignment"],
  ["/auth/register", "post", "Registration", true],
  ["/auth/login", "post", "Login", true],
  ["/auth/mfa", "get"],
  ["/auth/mfa/setup", "post", "MfaSetup"],
  ["/auth/mfa/verify", "post", "MfaProof"],
  ["/auth/mfa", "delete", "MfaDisable"],
  ["/tenants/{tenantId}/security", "get"],
  ["/tenants/{tenantId}/security", "put", "SecurityPolicy"],
  ["/tenants/{tenantId}/security/{userId}", "put", "SecurityMember"],
  ["/auth/session", "get"],
  ["/auth/logout", "post"],
  ["/auth/password", "put", "Password"],
  ["/me/restaurants", "get"],
  ["/tenants", "post", "Tenant"],
  ["/tenants/{tenantId}/restaurants", "post", "Restaurant"],
  ["/tenants/{tenantId}/members", "get"],
  ["/tenants/{tenantId}/members", "post", "Member"],
  ["/tenants/{tenantId}/members/{userId}", "delete"],
  ["/public/restaurants/{slug}/menu", "get", null, true],
  ["/public/restaurants/{slug}/checkout/prepare", "post", "Checkout", true],
  ["/public/restaurants/{slug}/orders", "post", "Checkout", true],
  ["/restaurants/{restaurantId}/menu", "get"],
  ["/restaurants/{restaurantId}/products", "post", "Product"],
  ["/restaurants/{restaurantId}/products/{productId}", "put", "Product"],
  ["/restaurants/{restaurantId}/products/{productId}", "delete", "Delete"],
  [
    "/restaurants/{restaurantId}/products/{productId}/availability",
    "put",
    "Availability",
  ],
  ["/restaurants/{restaurantId}/settings", "put", "Settings"],
  ["/restaurants/{restaurantId}/open", "put", "Open"],
  ["/restaurants/{restaurantId}/orders", "get"],
  ["/restaurants/{restaurantId}/orders/{orderId}/status", "put", "Transition"],
] as const
const paths: Record<string, Record<string, unknown>> = {}
for (const entry of operations) {
  const [path, method] = entry
  const schema = entry.length > 2 ? entry[2] : null
  const isPublic = entry.length > 3 && entry[3]
  paths[path] ??= {}
  const parameters: unknown[] = [...path.matchAll(/\{(\w+)\}/g)].map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: { type: "string" },
  }))
  if (method !== "get")
    parameters.push({
      name: "Origin",
      in: "header",
      required: true,
      schema: { type: "string" },
    })
  if (
    method === "get" &&
    (path.endsWith("/payments") || path.endsWith("/reports/financial"))
  ) {
    for (const name of ["from", "to"])
      parameters.push({
        name,
        in: "query",
        required: true,
        schema: { type: "string", format: "date-time" },
      })
    if (path.endsWith("/payments"))
      parameters.push({
        name: "cursor",
        in: "query",
        required: false,
        schema: { type: "string", format: "uuid" },
      })
  }
  if (method !== "get" && !isPublic)
    parameters.push({
      name: "X-CSRF-Token",
      in: "header",
      required: true,
      schema: { type: "string" },
    })
  if (path.startsWith("/public/restaurants/{slug}/orders/{orderId}"))
    parameters.push({
      name: "X-Order-Token",
      in: "header",
      required: true,
      schema: { type: "string", pattern: "^[a-f0-9]{64}$" },
    })
  if (path.endsWith("/board/stream"))
    parameters.push({
      name: "X-Board-Key",
      in: "header",
      required: true,
      schema: { type: "string", pattern: "^[a-f0-9]{64}$" },
    })
  if (
    path === "/public/restaurants/{slug}/orders" ||
    path === "/public/restaurants/{slug}/checkout/attempt"
  )
    parameters.push({
      name: "Idempotency-Key",
      in: "header",
      required: true,
      schema: { type: "string", format: "uuid" },
    })
  paths[path][method] = {
    security: isPublic ? [] : [{ session: [] }],
    parameters,
    ...(schema
      ? {
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: `#/components/schemas/${schema}` } },
            },
          },
        }
      : {}),
    responses: {
      "200": path.endsWith("/board/stream")
        ? {
            description:
              "SSE: snapshot inicial, delta (upsert/remove), heartbeat e unavailable. Reconexão recebe snapshot completo. Chave revogável pelo gerente.",
            content: { "text/event-stream": { schema: { type: "string" } } },
          }
        : { description: "Result com ok: true e value." },
      "201": { description: "Operação concluída; consulte value." },
      "4XX": {
        description:
          "Result com ok: false e error (code, message, fields, diagnosticId).",
      },
      "503": { description: "Dependência indisponível; operação bloqueada." },
    },
  }
}
export const openApi = {
  openapi: "3.1.0",
  info: {
    title: "Cardápio API",
    version: "0.1.0",
    description:
      "Mutações exigem Origin autorizado e JSON; sessão por cookie HttpOnly e CSRF nas operações privadas. Valores monetários em centavos.",
  },
  servers: [{ url: "/api/v1" }],
  paths,
  components: {
    securitySchemes: {
      session: { type: "apiKey", in: "cookie", name: "cardapio_session" },
    },
    schemas: Object.fromEntries(
      Object.entries(requestSchemas).map(([key, schema]) => [
        key,
        z.toJSONSchema(schema, { unrepresentable: "any" }),
      ]),
    ),
  },
}
