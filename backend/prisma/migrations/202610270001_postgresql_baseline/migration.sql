BEGIN;
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'STAFF', 'CASHIER', 'KITCHEN', 'COURIER', 'VIEWER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MfaOverride" AS ENUM ('INHERIT', 'REQUIRED', 'EXEMPT');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mfaRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mfaOverride" "MfaOverride" NOT NULL DEFAULT 'INHERIT',

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("tenantId","userId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "csrfHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mfaVerifiedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaCredential" (
    "userId" UUID NOT NULL,
    "secret" VARCHAR(512) NOT NULL,
    "enabledAt" TIMESTAMPTZ(3),
    "pendingSessionId" UUID,
    "pendingExpiresAt" TIMESTAMPTZ(3),
    "lastCounter" BIGINT NOT NULL DEFAULT -1,
    "recoveryHashes" JSONB NOT NULL,

    CONSTRAINT "MfaCredential_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "tenantId" UUID,
    "subjectUserId" UUID,
    "action" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "whatsapp" VARCHAR(30) NOT NULL,
    "whatsappConfigured" BOOLEAN NOT NULL DEFAULT false,
    "address" VARCHAR(500) NOT NULL,
    "logoUrl" TEXT NOT NULL,
    "coverUrl" TEXT NOT NULL,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "minOrder" INTEGER NOT NULL DEFAULT 0,
    "eta" VARCHAR(80) NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "normalizedName" VARCHAR(80) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "popular" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "customer" JSONB NOT NULL,
    "items" JSONB NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "deliveryFee" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "fulfillment" JSONB,
    "promotionId" UUID,
    "promotionName" VARCHAR(120),
    "region" VARCHAR(300) NOT NULL DEFAULT '',
    "eta" VARCHAR(80) NOT NULL DEFAULT '',
    "courierId" UUID,
    "history" JSONB,
    "trackingHash" CHAR(64),
    "trackingExpiresAt" TIMESTAMPTZ(3),
    "checkoutRevision" INTEGER NOT NULL,
    "whatsappUrl" TEXT NOT NULL,
    "idempotencyHash" CHAR(64) NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "whatsappConsentAt" TIMESTAMPTZ(3),
    "whatsappRevokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" CHAR(64) NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "orderId" UUID,
    "amount" INTEGER NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "description" VARCHAR(160) NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    "requestHash" CHAR(64) NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "recordedBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMPTZ(3),
    "reversedBy" UUID,
    "reversalReason" VARCHAR(300),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorePrinting" (
    "restaurantId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "configuration" JSONB NOT NULL,

    CONSTRAINT "StorePrinting_pkey" PRIMARY KEY ("restaurantId")
);

-- CreateTable
CREATE TABLE "StoreCommerce" (
    "restaurantId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "combos" JSONB NOT NULL,
    "promotions" JSONB NOT NULL,
    "delivery" JSONB NOT NULL,
    "addonGroups" JSONB,
    "appearance" JSONB,

    CONSTRAINT "StoreCommerce_pkey" PRIMARY KEY ("restaurantId")
);

-- CreateTable
CREATE TABLE "StoreChannel" (
    "restaurantId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "boardEnabled" BOOLEAN NOT NULL DEFAULT false,
    "boardVersion" UUID NOT NULL,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StoreChannel_pkey" PRIMARY KEY ("restaurantId")
);

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expandedAt" TIMESTAMPTZ(3),

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "orderId" UUID,
    "userId" UUID,
    "sessionId" UUID,
    "endpointHash" CHAR(64) NOT NULL,
    "encrypted" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "channel" VARCHAR(10) NOT NULL,
    "recipient" VARCHAR(100) NOT NULL,
    "state" VARCHAR(12) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxRead" (
    "tenantId" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "readAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "InboxRead_pkey" PRIMARY KEY ("tenantId","restaurantId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_userId_active_idx" ON "Membership"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_tenantId_createdAt_idx" ON "SecurityEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_actorUserId_createdAt_idx" ON "SecurityEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

