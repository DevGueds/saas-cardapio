ALTER TABLE `Membership` MODIFY `role` ENUM('OWNER','MANAGER','STAFF','CASHIER','KITCHEN','COURIER','VIEWER') NOT NULL;
ALTER TABLE `Order`
  MODIFY `status` ENUM('NEW','PREPARING','READY','OUT_FOR_DELIVERY','COMPLETED','CANCELLED') NOT NULL DEFAULT 'NEW',
  ADD COLUMN `discount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `fulfillment` JSON NULL,
  ADD COLUMN `promotionId` CHAR(36) NULL,
  ADD COLUMN `promotionName` VARCHAR(120) NULL,
  ADD COLUMN `region` VARCHAR(300) NOT NULL DEFAULT '',
  ADD COLUMN `eta` VARCHAR(80) NOT NULL DEFAULT '',
  ADD COLUMN `courierId` CHAR(36) NULL,
  ADD COLUMN `history` JSON NULL,
  ADD COLUMN `trackingHash` CHAR(64) NULL,
  ADD COLUMN `trackingExpiresAt` DATETIME(3) NULL;
CREATE INDEX `Order_tenantId_restaurantId_courierId_createdAt_idx` ON `Order` (`tenantId`,`restaurantId`,`courierId`,`createdAt`);
CREATE TABLE `StoreCommerce` (
  `restaurantId` CHAR(36) NOT NULL,
  `tenantId` CHAR(36) NOT NULL,
  `combos` JSON NOT NULL,
  `promotions` JSON NOT NULL,
  `delivery` JSON NOT NULL,
  PRIMARY KEY (`restaurantId`),
  UNIQUE INDEX `StoreCommerce_tenantId_restaurantId_key` (`tenantId`,`restaurantId`),
  CONSTRAINT `StoreCommerce_tenantId_restaurantId_fkey` FOREIGN KEY (`tenantId`,`restaurantId`) REFERENCES `Restaurant` (`tenantId`,`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
