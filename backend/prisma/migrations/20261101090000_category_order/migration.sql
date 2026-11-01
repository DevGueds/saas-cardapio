ALTER TABLE "Category" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- Preserve the existing alphabetical display until the owner chooses another order.
WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "tenantId", "restaurantId" ORDER BY "name", "id") - 1 AS position
  FROM "Category"
)
UPDATE "Category" SET "position" = ordered.position FROM ordered WHERE "Category"."id" = ordered."id";

CREATE INDEX "Category_tenantId_restaurantId_position_idx" ON "Category"("tenantId", "restaurantId", "position");
