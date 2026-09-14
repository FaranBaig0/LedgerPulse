-- CreateEnum
CREATE TYPE "AdPlatform" AS ENUM ('META', 'GOOGLE', 'TIKTOK');

-- AlterEnum
ALTER TYPE "FeeType" ADD VALUE 'GATEWAY_PROCESSING';

-- AlterTable
ALTER TABLE "order_fees" ADD COLUMN     "rawFeeDetails" JSONB;

-- CreateTable
CREATE TABLE "ad_spend_daily" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "platform" "AdPlatform" NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "campaignId" TEXT,
    "date" DATE NOT NULL,
    "spendCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_spend_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_spend_daily_tenantId_date_idx" ON "ad_spend_daily"("tenantId", "date");

-- AddForeignKey
ALTER TABLE "ad_spend_daily" ADD CONSTRAINT "ad_spend_daily_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
