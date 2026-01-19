-- CreateEnum
CREATE TYPE "AnalysisMode" AS ENUM ('DEAL', 'DISCOVERY', 'QUICK_LOOKUP');

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "analysisMode" "AnalysisMode" NOT NULL DEFAULT 'DEAL',
ADD COLUMN     "currentPrice" JSONB,
ADD COLUMN     "demandSignals" JSONB,
ADD COLUMN     "highestPriceRegions" JSONB,
ADD COLUMN     "largestVolumeRegions" JSONB,
ADD COLUMN     "priceByRegion" JSONB,
ADD COLUMN     "riskSnapshot" JSONB,
ALTER COLUMN "ean" DROP NOT NULL,
ALTER COLUMN "quantity" DROP NOT NULL,
ALTER COLUMN "buyPrice" DROP NOT NULL,
ALTER COLUMN "currency" DROP NOT NULL,
ALTER COLUMN "supplierRegion" DROP NOT NULL,
ALTER COLUMN "dealScore" DROP NOT NULL,
ALTER COLUMN "netMargin" DROP NOT NULL,
ALTER COLUMN "demandConfidence" DROP NOT NULL,
ALTER COLUMN "volumeRisk" DROP NOT NULL,
ALTER COLUMN "dataReliability" DROP NOT NULL,
ALTER COLUMN "decision" DROP NOT NULL,
ALTER COLUMN "evaluationData" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Deal_analysisMode_idx" ON "Deal"("analysisMode");
