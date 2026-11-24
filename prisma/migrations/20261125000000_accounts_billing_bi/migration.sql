-- AlterTable
ALTER TABLE `Subscription` ADD COLUMN `campaign` VARCHAR(120) NULL,
    ADD COLUMN `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `cancelReason` VARCHAR(255) NULL,
    ADD COLUMN `canceledAt` DATETIME(3) NULL,
    ADD COLUMN `currentPeriodEnd` DATETIME(3) NULL,
    ADD COLUMN `currentPeriodStart` DATETIME(3) NULL,
    ADD COLUMN `endedAt` DATETIME(3) NULL,
    ADD COLUMN `endedReason` VARCHAR(191) NULL,
    ADD COLUMN `graceUntil` DATETIME(3) NULL,
    ADD COLUMN `medium` VARCHAR(60) NULL,
    ADD COLUMN `mpInitPoint` TEXT NULL,
    ADD COLUMN `reminders` VARCHAR(2000) NOT NULL DEFAULT '[]',
    ADD COLUMN `source` VARCHAR(60) NULL,
    ADD COLUMN `userId` VARCHAR(191) NULL,
    ADD COLUMN `visitorId` VARCHAR(40) NULL;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `document` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'CUSTOMER',
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastLoginAt` DATETIME(3) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userAgent` VARCHAR(200) NULL,

    INDEX `Session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordReset` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PasswordReset_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoginAttempt` (
    `key` VARCHAR(191) NOT NULL,
    `count` INTEGER NOT NULL,
    `until` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Plan` (
    `id` VARCHAR(40) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `tagline` VARCHAR(255) NOT NULL,
    `monthlyCents` INTEGER NOT NULL,
    `highlight` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Feature` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlanFeature` (
    `planId` VARCHAR(40) NOT NULL,
    `featureId` VARCHAR(191) NOT NULL,

    INDEX `PlanFeature_featureId_idx`(`featureId`),
    PRIMARY KEY (`planId`, `featureId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `key` VARCHAR(80) NOT NULL,
    `value` TEXT NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `domainCents` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `dueDate` DATETIME(3) NOT NULL,
    `periodStart` DATETIME(3) NULL,
    `periodEnd` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `reference` VARCHAR(80) NULL,
    `mpPaymentId` VARCHAR(40) NULL,
    `mpPreferenceId` VARCHAR(191) NULL,
    `payUrl` TEXT NULL,
    `failureReason` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Invoice_reference_key`(`reference`),
    UNIQUE INDEX `Invoice_mpPaymentId_key`(`mpPaymentId`),
    INDEX `Invoice_subscriptionId_idx`(`subscriptionId`),
    INDEX `Invoice_status_dueDate_idx`(`status`, `dueDate`),
    INDEX `Invoice_paidAt_idx`(`paidAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubscriptionEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscriptionId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(40) NOT NULL,
    `amountCents` INTEGER NOT NULL DEFAULT 0,
    `detail` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SubscriptionEvent_subscriptionId_idx`(`subscriptionId`),
    INDEX `SubscriptionEvent_kind_createdAt_idx`(`kind`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PageView` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `visitorId` VARCHAR(40) NOT NULL,
    `path` VARCHAR(200) NOT NULL,
    `source` VARCHAR(60) NOT NULL,
    `medium` VARCHAR(60) NULL,
    `campaign` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PageView_createdAt_idx`(`createdAt`),
    INDEX `PageView_visitorId_idx`(`visitorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Subscription_userId_idx` ON `Subscription`(`userId`);

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordReset` ADD CONSTRAINT `PasswordReset_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanFeature` ADD CONSTRAINT `PlanFeature_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanFeature` ADD CONSTRAINT `PlanFeature_featureId_fkey` FOREIGN KEY (`featureId`) REFERENCES `Feature`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubscriptionEvent` ADD CONSTRAINT `SubscriptionEvent_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- ───────── Dados ─────────

-- Status novos: PAID → ACTIVE, CANCELLED → CANCELED. Período das assinaturas já pagas.
UPDATE `Subscription` SET `status` = 'ACTIVE',
  `currentPeriodStart` = COALESCE(`paidAt`, `createdAt`),
  `currentPeriodEnd` = CASE WHEN `cycle` = 'ANUAL' THEN DATE_ADD(COALESCE(`paidAt`, `createdAt`), INTERVAL 1 YEAR) ELSE DATE_ADD(COALESCE(`paidAt`, `createdAt`), INTERVAL 1 MONTH) END
  WHERE `status` = 'PAID';
UPDATE `Subscription` SET `status` = 'CANCELED', `endedReason` = 'not_paid', `endedAt` = `updatedAt` WHERE `status` = 'CANCELLED';

-- Planos e recursos iniciais (edite em Administração → Planos e recursos)
INSERT INTO `Plan` (`id`, `name`, `tagline`, `monthlyCents`, `highlight`, `active`, `sort`, `updatedAt`) VALUES
  ('essencial', 'Essencial', 'Para começar a vender online com a sua marca.', 14900, false, true, 1, CURRENT_TIMESTAMP(3)),
  ('profissional', 'Profissional', 'Para quem quer a operação no automático.', 24900, true, true, 2, CURRENT_TIMESTAMP(3)),
  ('completo', 'Completo', 'Para crescer com IA e marketing de dados.', 39900, false, true, 3, CURRENT_TIMESTAMP(3));

INSERT INTO `Feature` (`id`, `name`, `sort`, `active`) VALUES
  ('f01', 'Loja completa com a sua marca, logo e cores', 1, true),
  ('f02', 'Catálogo com tamanhos, cores e estoque por variação', 2, true),
  ('f03', 'Pix, cartão, NuPay, InfinitePay e pedido pelo WhatsApp', 3, true),
  ('f04', 'Frete pelo CEP: Correios, Melhor Envio, local ou retirada', 4, true),
  ('f05', 'Cupons e promoções relâmpago', 5, true),
  ('f06', 'Área do cliente com pedidos e rastreio', 6, true),
  ('f07', 'Painel com pedidos, clientes e relatórios', 7, true),
  ('f08', 'Nota fiscal automática pelo Bling', 8, true),
  ('f09', 'Etiqueta automática do Melhor Envio', 9, true),
  ('f10', 'Aviso de novo pedido com checklist', 10, true),
  ('f11', 'Cashback com crédito na loja', 11, true),
  ('f12', 'Recuperação de carrinho abandonado', 12, true),
  ('f13', 'DRE com lucro real, impostos e perdas', 13, true),
  ('f14', 'Atendimento com IA 24h', 14, true),
  ('f15', 'Meta Pixel + API de Conversões', 15, true),
  ('f16', 'Interesse por produto e aviso de promoção', 16, true),
  ('f17', 'Funil de conversão e origem de cada pedido', 17, true),
  ('f18', 'Suporte prioritário', 18, true);

INSERT INTO `PlanFeature` (`planId`, `featureId`)
  SELECT 'essencial', `id` FROM `Feature` WHERE `sort` <= 7
  UNION ALL SELECT 'profissional', `id` FROM `Feature` WHERE `sort` <= 13
  UNION ALL SELECT 'completo', `id` FROM `Feature`;
