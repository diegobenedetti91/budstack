-- AlterTable
ALTER TABLE `Invoice` ADD COLUMN `asaasPaymentId` VARCHAR(40) NULL;

-- AlterTable
ALTER TABLE `Subscription` ADD COLUMN `asaasSubscriptionId` VARCHAR(191) NULL,
    ADD COLUMN `provider` VARCHAR(191) NOT NULL DEFAULT 'MERCADOPAGO';

-- AlterTable
ALTER TABLE `User` ADD COLUMN `asaasCustomerId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `WebhookEvent` (
    `id` VARCHAR(120) NOT NULL,
    `provider` VARCHAR(20) NOT NULL,
    `type` VARCHAR(60) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Invoice_asaasPaymentId_key` ON `Invoice`(`asaasPaymentId`);

-- CreateIndex
CREATE INDEX `Subscription_asaasSubscriptionId_idx` ON `Subscription`(`asaasSubscriptionId`);

