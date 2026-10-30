import { describe, expect, it } from "vitest"
import {
  currentLegalAcceptance,
  legalAcceptanceSchema,
  registrationSchema,
} from "@cardapio/contracts"
import { PrivateCheckoutStorage } from "../src/shared/infrastructure/private-checkout-storage"
import { createReduxDrafts } from "../src/shared/infrastructure/redux-drafts"
import { DRAFT_PREFIX } from "../src/shared/application/drafts"
import { TestStorage } from "./helpers"

describe("privacy and legal acceptance", () => {
  it("requires an explicit acceptance of the current documents at registration", () => {
    const data = {
      name: "Ana",
      email: "ana@example.test",
      password: "M7!qR2@x",
      restaurantName: "Loja",
      slug: "minha-loja",
    }
    expect(registrationSchema.safeParse(data).success).toBe(false)
    expect(
      registrationSchema.safeParse({ ...data, legalAcceptance: currentLegalAcceptance })
        .success,
    ).toBe(true)
    for (const acceptance of [
      { ...currentLegalAcceptance, accepted: false },
      { ...currentLegalAcceptance, termsVersion: "old" },
      { ...currentLegalAcceptance, privacyVersion: "old" },
      { ...currentLegalAcceptance, userId: "other" },
    ])
      expect(legalAcceptanceSchema.safeParse(acceptance).success).toBe(false)
  })
  it("moves legacy checkout details to this tab and preserves carts and tracking receipts", () => {
    const persistent = new TestStorage(),
      tab = new TestStorage()
    const key = DRAFT_PREFIX + "api:customer:store:checkout",
      cart = DRAFT_PREFIX + "api:customer:store:cart"
    persistent.setItem(key, "private details")
    persistent.setItem(cart, "cart")
    persistent.setItem("receipt", "tracking")
    const storage = new PrivateCheckoutStorage(
      () => persistent,
      () => tab,
    )
    expect(storage.getItem(key)).toBe("private details")
    expect(persistent.getItem(key)).toBeNull()
    expect(tab.getItem(key)).toBe("private details")
    storage.setItem(key, "new private details")
    expect(persistent.getItem(key)).toBeNull()
    const anotherTab = new PrivateCheckoutStorage(
      () => persistent,
      () => new TestStorage(),
    )
    expect(anotherTab.getItem(key)).toBeNull()
    expect(anotherTab.getItem(cart)).toBe("cart")
    expect(anotherTab.getItem("receipt")).toBe("tracking")
  })
  it("keeps legacy details when the tab cannot persist them", () => {
    const persistent = new TestStorage(),
      tab = new TestStorage(),
      key = DRAFT_PREFIX + "api:customer:store:checkout"
    persistent.setItem(key, "private details")
    tab.writeError = new Error("unavailable")
    const storage = new PrivateCheckoutStorage(
      () => persistent,
      () => tab,
    )
    expect(() => storage.getItem(key)).toThrow()
    expect(persistent.getItem(key)).toBe("private details")
  })
  it("clears only customer checkout drafts, synchronizes observers and reports storage failures", () => {
    const persistent = new TestStorage(),
      tab = new TestStorage()
    const storage = new PrivateCheckoutStorage(
        () => persistent,
        () => tab,
      ),
      drafts = createReduxDrafts(() => storage)
    for (const key of [
      "api:customer:store:checkout",
      "demo:customer:other:checkout",
      "api:customer:store:cart",
      "api:admin:user:store:product",
    ])
      expect(drafts.set(key, { value: key })).toBe(true)
    persistent.setItem("pending-checkout", "idempotency")
    expect(drafts.clearCustomerDetails?.()).toBe(true)
    expect(drafts.snapshot("api:customer:store:checkout")).toBeUndefined()
    expect(drafts.snapshot("demo:customer:other:checkout")).toBeUndefined()
    expect(drafts.snapshot("api:customer:store:cart")).toBeDefined()
    expect(drafts.snapshot("api:admin:user:store:product")).toBeDefined()
    expect(persistent.getItem("pending-checkout")).toBe("idempotency")
    drafts.set("api:customer:store:checkout", { name: "Ana" })
    tab.writeError = new Error("unavailable")
    expect(drafts.clearCustomerDetails?.()).toBe(false)
  })
})
