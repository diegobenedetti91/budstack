-- AlterTable
ALTER TABLE `Subscription` ADD COLUMN `lastPauseAt` DATETIME(3) NULL,
    ADD COLUMN `nextPlan` VARCHAR(191) NULL,
    ADD COLUMN `nextPlanPriceCents` INTEGER NULL,
    ADD COLUMN `pauseFrom` DATETIME(3) NULL,
    ADD COLUMN `pauseUntil` DATETIME(3) NULL;

