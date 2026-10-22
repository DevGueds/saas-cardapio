import { test } from "node:test"
import assert from "node:assert/strict"
import { roles } from "@cardapio/domain/permissions"
import {
  staffNotificationRelevant,
  staffNotificationText,
} from "../../src/modules/engagement/application/staff-notifications.js"

test("staff notification routing respects role, assignment and customer-only consent events", () => {
  const order = { courierId: "courier-a" },
    event = { kind: "ORDER", status: "NEW" }
  assert.equal(staffNotificationRelevant("KITCHEN", "cook", event, order), true)
  assert.equal(
    staffNotificationRelevant(
      "KITCHEN",
      "cook",
      { ...event, status: "OUT_FOR_DELIVERY" },
      order,
    ),
    false,
  )
  assert.equal(
    staffNotificationRelevant(
      "COURIER",
      "courier-a",
      { ...event, status: "ASSIGNED" },
      order,
    ),
    true,
  )
  assert.equal(
    staffNotificationRelevant(
      "COURIER",
      "courier-b",
      { ...event, status: "ASSIGNED" },
      order,
    ),
    false,
  )
  for (const role of roles) {
    assert.equal(
      staffNotificationRelevant(role, "courier-a", { ...event, kind: "PAYMENT" }, order),
      ["OWNER", "MANAGER", "CASHIER"].includes(role),
    )
    assert.equal(
      staffNotificationRelevant(
        role,
        "courier-a",
        { ...event, kind: "SUBSCRIBED" },
        order,
      ),
      false,
    )
  }
  assert.match(
    staffNotificationText({ ...event, orderId: "abcd1234" }).message,
    /itens, adicionais e observações/,
  )
})
