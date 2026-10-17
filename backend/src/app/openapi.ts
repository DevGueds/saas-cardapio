import { z } from "zod"
import * as contracts from "@cardapio/contracts"
const requestSchemas = {
  Login: contracts.loginSchema,
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
}
const operations = [
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
  if (method !== "get" && !isPublic)
    parameters.push({
      name: "X-CSRF-Token",
      in: "header",
      required: true,
      schema: { type: "string" },
    })
  if (path === "/public/restaurants/{slug}/orders/{orderId}")
    parameters.push({
      name: "X-Order-Token",
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
      "200": { description: "Result com ok: true e value." },
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
