CREATE TABLE `SecurityEvent` (
  `id` CHAR(36) NOT NULL,
  `actorUserId` CHAR(36) NOT NULL,
  `tenantId` CHAR(36) NULL,
  `subjectUserId` CHAR(36) NULL,
  `action` VARCHAR(40) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `SecurityEvent_tenantId_createdAt_idx` (`tenantId`, `createdAt`),
  CONSTRAINT `SecurityEvent_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
