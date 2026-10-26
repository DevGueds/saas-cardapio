CREATE TABLE `StorePrinting` (
  `restaurantId` CHAR(36) NOT NULL,
  `tenantId` CHAR(36) NOT NULL,
  `revision` INTEGER NOT NULL DEFAULT 0,
  `configuration` JSON NOT NULL,
  UNIQUE INDEX `StorePrinting_tenantId_restaurantId_key` (`tenantId`, `restaurantId`),
  PRIMARY KEY (`restaurantId`),
  CONSTRAINT `StorePrinting_restaurant_fkey` FOREIGN KEY (`tenantId`, `restaurantId`) REFERENCES `Restaurant` (`tenantId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
