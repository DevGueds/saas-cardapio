ALTER TABLE `Order` ADD COLUMN `whatsappConsentAt` DATETIME(3) NULL, ADD COLUMN `whatsappRevokedAt` DATETIME(3) NULL;
CREATE TABLE `StoreChannel` (
  `restaurantId` CHAR(36) NOT NULL, `tenantId` CHAR(36) NOT NULL,
  `revision` INTEGER NOT NULL DEFAULT 0, `boardEnabled` BOOLEAN NOT NULL DEFAULT false,
  `boardVersion` CHAR(36) NOT NULL, `whatsappEnabled` BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (`restaurantId`), UNIQUE INDEX `StoreChannel_tenantId_restaurantId_key` (`tenantId`,`restaurantId`),
  CONSTRAINT `StoreChannel_tenantId_restaurantId_fkey` FOREIGN KEY (`tenantId`,`restaurantId`) REFERENCES `Restaurant` (`tenantId`,`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `NotificationEvent` (
  `id` CHAR(36) NOT NULL, `tenantId` CHAR(36) NOT NULL, `restaurantId` CHAR(36) NOT NULL,
  `orderId` CHAR(36) NOT NULL, `kind` VARCHAR(10) NOT NULL, `status` VARCHAR(20) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `expandedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`), INDEX `NotificationEvent_expandedAt_createdAt_idx` (`expandedAt`,`createdAt`),
  INDEX `NotificationEvent_tenantId_restaurantId_createdAt_idx` (`tenantId`,`restaurantId`,`createdAt`),
  CONSTRAINT `NotificationEvent_tenantId_restaurantId_fkey` FOREIGN KEY (`tenantId`,`restaurantId`) REFERENCES `Restaurant` (`tenantId`,`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `NotificationEvent_tenantId_restaurantId_orderId_fkey` FOREIGN KEY (`tenantId`,`restaurantId`,`orderId`) REFERENCES `Order` (`tenantId`,`restaurantId`,`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `PushSubscription` (
  `id` CHAR(36) NOT NULL, `tenantId` CHAR(36) NOT NULL, `restaurantId` CHAR(36) NOT NULL,
  `orderId` CHAR(36) NULL, `userId` CHAR(36) NULL, `endpointHash` CHAR(64) NOT NULL,
  `encrypted` TEXT NOT NULL, `expiresAt` DATETIME(3) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE INDEX `PushSubscription_tenantId_restaurantId_endpointHash_key` (`tenantId`,`restaurantId`,`endpointHash`),
  INDEX `PushSubscription_tenantId_restaurantId_orderId_userId_idx` (`tenantId`,`restaurantId`,`orderId`,`userId`),
  CONSTRAINT `PushSubscription_tenantId_restaurantId_fkey` FOREIGN KEY (`tenantId`,`restaurantId`) REFERENCES `Restaurant` (`tenantId`,`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PushSubscription_tenantId_restaurantId_orderId_fkey` FOREIGN KEY (`tenantId`,`restaurantId`,`orderId`) REFERENCES `Order` (`tenantId`,`restaurantId`,`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `NotificationDelivery` (
  `id` CHAR(36) NOT NULL, `eventId` CHAR(36) NOT NULL, `channel` VARCHAR(10) NOT NULL, `recipient` VARCHAR(100) NOT NULL,
  `state` VARCHAR(12) NOT NULL DEFAULT 'PENDING', `attempts` INTEGER NOT NULL DEFAULT 0,
  `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `claimedAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE INDEX `NotificationDelivery_eventId_channel_recipient_key` (`eventId`,`channel`,`recipient`),
  INDEX `NotificationDelivery_state_availableAt_idx` (`state`,`availableAt`),
  CONSTRAINT `NotificationDelivery_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `NotificationEvent` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `InboxRead` (
  `tenantId` CHAR(36) NOT NULL, `restaurantId` CHAR(36) NOT NULL, `userId` CHAR(36) NOT NULL, `readAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`tenantId`,`restaurantId`,`userId`),
  CONSTRAINT `InboxRead_tenantId_restaurantId_fkey` FOREIGN KEY (`tenantId`,`restaurantId`) REFERENCES `Restaurant` (`tenantId`,`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
