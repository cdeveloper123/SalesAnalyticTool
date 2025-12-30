-- CreateTable
CREATE TABLE "AssumptionOverride" (
    "id" TEXT NOT NULL,
    "dealId" TEXT,
    "sessionId" TEXT,
    "shippingOverrides" JSONB,
    "dutyOverrides" JSONB,
    "feeOverrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssumptionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssumptionPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "shippingOverrides" JSONB,
    "dutyOverrides" JSONB,
    "feeOverrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssumptionPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssumptionHistory" (
    "id" TEXT NOT NULL,
    "dealId" TEXT,
    "assumptionType" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssumptionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "ean" TEXT NOT NULL,
    "productName" TEXT,
    "quantity" INTEGER NOT NULL,
    "buyPrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "supplierRegion" TEXT NOT NULL,
    "dealScore" INTEGER NOT NULL,
    "netMargin" DOUBLE PRECISION NOT NULL,
    "demandConfidence" INTEGER NOT NULL,
    "volumeRisk" INTEGER NOT NULL,
    "dataReliability" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "explanation" TEXT,
    "bestChannel" TEXT,
    "bestMarketplace" TEXT,
    "bestMarginPercent" DOUBLE PRECISION,
    "bestCurrency" TEXT,
    "evaluationData" JSONB NOT NULL,
    "productData" JSONB,
    "marketData" JSONB,
    "assumptions" JSONB,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deal_ean_idx" ON "Deal"("ean");

-- CreateIndex
CREATE INDEX "Deal_analyzedAt_idx" ON "Deal"("analyzedAt");

-- CreateIndex
CREATE INDEX "Deal_decision_idx" ON "Deal"("decision");
