ALTER TABLE `Tenant` ADD COLUMN `mfaRequired` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Membership` ADD COLUMN `mfaOverride` ENUM('INHERIT', 'REQUIRED', 'EXEMPT') NOT NULL DEFAULT 'INHERIT';
ALTER TABLE `Session` ADD COLUMN `mfaVerifiedAt` DATETIME(3) NULL;
CREATE TABLE `MfaCredential` (
  `userId` CHAR(36) NOT NULL,
  `secret` VARCHAR(512) NOT NULL,
  `enabledAt` DATETIME(3) NULL,
  `pendingSessionId` CHAR(36) NULL,
  `pendingExpiresAt` DATETIME(3) NULL,
  `lastCounter` BIGINT NOT NULL DEFAULT -1,
  `recoveryHashes` JSON NOT NULL,
  PRIMARY KEY (`userId`),
  CONSTRAINT `MfaCredential_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