-- CreateIndex
CREATE INDEX "Restaurant_tenantId_createdAt_idx" ON "Restaurant"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_tenantId_id_key" ON "Restaurant"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Category_tenantId_restaurantId_id_key" ON "Category"("tenantId", "restaurantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Category_tenantId_restaurantId_normalizedName_key" ON "Category"("tenantId", "restaurantId", "normalizedName");

-- CreateIndex
CREATE INDEX "Product_tenantId_restaurantId_categoryId_idx" ON "Product"("tenantId", "restaurantId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_restaurantId_id_key" ON "Product"("tenantId", "restaurantId", "id");

-- CreateIndex
CREATE INDEX "Order_tenantId_restaurantId_createdAt_id_idx" ON "Order"("tenantId", "restaurantId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Order_tenantId_restaurantId_courierId_createdAt_idx" ON "Order"("tenantId", "restaurantId", "courierId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_tenantId_restaurantId_status_createdAt_id_idx" ON "Order"("tenantId", "restaurantId", "status", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Order_tenantId_restaurantId_id_key" ON "Order"("tenantId", "restaurantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Order_tenantId_restaurantId_idempotencyHash_key" ON "Order"("tenantId", "restaurantId", "idempotencyHash");

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");

-- CreateIndex
CREATE INDEX "Payment_tenantId_restaurantId_createdAt_id_idx" ON "Payment"("tenantId", "restaurantId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Payment_tenantId_restaurantId_reversedAt_idx" ON "Payment"("tenantId", "restaurantId", "reversedAt");

-- CreateIndex
CREATE INDEX "Payment_tenantId_restaurantId_orderId_idx" ON "Payment"("tenantId", "restaurantId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_tenantId_restaurantId_requestHash_key" ON "Payment"("tenantId", "restaurantId", "requestHash");

-- CreateIndex
CREATE UNIQUE INDEX "StorePrinting_tenantId_restaurantId_key" ON "StorePrinting"("tenantId", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreCommerce_tenantId_restaurantId_key" ON "StoreCommerce"("tenantId", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreChannel_tenantId_restaurantId_key" ON "StoreChannel"("tenantId", "restaurantId");

-- CreateIndex
CREATE INDEX "NotificationEvent_expandedAt_createdAt_idx" ON "NotificationEvent"("expandedAt", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationEvent_tenantId_restaurantId_createdAt_idx" ON "NotificationEvent"("tenantId", "restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationEvent_tenantId_restaurantId_orderId_createdAt_i_idx" ON "NotificationEvent"("tenantId", "restaurantId", "orderId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "PushSubscription_tenantId_restaurantId_orderId_userId_idx" ON "PushSubscription"("tenantId", "restaurantId", "orderId", "userId");

-- CreateIndex
CREATE INDEX "PushSubscription_tenantId_restaurantId_userId_expiresAt_idx" ON "PushSubscription"("tenantId", "restaurantId", "userId", "expiresAt");

-- CreateIndex
CREATE INDEX "PushSubscription_expiresAt_idx" ON "PushSubscription"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_tenantId_restaurantId_endpointHash_key" ON "PushSubscription"("tenantId", "restaurantId", "endpointHash");

-- CreateIndex
CREATE INDEX "NotificationDelivery_state_availableAt_idx" ON "NotificationDelivery"("state", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_eventId_channel_recipient_key" ON "NotificationDelivery"("eventId", "channel", "recipient");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaCredential" ADD CONSTRAINT "MfaCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_tenantId_restaurantId_fkey" FOREIGN KEY ("tenantId", "restaurantId") REFERENCES "Restaurant"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_restaurantId_fkey" FOREIGN KEY ("tenantId", "restaurantId") REFERENCES "Restaurant"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_restaurantId_categoryId_fkey" FOREIGN KEY ("tenantId", "restaurantId", "categoryId") REFERENCES "Category"("tenantId", "restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_restaurantId_fkey" FOREIGN KEY ("tenantId", "restaurantId") REFERENCES "Restaurant"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_restaurant_fkey" FOREIGN KEY ("tenantId", "restaurantId") REFERENCES "Restaurant"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_order_fkey" FOREIGN KEY ("tenantId", "restaurantId", "orderId") REFERENCES "Order"("tenantId", "restaurantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePrinting" ADD CONSTRAINT "StorePrinting_tenantId_restaurantId_fkey" FOREIGN KEY ("tenantId", "restaurantId") REFERENCES "Restaurant"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCommerce" ADD CONSTRAINT "StoreCommerce_tenantId_restaurantId_fkey" FOREIGN KEY ("tenantId", "restaurantId") REFERENCES "Restaurant"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreChannel" ADD CONSTRAINT "StoreChannel_tenantId_restaurantId_fkey" FOREIGN KEY ("tenantId", "restaurantId") REFERENCES "Restaurant"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_tenantId_restaurantId_fkey" FOREIGN KEY ("tenantId", "restaurantId") REFERENCES "Restaurant"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_tenantId_restaurantId_orderId_fkey" FOREIGN KEY ("tenantId", "restaurantId", "orderId") REFERENCES "Order"("tenantId", "restaurantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_tenantId_restaurantId_fkey" FOREIGN KEY ("tenantId", "restaurantId") REFERENCES "Restaurant"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_tenantId_restaurantId_orderId_fkey" FOREIGN KEY ("tenantId", "restaurantId", "orderId") REFERENCES "Order"("tenantId", "restaurantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NotificationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxRead" ADD CONSTRAINT "InboxRead_tenantId_restaurantId_fkey" FOREIGN KEY ("tenantId", "restaurantId") REFERENCES "Restaurant"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve monetary invariants independently of the API.
ALTER TABLE "Restaurant" ADD CONSTRAINT restaurant_money CHECK ("deliveryFee" >= 0 AND "minOrder" >= 0),
  ADD CONSTRAINT restaurant_revision CHECK (revision >= 0);
ALTER TABLE "Product" ADD CONSTRAINT product_price CHECK (price > 0);
ALTER TABLE "Order" ADD CONSTRAINT order_totals CHECK (
  subtotal > 0 AND "deliveryFee" >= 0 AND discount >= 0
  AND discount <= subtotal::bigint + "deliveryFee"::bigint
  AND total >= 0 AND total::bigint = subtotal::bigint + "deliveryFee"::bigint - discount::bigint
), ADD CONSTRAINT order_revision CHECK (revision >= 0 AND "checkoutRevision" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_positive_amount" CHECK (amount > 0),
  ADD CONSTRAINT "Payment_method" CHECK (method IN ('PIX','CASH','DEBIT','CREDIT','OTHER')),
  ADD CONSTRAINT "Payment_reversal" CHECK (
    ("reversedAt" IS NULL AND "reversedBy" IS NULL AND "reversalReason" IS NULL)
    OR ("reversedAt" IS NOT NULL AND "reversedBy" IS NOT NULL AND "reversalReason" IS NOT NULL)
  );
-- PostgreSQL uniqueness is case-sensitive; account identity remains case-insensitive.
CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (lower(email));
-- Runtime can perform DML only and cannot rewrite migration history.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cardapio')
    AND to_regclass('"_prisma_migrations"') IS NOT NULL THEN
    REVOKE ALL ON TABLE "_prisma_migrations" FROM cardapio;
  END IF;
END $$;
COMMIT;
