-- CreateTable
CREATE TABLE `User` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tenant` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Membership` (
    `tenantId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `role` ENUM('OWNER', 'MANAGER', 'STAFF') NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    INDEX `Membership_userId_active_idx`(`userId`, `active`),
    PRIMARY KEY (`tenantId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `csrfHash` CHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
    INDEX `Session_userId_expiresAt_idx`(`userId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Restaurant` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NOT NULL,
    `whatsapp` VARCHAR(30) NOT NULL,
    `whatsappConfigured` BOOLEAN NOT NULL DEFAULT false,
    `address` VARCHAR(500) NOT NULL,
    `logoUrl` MEDIUMTEXT NOT NULL,
    `coverUrl` MEDIUMTEXT NOT NULL,
    `deliveryFee` INTEGER NOT NULL DEFAULT 0,
    `minOrder` INTEGER NOT NULL DEFAULT 0,
    `eta` VARCHAR(80) NOT NULL,
    `isOpen` BOOLEAN NOT NULL DEFAULT false,
    `revision` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Restaurant_slug_key`(`slug`),
    INDEX `Restaurant_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    UNIQUE INDEX `Restaurant_tenantId_id_key`(`tenantId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `restaurantId` CHAR(36) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `normalizedName` VARCHAR(80) NOT NULL,

    UNIQUE INDEX `Category_tenantId_restaurantId_id_key`(`tenantId`, `restaurantId`, `id`),
    UNIQUE INDEX `Category_tenantId_restaurantId_normalizedName_key`(`tenantId`, `restaurantId`, `normalizedName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `restaurantId` CHAR(36) NOT NULL,
    `categoryId` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NOT NULL,
    `price` INTEGER NOT NULL,
    `imageUrl` MEDIUMTEXT NOT NULL,
    `available` BOOLEAN NOT NULL DEFAULT true,
    `popular` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `Product_tenantId_restaurantId_id_key`(`tenantId`, `restaurantId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `restaurantId` CHAR(36) NOT NULL,
    `revision` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('NEW', 'PREPARING', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'NEW',
    `customer` JSON NOT NULL,
    `items` JSON NOT NULL,
    `subtotal` INTEGER NOT NULL,
    `deliveryFee` INTEGER NOT NULL,
    `total` INTEGER NOT NULL,
    `checkoutRevision` INTEGER NOT NULL,
    `whatsappUrl` MEDIUMTEXT NOT NULL,
    `idempotencyHash` CHAR(64) NOT NULL,
    `payloadHash` CHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Order_tenantId_restaurantId_createdAt_id_idx`(`tenantId`, `restaurantId`, `createdAt`, `id`),
    UNIQUE INDEX `Order_tenantId_restaurantId_idempotencyHash_key`(`tenantId`, `restaurantId`, `idempotencyHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RateLimit` (
    `key` CHAR(64) NOT NULL,
    `count` INTEGER NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `RateLimit_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Membership` ADD CONSTRAINT `Membership_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Membership` ADD CONSTRAINT `Membership_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Restaurant` ADD CONSTRAINT `Restaurant_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_tenantId_restaurantId_fkey` FOREIGN KEY (`tenantId`, `restaurantId`) REFERENCES `Restaurant`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_tenantId_restaurantId_fkey` FOREIGN KEY (`tenantId`, `restaurantId`) REFERENCES `Restaurant`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_tenantId_restaurantId_categoryId_fkey` FOREIGN KEY (`tenantId`, `restaurantId`, `categoryId`) REFERENCES `Category`(`tenantId`, `restaurantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_tenantId_restaurantId_fkey` FOREIGN KEY (`tenantId`, `restaurantId`) REFERENCES `Restaurant`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defense in depth for values written outside the application.
ALTER TABLE Restaurant ADD CONSTRAINT restaurant_money CHECK (deliveryFee >= 0 AND minOrder >= 0), ADD CONSTRAINT restaurant_revision CHECK (revision >= 0);
ALTER TABLE Product ADD CONSTRAINT product_price CHECK (price > 0);
ALTER TABLE `Order` ADD CONSTRAINT order_totals CHECK (subtotal > 0 AND deliveryFee >= 0 AND total = subtotal + deliveryFee), ADD CONSTRAINT order_revision CHECK (revision >= 0 AND checkoutRevision >= 0);
