/**
 * Multi-Channel Deal Evaluator
 * 
 * Evaluates deals across multiple sales channels (Amazon, eBay, etc.)
 * Compares margins, demand, and risks to recommend best channels
 * Includes landed cost calculation (buy price + duty + shipping)
 */

import feeCalculator from './feeCalculator.js';
import demandEstimator from './demandEstimator.js';
import currencyService from './currencyService.js';
import ebayService from './ebayService.js';
import dutyCalculator from './dutyCalculator.js';
import shippingCalculator from './shippingCalculator.js';
import complianceService from './complianceService.js';
import retailerService from './retailerService.js';
import distributorService from './distributorService.js';

// Scoring weights
const WEIGHTS = {
  netMargin: 0.40,
  demandConfidence: 0.25,
  volumeRisk: 0.20,
  dataReliability: 0.15
};

// Thresholds
const THRESHOLDS = {
  minMarginPercent: 15,
  goodMarginPercent: 30,
  excellentMarginPercent: 50,
  maxMonthsToSell: 6,
  dangerMonthsToSell: 12,
  targetMarginPercent: 25  // For negotiation target price
};

/**
 * Calculate target and walk-away buy prices for negotiation
 */
function calculateNegotiationPrices(netProceeds, currentBuyPrice, currency) {
  // Target price to achieve 25% margin
  const targetBuyPrice = netProceeds / (1 + THRESHOLDS.targetMarginPercent / 100);

  // Walk-away price at minimum acceptable margin (15%)
  const walkAwayPrice = netProceeds / (1 + THRESHOLDS.minMarginPercent / 100);

  // Current margin
  const currentMargin = currentBuyPrice > 0
    ? ((netProceeds - currentBuyPrice) / currentBuyPrice) * 100
    : 0;

  return {
    currentBuyPrice: Number(currentBuyPrice.toFixed(2)),
    targetBuyPrice: Number(targetBuyPrice.toFixed(2)),
    walkAwayPrice: Number(walkAwayPrice.toFixed(2)),
    currency,
    currentMarginPercent: Number(currentMargin.toFixed(1)),
    targetMarginPercent: THRESHOLDS.targetMarginPercent,
    minMarginPercent: THRESHOLDS.minMarginPercent,
    savings: Number((currentBuyPrice - targetBuyPrice).toFixed(2)),
    savingsPercent: currentBuyPrice > 0
      ? Number((((currentBuyPrice - targetBuyPrice) / currentBuyPrice) * 100).toFixed(1))
      : 0
  };
}

/**
 * Generate alternative sourcing suggestions
 */
function generateSourcingSuggestion(currentSupplierRegion, targetBuyPrice, category) {
  // Alternative sourcing regions
  const regions = {
    CN: { name: 'China', pros: 'Lowest cost, high volume', cons: 'Longer lead times' },
    VN: { name: 'Vietnam', pros: 'Lower tariffs to US', cons: 'Limited categories' },
    TW: { name: 'Taiwan', pros: 'High quality electronics', cons: 'Higher cost' },
    IN: { name: 'India', pros: 'Low cost, growing capacity', cons: 'Variable quality' },
    MX: { name: 'Mexico', pros: 'USMCA benefits, fast shipping to US', cons: 'Higher labor cost' },
    EU: { name: 'EU', pros: 'UK/EU tariff benefits', cons: 'Higher base cost' }
  };

  // Suggest alternatives based on current region
  const alternatives = [];

  if (currentSupplierRegion !== 'CN') {
    alternatives.push({ region: 'CN', ...regions.CN });
  }
  if (currentSupplierRegion !== 'VN' && ['electronics', 'Toys & Games', 'Video Games'].includes(category)) {
    alternatives.push({ region: 'VN', ...regions.VN });
  }
  if (currentSupplierRegion !== 'MX') {
    alternatives.push({ region: 'MX', ...regions.MX });
  }

  return {
    currentRegion: currentSupplierRegion,
    targetBuyPrice: Number(targetBuyPrice.toFixed(2)),
    alternatives: alternatives.slice(0, 3),
    supplierTypes: [
      { type: 'Manufacturer Direct', estimatedSavings: '15-25%' },
      { type: 'Trading Company', estimatedSavings: '5-10%' },
      { type: 'Wholesale Distributor', estimatedSavings: '0-5%' }
    ],
    recommendation: `To achieve ${THRESHOLDS.targetMarginPercent}% margin, negotiate to $${targetBuyPrice.toFixed(2)} or consider alternative suppliers.`
  };
}

/**
 * Calculate margin score (0-100)
 */
function calculateMarginScore(netProceeds, landedCost) {
  if (landedCost <= 0) return 0;

  const marginPercent = ((netProceeds - landedCost) / landedCost) * 100;

  if (marginPercent < 0) return 0;
  if (marginPercent < THRESHOLDS.minMarginPercent) return marginPercent * 2;
  if (marginPercent < THRESHOLDS.goodMarginPercent) return 30 + ((marginPercent - 15) / 15) * 30;
  if (marginPercent < THRESHOLDS.excellentMarginPercent) return 60 + ((marginPercent - 30) / 20) * 25;
  return Math.min(100, 85 + ((marginPercent - 50) / 50) * 15);
}

/**
 * Calculate demand confidence score
 */
function calculateDemandScore(demandData) {
  if (!demandData || demandData.confidence === 'None') return 0;

  const baseScore = demandData.confidenceScore || 50;

  if (demandData.estimatedMonthlySales?.mid > 200) {
    return Math.min(100, baseScore + 10);
  }

  return baseScore;
}

/**
 * Generate detailed explanation for channel recommendation
 */
function generateChannelExplanation(channel, marketplace, marginPercent, fees, demand, monthsToSell, recommendation) {
  const parts = [];

  // Recommendation with margin
  if (recommendation === 'Sell') {
    if (marginPercent >= THRESHOLDS.excellentMarginPercent) {
      parts.push(`Excellent ${marginPercent.toFixed(1)}% margin`);
    } else if (marginPercent >= THRESHOLDS.goodMarginPercent) {
      parts.push(`Strong ${marginPercent.toFixed(1)}% margin`);
    } else {
      parts.push(`Acceptable ${marginPercent.toFixed(1)}% margin`);
    }
  } else {
    if (marginPercent < 0) {
      parts.push(`Negative margin (${marginPercent.toFixed(1)}%) - would lose money`);
    } else if (marginPercent < THRESHOLDS.minMarginPercent) {
      parts.push(`Margin too thin (${marginPercent.toFixed(1)}%, needs ${THRESHOLDS.minMarginPercent}%+)`);
    }
  }

  // Fee information
  if (fees?.breakdown) {
    const feePercent = fees.sellPrice > 0 ? (fees.total / fees.sellPrice * 100) : 0;
    if (feePercent > 30) {
      parts.push(`high fees (${feePercent.toFixed(0)}% of sale price)`);
    }
  }

  // Demand information
  if (demand?.confidence) {
    const demandInfo = demand.estimatedMonthlySales;
    if (demandInfo?.mid > 0) {
      parts.push(`${demandInfo.low}-${demandInfo.high} units/month (${demand.confidence} confidence)`);
    }
  }

  // Volume risk
  if (monthsToSell !== undefined && monthsToSell < 999) {
    if (monthsToSell <= 3) {
      parts.push(`quick turnover (${monthsToSell.toFixed(1)} months)`);
    } else if (monthsToSell <= 6) {
      parts.push(`${monthsToSell.toFixed(1)} months to sell`);
    } else if (monthsToSell > 12) {
      parts.push(`slow turnover (${monthsToSell.toFixed(0)}+ months)`);
    }
  }

  // Build final explanation
  if (parts.length === 0) {
    return recommendation === 'Sell'
      ? `Recommended for selling on ${channel}-${marketplace}`
      : `Not recommended on ${channel}-${marketplace}`;
  }

  const mainPart = parts[0];
  const detailParts = parts.slice(1);

  if (recommendation === 'Sell') {
    if (detailParts.length > 0) {
      return `${mainPart}; ${detailParts.join('; ')}`;
    }
    return mainPart;
  } else {
    // For Avoid recommendations, lead with the problem
    return parts.join('; ');
  }
}

/**
 * Process Amazon channel data
 */
function processAmazonChannel(marketplace, pricing, productData, buyPrice, currency, quantity) {
  if (!pricing || !pricing.buyBoxPrice) return null;

  // Calculate Amazon fees
  const fees = feeCalculator.calculateFees(
    marketplace,
    pricing.buyBoxPrice,
    productData?.category?.[marketplace] || productData?.category,
    productData?.dimensions?.weightKg || 0.5
  );

  // Estimate demand
  const demand = demandEstimator.estimateDemand(marketplace, pricing);

  // Convert buy price to market currency
  const marketCurrency = fees.currency;
  const buyPriceInMarketCurrency = currencyService.convert(buyPrice, currency, marketCurrency);

  // Calculate margin
  const netMargin = fees.netProceeds - buyPriceInMarketCurrency;
  const marginPercent = buyPriceInMarketCurrency > 0
    ? (netMargin / buyPriceInMarketCurrency) * 100
    : 0;

  // Calculate months to sell
  const monthsToSell = demand?.absorptionCapacity > 0
    ? quantity / demand.absorptionCapacity
    : 999;

  const recommendation = marginPercent >= THRESHOLDS.minMarginPercent ? 'Sell' : 'Avoid';
  const explanation = generateChannelExplanation('Amazon', marketplace, marginPercent, fees, demand, monthsToSell, recommendation);

  return {
    channel: 'Amazon',
    marketplace,
    sellPrice: fees.sellPrice,
    currency: marketCurrency,
    fees: {
      total: fees.totalFees,
      breakdown: {
        referralFee: fees.breakdown.referralFee,
        referralRate: fees.breakdown.referralRate,
        fbaFee: fees.breakdown.fbaFee,
        closingFee: fees.breakdown.closingFee,
        vat: fees.breakdown.vat,
        vatRate: fees.breakdown.vatRate
      },
      feeScheduleVersion: fees.feeScheduleVersion || '2025-01'
    },
    netProceeds: fees.netProceeds,
    buyPriceConverted: buyPriceInMarketCurrency,
    netMargin: Number(netMargin.toFixed(2)),
    marginPercent: Number(marginPercent.toFixed(1)),
    demand: {
      estimatedMonthlySales: demand?.estimatedMonthlySales || { low: 0, mid: 0, high: 0 },
      confidence: demand?.confidence || 'Low',
      absorptionCapacity: demand?.absorptionCapacity || 0,
      signals: demand?.signals || []
    },
    monthsToSell: Number(monthsToSell.toFixed(1)),
    recommendation,
    explanation,
    riskFlags: demand?.signals?.filter(s => s.includes('risk') || s.includes('caution')) || []
  };
}

/**
 * Process eBay channel data
 */
function processEbayChannel(marketplace, pricing, buyPrice, currency, quantity) {
  if (!pricing || !pricing.buyBoxPrice) return null;

  // Calculate eBay fees
  const fees = ebayService.calculateEbayFees(pricing.buyBoxPrice, marketplace);

  // Convert buy price to market currency
  const marketCurrency = fees.currency;
  const buyPriceInMarketCurrency = currencyService.convert(buyPrice, currency, marketCurrency);

  // Calculate margin
  const netMargin = fees.netProceeds - buyPriceInMarketCurrency;
  const marginPercent = buyPriceInMarketCurrency > 0
    ? (netMargin / buyPriceInMarketCurrency) * 100
    : 0;

  // Estimate demand from eBay data
  const monthlySales = pricing.estimatedMonthlySales || 0;
  const absorptionCapacity = monthlySales * 0.7; // Conservative estimate
  const monthsToSell = absorptionCapacity > 0 ? quantity / absorptionCapacity : 999;

  const demand = {
    estimatedMonthlySales: { low: monthlySales, mid: monthlySales, high: monthlySales },
    confidence: pricing.confidence || 'Low',
    absorptionCapacity,
    signals: [] // eBay doesn't provide detailed signals
  };

  const recommendation = marginPercent >= THRESHOLDS.minMarginPercent ? 'Sell' : 'Avoid';
  const explanation = generateChannelExplanation('eBay', marketplace, marginPercent, fees, demand, monthsToSell, recommendation);

  return {
    channel: 'eBay',
    marketplace,
    sellPrice: fees.sellPrice,
    currency: marketCurrency,
    fees: {
      total: fees.totalFees,
      breakdown: {
        finalValue: fees.finalValueFee,
        perOrder: fees.perOrderFee
      }
    },
    netProceeds: fees.netProceeds,
    buyPriceConverted: buyPriceInMarketCurrency,
    netMargin: Number(netMargin.toFixed(2)),
    marginPercent: Number(marginPercent.toFixed(1)),
    demand,
    monthsToSell: Number(monthsToSell.toFixed(1)),
    recommendation,
    explanation,
    riskFlags: monthsToSell > THRESHOLDS.maxMonthsToSell ? ['High inventory risk'] : []
  };
}

/**
 * Process Amazon channel with landed cost (buy price + duty + shipping)
 */
function processAmazonChannelWithLandedCost(marketplace, pricing, productData, landedCost, currency, quantity, feeOverrides = null) {
  if (!pricing || !pricing.buyBoxPrice) return null;

  // Get marketplace-specific fee overrides
  const marketFeeOverrides = feeOverrides ? 
    (Array.isArray(feeOverrides) ? feeOverrides.filter(o => o.marketplace?.toUpperCase() === marketplace.toUpperCase()) : 
     (feeOverrides.marketplace?.toUpperCase() === marketplace.toUpperCase() ? feeOverrides : null)) : null;

  // Calculate Amazon fees with overrides
  const fees = feeCalculator.calculateFees(
    marketplace,
    pricing.buyBoxPrice,
    productData?.category?.[marketplace] || productData?.category,
    productData?.dimensions || { weightKg: productData?.dimensions?.weightKg || 0.5 },
    marketFeeOverrides
  );
  
  // Debug: Log if fee override was applied
  if (marketFeeOverrides && fees.isOverridden) {
    console.log(`[MultiChannel Evaluator] Fee override applied for ${marketplace}:`, {
      originalReferralRate: fees.overrideMetadata?.originalReferralRate,
      newReferralRate: fees.breakdown?.referralRate,
      originalNetProceeds: fees.overrideMetadata?.originalNetProceeds,
      newNetProceeds: fees.netProceeds
    });
  }

  // Estimate demand
  const demand = demandEstimator.estimateDemand(marketplace, pricing);

  // Convert landed cost to market currency
  const marketCurrency = fees.currency;
  const landedCostInMarketCurrency = currencyService.convert(landedCost.totalLandedCost, currency, marketCurrency);

  // Calculate margin using landed cost (not just buy price)
  const netMargin = fees.netProceeds - landedCostInMarketCurrency;
  const marginPercent = landedCostInMarketCurrency > 0
    ? (netMargin / landedCostInMarketCurrency) * 100
    : 0;

  // Calculate months to sell
  const monthsToSell = demand?.absorptionCapacity > 0
    ? quantity / demand.absorptionCapacity
    : 999;

  const demandData = {
    estimatedMonthlySales: demand?.estimatedMonthlySales || { low: 0, mid: 0, high: 0 },
    confidence: demand?.confidence || 'Low',
    absorptionCapacity: demand?.absorptionCapacity || 0,
    signals: demand?.signals || []
  };

  const recommendation = marginPercent >= THRESHOLDS.minMarginPercent ? 'Sell' : 'Avoid';
  const explanation = generateChannelExplanation('Amazon', marketplace, marginPercent, fees, demandData, monthsToSell, recommendation);

  return {
    channel: 'Amazon',
    marketplace,
    sellPrice: fees.sellPrice,
    currency: marketCurrency,
    // Track sell price source for assumptions tracking
    pricingSource: pricing.dataSource || 'api',
    confidence: demandData.confidence || 'Medium',
    fees: {
      total: fees.totalFees,
      breakdown: {
        referralFee: fees.breakdown.referralFee,
        referralRate: fees.breakdown.referralRate,
        fbaFee: fees.breakdown.fbaFee,
        closingFee: fees.breakdown.closingFee,
        vat: fees.breakdown.vat,
        vatRate: fees.breakdown.vatRate
      },
      feeScheduleVersion: fees.feeScheduleVersion || '2025-01'
    },
    netProceeds: fees.netProceeds,
    landedCost: {
      buyPrice: landedCost.buyPrice,
      duty: landedCost.duty,
      dutyRate: landedCost.dutyRate,
      dutyPercent: landedCost.dutyPercent,
      importVat: landedCost.importVat,
      importVatRate: landedCost.importVatRate,
      reclaimVat: landedCost.reclaimVat,
      calculationMethod: landedCost.calculationMethod,
      isOverridden: landedCost.isOverridden,
      hsCode: landedCost.hsCode,
      category: landedCost.category,
      shipping: {
        cost: landedCost.shipping,
        method: landedCost.shippingMethod,
        ratePerKg: landedCost.shippingRatePerKg,
        transitDays: landedCost.shippingTransitDays,
        minCharge: landedCost.shippingMinCharge,
        isOverridden: landedCost.shippingIsOverridden
      },
      total: landedCost.totalLandedCost
    },
    landedCostConverted: landedCostInMarketCurrency,
    netMargin: Number(netMargin.toFixed(2)),
    marginPercent: Number(marginPercent.toFixed(1)),
    demand: demandData,
    monthsToSell: Number(monthsToSell.toFixed(1)),
    recommendation,
    explanation,
    riskFlags: demand?.signals?.filter(s => s.includes('risk') || s.includes('caution')) || []
  };
}

/**
 * Process eBay channel with landed cost
 */
function processEbayChannelWithLandedCost(marketplace, pricing, landedCost, currency, quantity, feeOverrides = null) {
  if (!pricing || !pricing.buyBoxPrice) return null;

  // Calculate eBay fees
  const fees = ebayService.calculateEbayFees(pricing.buyBoxPrice, marketplace);

  // Convert landed cost to market currency
  const marketCurrency = fees.currency;
  const landedCostInMarketCurrency = currencyService.convert(landedCost.totalLandedCost, currency, marketCurrency);

  // Calculate margin using landed cost
  const netMargin = fees.netProceeds - landedCostInMarketCurrency;
  const marginPercent = landedCostInMarketCurrency > 0
    ? (netMargin / landedCostInMarketCurrency) * 100
    : 0;

  // Estimate demand from eBay data
  const monthlySales = pricing.estimatedMonthlySales || 0;
  const absorptionCapacity = monthlySales * 0.7;
  const monthsToSell = absorptionCapacity > 0 ? quantity / absorptionCapacity : 999;

  const demandData = {
    estimatedMonthlySales: { low: monthlySales, mid: monthlySales, high: monthlySales },
    confidence: pricing.confidence || 'Low',
    absorptionCapacity,
    signals: [] // eBay doesn't provide detailed signals
  };

  const recommendation = marginPercent >= THRESHOLDS.minMarginPercent ? 'Sell' : 'Avoid';
  const explanation = generateChannelExplanation('eBay', marketplace, marginPercent, fees, demandData, monthsToSell, recommendation);

  return {
    channel: 'eBay',
    marketplace,
    sellPrice: fees.sellPrice,
    currency: marketCurrency,
    // Track sell price source for assumptions tracking
    pricingSource: pricing.dataSource || 'live',
    confidence: demandData.confidence || 'Medium',
    fees: {
      total: fees.totalFees,
      breakdown: {
        finalValue: fees.finalValueFee,
        perOrder: fees.perOrderFee
      }
    },
    netProceeds: fees.netProceeds,
    landedCost: {
      buyPrice: landedCost.buyPrice,
      duty: landedCost.duty,
      dutyRate: landedCost.dutyRate,
      dutyPercent: landedCost.dutyPercent,
      importVat: landedCost.importVat,
      importVatRate: landedCost.importVatRate,
      reclaimVat: landedCost.reclaimVat,
      calculationMethod: landedCost.calculationMethod,
      isOverridden: landedCost.isOverridden,
      hsCode: landedCost.hsCode,
      category: landedCost.category,
      shipping: {
        cost: landedCost.shipping,
        method: landedCost.shippingMethod,
        ratePerKg: landedCost.shippingRatePerKg,
        transitDays: landedCost.shippingTransitDays,
        minCharge: landedCost.shippingMinCharge,
        isOverridden: landedCost.shippingIsOverridden
      },
      total: landedCost.totalLandedCost
    },
    landedCostConverted: landedCostInMarketCurrency,
    netMargin: Number(netMargin.toFixed(2)),
    marginPercent: Number(marginPercent.toFixed(1)),
    demand: demandData,
    monthsToSell: Number(monthsToSell.toFixed(1)),
    recommendation,
    explanation,
    riskFlags: monthsToSell > THRESHOLDS.maxMonthsToSell ? ['High inventory risk'] : []
  };
}

/**
 * Multi-Channel Deal Evaluation
 * 
 * @param {object} input - Deal input parameters
 * @param {object} productData - Product data
 * @param {object} amazonPricing - Amazon pricing data
 * @param {object} ebayPricing - eBay pricing data
 * @param {object} assumptionOverrides - Optional assumption overrides
 */
export async function evaluateMultiChannel(input, productData, amazonPricing, ebayPricing, assumptionOverrides = null) {
  const { ean, quantity, buyPrice, currency = 'USD', supplierRegion = 'CN', reclaimVat = true } = input;

  // Get product weight (default 0.5kg)
  const weightKg = productData?.dimensions?.weightKg || 0.5;
  const category = productData?.category || 'default';
  const productName = productData?.title || productData?.productName || '';

  // Calculate duty and shipping for each destination
  const landedCosts = {};
  const destinations = ['US', 'UK', 'DE', 'FR', 'IT', 'AU'];

  // Extract overrides
  const shippingOverrides = assumptionOverrides?.shippingOverrides || null;
  const dutyOverrides = assumptionOverrides?.dutyOverrides || null;
  const feeOverrides = assumptionOverrides?.feeOverrides || null;

  // Check if any duty override has HS code (need async calculation)
  const hasHsCodeOverride = dutyOverrides && (
    Array.isArray(dutyOverrides) 
      ? dutyOverrides.some(o => o.hsCode || o.calculationMethod === 'hscode')
      : (dutyOverrides.hsCode || dutyOverrides.calculationMethod === 'hscode')
  );

  for (const dest of destinations) {
    let dutyResult;
    
    // Find matching duty override for this route (must match both origin and destination)
    const matchingOverride = dutyOverrides 
      ? (Array.isArray(dutyOverrides) 
          ? dutyOverrides.find(o => {
              const overrideOrigin = o.origin?.toUpperCase() || supplierRegion?.toUpperCase();
              const overrideDest = o.destination?.toUpperCase();
              return overrideOrigin === supplierRegion?.toUpperCase() && overrideDest === dest;
            })
          : (() => {
              const overrideOrigin = dutyOverrides.origin?.toUpperCase() || supplierRegion?.toUpperCase();
              const overrideDest = dutyOverrides.destination?.toUpperCase();
              return (overrideOrigin === supplierRegion?.toUpperCase() && overrideDest === dest) ? dutyOverrides : null;
            })())
      : null;
    
    // Use async HS code lookup if override has HS code
    if (matchingOverride?.hsCode || matchingOverride?.calculationMethod === 'hscode') {
      // Use async calculateDutyWithHSCode for real-time API lookup
      dutyResult = await dutyCalculator.calculateDutyWithHSCode(buyPrice, supplierRegion, dest, {
        hsCode: matchingOverride.hsCode,
        category: category,
        productName: productName,
        overrides: matchingOverride
      });
      
      console.log(`[MultiChannel Evaluator] HS Code duty lookup for ${supplierRegion}->${dest}:`, {
        hsCode: matchingOverride.hsCode || 'auto-detected',
        rate: dutyResult.dutyRate,
        ratePercent: dutyResult.dutyPercent,
        source: dutyResult.source || 'api'
      });
    } else {
      // Use standard category-based calculation
      // Pass the entire dutyOverrides object - calculateDuty will use getDutyOverrideForRoute to match correctly
      dutyResult = dutyCalculator.calculateDuty(buyPrice, supplierRegion, dest, category, dutyOverrides);
      
      // Debug: Log if duty override was applied
      if (dutyOverrides && dutyResult.isOverridden) {
        console.log(`[MultiChannel Evaluator] Duty override applied for ${supplierRegion}->${dest}:`, {
          originalRate: dutyResult.overrideMetadata?.originalDutyRate,
          newRate: dutyResult.dutyRate,
          originalAmount: dutyResult.overrideMetadata?.originalDutyAmount,
          newAmount: dutyResult.dutyAmount
        });
      } else if (dutyOverrides && !dutyResult.isOverridden) {
        // Debug: Log when override exists but wasn't applied (for troubleshooting)
        console.log(`[MultiChannel Evaluator] Duty override exists but not applied for ${supplierRegion}->${dest}:`, {
          overrideExists: true,
          supplierRegion,
          destination: dest,
          overrideStructure: Array.isArray(dutyOverrides) ? dutyOverrides.map(o => ({ origin: o.origin, destination: o.destination })) : { origin: dutyOverrides.origin, destination: dutyOverrides.destination }
        });
      }
    }

    // Calculate shipping (per unit, using air freight as default) with overrides
    const shippingResult = shippingCalculator.calculateBulkShipping(weightKg, quantity, supplierRegion, dest, 'air', shippingOverrides);
    
    // Debug: Log if shipping override was applied
    if (shippingOverrides && shippingResult.isOverridden) {
      console.log(`[MultiChannel Evaluator] Shipping override applied for ${supplierRegion}->${dest}:`, {
        originalRate: shippingResult.overrideMetadata?.originalRatePerKg,
        newRate: shippingResult.ratePerKg,
        originalCost: shippingResult.overrideMetadata?.originalShippingCost,
        newCost: shippingResult.perUnitShippingCost
      });
    }

    // Calculate Import VAT
    // Formula: (Buy Price + Shipping + Duty) * Import VAT Rate
    // Note: US has no import VAT (State sales tax applies to final sale)
    const importVatRate = feeCalculator.VAT_RATES[dest]?.standard || 0;
    const importVatAmount = (buyPrice + shippingResult.perUnitShippingCost + dutyResult.dutyAmount) * importVatRate;

    // Total landed cost per unit in source currency
    // If reclaiming VAT, don't add it to the final cost
    const landedCost = buyPrice + dutyResult.dutyAmount + shippingResult.perUnitShippingCost + (reclaimVat ? 0 : importVatAmount);

    landedCosts[dest] = {
      buyPrice,
      duty: dutyResult.dutyAmount,
      dutyRate: dutyResult.dutyRate,
      dutyPercent: dutyResult.dutyRate * 100,
      importVat: Number(importVatAmount.toFixed(2)),
      importVatRate: importVatRate * 100,
      reclaimVat: reclaimVat,
      hsCode: dutyResult.hsCode || null,
      dutySource: dutyResult.source || 'category',
      calculationMethod: dutyResult.calculationMethod || 'category',
      isOverridden: dutyResult.isOverridden || false,
      category: dutyResult.category || category,
      shipping: shippingResult.perUnitShippingCost,
      shippingMethod: shippingResult.method,
      shippingRatePerKg: shippingResult.ratePerKg,
      shippingTransitDays: shippingResult.transitDays,
      shippingMinCharge: shippingResult.minCharge,
      shippingIsOverridden: shippingResult.isOverridden || false,
      totalLandedCost: Number(landedCost.toFixed(2)),
      currency
    };
  }

  // Process all channels with landed cost
  const allChannels = [];

  // Process Amazon channels
  if (amazonPricing) {
    for (const [marketplace, pricing] of Object.entries(amazonPricing)) {
      const landed = landedCosts[marketplace] || landedCosts['US'];
      const channel = processAmazonChannelWithLandedCost(marketplace, pricing, productData, landed, currency, quantity, feeOverrides);
      if (channel) allChannels.push(channel);
    }
  }

  // Process eBay channels
  if (ebayPricing) {
    for (const [marketplace, pricing] of Object.entries(ebayPricing)) {
      const landed = landedCosts[marketplace] || landedCosts['US'];
      const channel = processEbayChannelWithLandedCost(marketplace, pricing, landed, currency, quantity, feeOverrides);
      if (channel) allChannels.push(channel);
    }
  }

  // Process Retailer channels (Walmart, Target - mocked)
  // Use Amazon US price, or fallback to eBay US price if Amazon unavailable
  const hasAmazonUS = amazonPricing && amazonPricing['US'] && amazonPricing['US'].buyBoxPrice;
  const hasEbayUS = ebayPricing && ebayPricing['US'] && ebayPricing['US'].buyBoxPrice;
  
  if (hasAmazonUS || hasEbayUS) {
    const usLanded = landedCosts['US'];
    const usLandedCost = usLanded?.totalLandedCost || buyPrice;
    // Use Amazon price if available, otherwise use eBay price
    const referencePrice = hasAmazonUS 
      ? amazonPricing['US'].buyBoxPrice 
      : ebayPricing['US'].buyBoxPrice;
    const category = productData?.category || 'default';
    
    // Get retailer pricing based on reference price
    const retailerChannels = retailerService.getRetailerPricing(productData, referencePrice, category);
    
    for (const retailer of retailerChannels) {
      // Calculate margin with landed cost
      const withMargin = retailerService.calculateRetailerMargin(retailer, usLandedCost);

      // Add landed cost details
      withMargin.landedCost = {
        buyPrice: usLanded?.buyPrice || buyPrice,
        duty: usLanded?.duty || 0,
        dutyRate: usLanded?.dutyRate || 0,
        dutyPercent: usLanded?.dutyPercent || 0,
        importVat: usLanded?.importVat || 0,
        importVatRate: usLanded?.importVatRate || 0,
        reclaimVat: usLanded?.reclaimVat || reclaimVat,
        calculationMethod: usLanded?.calculationMethod || 'category',
        isOverridden: usLanded?.isOverridden || false,
        hsCode: usLanded?.hsCode || null,
        category: usLanded?.category || category,
        shipping: {
          cost: usLanded?.shipping || 0,
          method: usLanded?.shippingMethod,
          ratePerKg: usLanded?.shippingRatePerKg,
          transitDays: usLanded?.shippingTransitDays,
          minCharge: usLanded?.shippingMinCharge,
          isOverridden: usLanded?.shippingIsOverridden || false
        },
        total: usLandedCost
      };

      // Calculate months to sell
      const absorptionCapacity = Math.round((withMargin.demand?.estimatedMonthlySales?.mid || 30) * 0.15);
      withMargin.demand.absorptionCapacity = absorptionCapacity;
      withMargin.monthsToSell = absorptionCapacity > 0 ? Number((quantity / absorptionCapacity).toFixed(1)) : 999;

      // Track sell price source (based on reference price source)
      withMargin.pricingSource = hasAmazonUS 
        ? (amazonPricing['US'].dataSource || 'api')
        : (ebayPricing['US'].dataSource || 'live');
      withMargin.confidence = 'Medium'; // Retailer channels use estimated pricing

      // Add explanation
      withMargin.explanation = generateChannelExplanation(
        'Retailer',
        withMargin.retailer,
        withMargin.marginPercent,
        withMargin.fees,
        withMargin.demand,
        withMargin.monthsToSell,
        withMargin.recommendation
      );

      allChannels.push(withMargin);
    }
  }

  // Process Distributor channels (Ingram Micro, Alliance - mocked)
  // Use Amazon US price, or fallback to eBay US price if Amazon unavailable
  if (hasAmazonUS || hasEbayUS) {
    const usLanded = landedCosts['US'];
    const usLandedCost = usLanded?.totalLandedCost || buyPrice;
    // Use Amazon price if available, otherwise use eBay price
    const referencePrice = hasAmazonUS 
      ? amazonPricing['US'].buyBoxPrice 
      : ebayPricing['US'].buyBoxPrice;
    const category = productData?.category || 'default';
    
    // Get distributor pricing based on reference price (they pay wholesale)
    const distributorChannels = distributorService.getDistributorPricing(productData, referencePrice, category);
    
    for (const distributor of distributorChannels) {
      // Calculate margin with landed cost
      const withMargin = distributorService.calculateDistributorMargin(distributor, usLandedCost);

      // Add landed cost details
      withMargin.landedCost = {
        buyPrice: usLanded?.buyPrice || buyPrice,
        duty: usLanded?.duty || 0,
        dutyRate: usLanded?.dutyRate || 0,
        dutyPercent: usLanded?.dutyPercent || 0,
        importVat: usLanded?.importVat || 0,
        importVatRate: usLanded?.importVatRate || 0,
        reclaimVat: usLanded?.reclaimVat || reclaimVat,
        calculationMethod: usLanded?.calculationMethod || 'category',
        isOverridden: usLanded?.isOverridden || false,
        hsCode: usLanded?.hsCode || null,
        category: usLanded?.category || category,
        shipping: {
          cost: usLanded?.shipping || 0,
          method: usLanded?.shippingMethod,
          ratePerKg: usLanded?.shippingRatePerKg,
          transitDays: usLanded?.shippingTransitDays,
          minCharge: usLanded?.shippingMinCharge,
          isOverridden: usLanded?.shippingIsOverridden || false
        },
        total: usLandedCost
      };

      // For distributors, absorption capacity is higher (bulk sales)
      const absorptionCapacity = Math.round((withMargin.demand?.estimatedMonthlySales?.mid || 500) * 0.20);
      withMargin.demand.absorptionCapacity = absorptionCapacity;
      withMargin.monthsToSell = absorptionCapacity > 0 ? Number((quantity / absorptionCapacity).toFixed(1)) : 999;

      // Track sell price source (based on reference price source)
      withMargin.pricingSource = hasAmazonUS 
        ? (amazonPricing['US'].dataSource || 'api')
        : (ebayPricing['US'].dataSource || 'live');
      withMargin.confidence = 'Medium'; // Distributor channels use estimated pricing

      // Add explanation  
      withMargin.explanation = generateChannelExplanation(
        'Distributor',
        withMargin.distributor,
        withMargin.marginPercent,
        withMargin.fees,
        withMargin.demand,
        withMargin.monthsToSell,
        withMargin.recommendation
      );

      allChannels.push(withMargin);
    }
  }

  if (allChannels.length === 0) {
    return {
      error: 'No valid channel data provided',
      dealScore: { overall: 0 },
      decision: 'Pass'
    };
  }

  // Sort channels by margin percent (best first)
  allChannels.sort((a, b) => b.marginPercent - a.marginPercent);

  // Find best channel
  const bestChannel = allChannels[0];

  // Convert best channel to USD for scoring
  const bestNetProceedsUSD = currencyService.toUSD(bestChannel.netProceeds, bestChannel.currency);

  // Get landed cost for best channel (in source currency) and convert to USD
  // Priority: 1) bestChannel.landedCost.total, 2) landedCosts lookup, 3) fallback to buyPrice
  // This ensures overrides (duty, shipping) are properly reflected in the score
  let bestLandedCostTotal;
  if (bestChannel.landedCost?.total !== undefined && bestChannel.landedCost.total !== null) {
    // Use the landed cost from the channel (includes all overrides)
    bestLandedCostTotal = bestChannel.landedCost.total;
  } else if (landedCosts[bestChannel.marketplace]?.totalLandedCost !== undefined) {
    // Fallback to direct lookup from landedCosts (includes overrides)
    bestLandedCostTotal = landedCosts[bestChannel.marketplace].totalLandedCost;
  } else {
    // Last resort: use buy price (shouldn't happen in normal flow)
    console.warn(`[MultiChannel Evaluator] Could not find landed cost for ${bestChannel.marketplace}, using buy price`);
    bestLandedCostTotal = buyPrice;
  }
  
  const bestLandedCostUSD = currencyService.toUSD(bestLandedCostTotal, currency);

  // Debug: Log landed cost used for scoring (to verify overrides are applied)
  if (assumptionOverrides?.dutyOverrides || assumptionOverrides?.shippingOverrides) {
    console.log(`[MultiChannel Evaluator] Score calculation - Best channel: ${bestChannel.channel}-${bestChannel.marketplace}`, {
      landedCostSource: bestChannel.landedCost?.total !== undefined ? 'channel.landedCost.total' : 'landedCosts lookup',
      landedCostSourceCurrency: bestLandedCostTotal,
      landedCostUSD: bestLandedCostUSD,
      netProceedsUSD: bestNetProceedsUSD,
      buyPrice: buyPrice,
      hasDutyOverrides: !!assumptionOverrides?.dutyOverrides,
      hasShippingOverrides: !!assumptionOverrides?.shippingOverrides
    });
  }

  // Calculate overall scores using landed cost (not just buy price) to properly reflect overrides
  const marginScore = calculateMarginScore(bestNetProceedsUSD, bestLandedCostUSD);
  const demandScore = calculateDemandScore(bestChannel.demand);

  // Calculate total absorption across all recommended channels
  const recommendedChannels = allChannels.filter(c => c.recommendation === 'Sell');
  const totalAbsorption = recommendedChannels.reduce((sum, c) => sum + (c.demand?.absorptionCapacity || 0), 0);
  const overallMonthsToSell = totalAbsorption > 0 ? quantity / totalAbsorption : 999;

  const volumeRiskScore = overallMonthsToSell <= 1 ? 100
    : overallMonthsToSell <= 3 ? 85
      : overallMonthsToSell <= 6 ? 60
        : overallMonthsToSell <= 12 ? 35
          : 10;

  const dataReliabilityScore = Math.min(100, allChannels.length * 20); // 20 points per channel with data, capped at 100

  // Calculate overall score
  const overallScore =
    marginScore * WEIGHTS.netMargin +
    demandScore * WEIGHTS.demandConfidence +
    volumeRiskScore * WEIGHTS.volumeRisk +
    dataReliabilityScore * WEIGHTS.dataReliability;

  // Generate decision
  const decision = overallScore >= 75 && bestChannel.marginPercent >= THRESHOLDS.minMarginPercent ? 'Buy'
    : overallScore >= 55 && bestChannel.marginPercent >= 10 ? 'Renegotiate'
      : overallScore >= 40 && bestChannel.marginPercent > 0 ? 'Source Elsewhere'
        : 'Pass';

  // Generate explanation
  let explanation = '';
  switch (decision) {
    case 'Buy':
      explanation = `Strong opportunity across multiple channels. Best margin is ${bestChannel.marginPercent.toFixed(1)}% on ${bestChannel.channel}-${bestChannel.marketplace}. `;
      break;
    case 'Renegotiate':
      explanation = `Potential opportunity with better pricing. Current best margin is ${bestChannel.marginPercent.toFixed(1)}% on ${bestChannel.channel}-${bestChannel.marketplace}. `;
      break;
    case 'Source Elsewhere':
      explanation = `Weak margins at current price. Best option is ${bestChannel.marginPercent.toFixed(1)}% on ${bestChannel.channel}-${bestChannel.marketplace}. `;
      break;
    case 'Pass':
      explanation = `Not recommended. Margins too thin across all channels. `;
      break;
  }

  if (recommendedChannels.length > 0) {
    explanation += `Recommended channels: ${recommendedChannels.map(c => `${c.channel}-${c.marketplace}`).join(', ')}. `;
  }

  if (overallMonthsToSell > THRESHOLDS.dangerMonthsToSell) {
    explanation += `High inventory risk: ${overallMonthsToSell.toFixed(0)}+ months to sell through quantity. `;
  }

  // Helper function to get channel display name (uses retailer/distributor name if available)
  const getChannelKey = (channel) => {
    if (channel.retailer) {
      return `${channel.retailer}-${channel.marketplace}`;
    } else if (channel.distributor) {
      return `${channel.distributor}-${channel.marketplace}`;
    } else {
      return `${channel.channel}-${channel.marketplace}`;
    }
  };

  // Hybrid Allocation Strategy: Balance high-margin channels with fast-absorption channels
  // Phase 1: Allocate 60-70% to highest-margin channels (profit optimization)
  // Phase 2: Allocate 30-40% to fastest-absorption channels (inventory turnover optimization)

  const sortedByMargin = [...recommendedChannels].sort((a, b) => b.marginPercent - a.marginPercent);
  const sortedBySpeed = [...recommendedChannels]
    .filter(c => (c.demand?.absorptionCapacity || 0) > 0)
    .sort((a, b) => {
      const monthsA = a.demand?.absorptionCapacity > 0
        ? quantity / a.demand.absorptionCapacity
        : 999;
      const monthsB = b.demand?.absorptionCapacity > 0
        ? quantity / b.demand.absorptionCapacity
        : 999;
      return monthsA - monthsB; // Fastest first
    });

  const allocation = {};
  const allocationDetails = {}; // Store details for each allocation
  let remainingQty = quantity;

  // Phase 1: Allocate to high-margin channels (60-70% of quantity)
  const marginAllocationTarget = Math.floor(quantity * 0.65); // 65% to margin channels
  let marginAllocated = 0;
  const marginChannels = [];

  for (const channel of sortedByMargin) {
    if (marginAllocated >= marginAllocationTarget || remainingQty <= 0) break;

    const absorptionCapacity = channel.demand?.absorptionCapacity || 0;
    if (absorptionCapacity === 0) continue; // Skip channels with no absorption capacity

    const maxAllocation = absorptionCapacity * 3; // 3 months of capacity
    const availableForMargin = marginAllocationTarget - marginAllocated;
    const allocated = Math.min(remainingQty, Math.floor(maxAllocation), availableForMargin);

    if (allocated > 0) {
      const key = getChannelKey(channel);
      allocation[key] = (allocation[key] || 0) + allocated;
      marginAllocated += allocated;
      marginChannels.push(key);
      remainingQty -= allocated;
    }
  }

  // Phase 2: Allocate remaining to fastest-absorption channels (30-40% of quantity)
  const speedChannels = [];
  for (const channel of sortedBySpeed) {
    if (remainingQty <= 0) break;

    // Skip if already allocated in Phase 1
    const key = getChannelKey(channel);
    if (allocation[key]) continue;

    const absorptionCapacity = channel.demand?.absorptionCapacity || 0;
    if (absorptionCapacity === 0) continue;

    const maxAllocation = absorptionCapacity * 3; // 3 months of capacity
    const allocated = Math.min(remainingQty, Math.floor(maxAllocation));

    if (allocated > 0) {
      allocation[key] = allocated;
      speedChannels.push(key);
      remainingQty -= allocated;
    }
  }

  // Build detailed rationale for each allocated channel
  for (const [channelKey, allocatedQty] of Object.entries(allocation)) {
    const channel = allChannels.find(c => getChannelKey(c) === channelKey);
    if (!channel) continue;

    const absorptionCapacity = channel.demand?.absorptionCapacity || 0;
    const monthlySales = channel.demand?.estimatedMonthlySales?.mid || 0;
    const monthsToSell = absorptionCapacity > 0 ? allocatedQty / absorptionCapacity : 0;
    const isMarginChannel = marginChannels.includes(channelKey);
    const isSpeedChannel = speedChannels.includes(channelKey);

    let channelRationale = `Allocated ${allocatedQty} units to ${channelKey} `;

    if (isMarginChannel && isSpeedChannel) {
      channelRationale += `(hybrid: high margin ${channel.marginPercent.toFixed(1)}% + fast absorption ${monthsToSell.toFixed(1)} months). `;
    } else if (isMarginChannel) {
      channelRationale += `based on HIGH MARGIN strategy (${channel.marginPercent.toFixed(1)}% margin). `;
    } else if (isSpeedChannel) {
      channelRationale += `based on FAST ABSORPTION strategy (${monthsToSell.toFixed(1)} months to sell). `;
    }

    if (absorptionCapacity > 0) {
      channelRationale += `Monthly absorption capacity: ${absorptionCapacity} units (${monthlySales} estimated sales × market share). `;
      channelRationale += `This allocation represents ${monthsToSell.toFixed(1)} months of sales capacity. `;
    }

    channelRationale += `Margin: ${channel.marginPercent.toFixed(1)}%.`;
    allocationDetails[channelKey] = channelRationale;
  }

  // Add skipped channels to details - include all channels that weren't allocated
  // First, add skipped recommended channels (those in sortedByMargin but not allocated)
  for (const channel of sortedByMargin) {
    const key = getChannelKey(channel);
    if (allocation[key]) continue;

    const absorptionCapacity = channel.demand?.absorptionCapacity || 0;
    if (absorptionCapacity === 0 && channel.marginPercent >= THRESHOLDS.minMarginPercent) {
      allocationDetails[key] = `Skipped ${key} despite ${channel.marginPercent.toFixed(1)}% margin due to insufficient market absorption capacity (no reliable demand data available).`;
    } else if (absorptionCapacity > 0 && !allocation[key]) {
      allocationDetails[key] = `Skipped ${key} (${channel.marginPercent.toFixed(1)}% margin, ${(quantity / absorptionCapacity).toFixed(1)} months to sell) - lower priority than allocated channels.`;
    }
  }
  
  // Add channels that weren't recommended (recommendation === 'Avoid') - these weren't considered for allocation
  for (const channel of allChannels) {
    const key = getChannelKey(channel);
    if (allocation[key] || channel.recommendation === 'Sell') continue; // Skip if already allocated or recommended
    
    const absorptionCapacity = channel.demand?.absorptionCapacity || 0;
    let reason = '';
    
    if (channel.marginPercent < THRESHOLDS.minMarginPercent) {
      reason = `Not allocated: ${key} has margin of ${channel.marginPercent.toFixed(1)}% (below ${THRESHOLDS.minMarginPercent}% threshold). `;
    } else {
      reason = `Not allocated: ${key} not recommended for selling. `;
    }
    
    if (absorptionCapacity === 0) {
      reason += `No reliable demand data available.`;
    } else {
      const monthsToSell = quantity / absorptionCapacity;
      reason += `Estimated ${monthsToSell.toFixed(1)} months to sell through quantity.`;
    }
    
    allocationDetails[key] = reason;
  }

  // Build overall rationale explaining the hybrid strategy (concise one-liner)
  let overallRationale = '';
  if (Object.keys(allocation).length === 0) {
    overallRationale = 'No channels allocated due to insufficient market absorption capacity.';
  } else {
    const allocatedChannels = Object.keys(allocation);
    const marginChannelsList = marginChannels.filter(c => allocation[c]);
    const speedChannelsList = speedChannels.filter(c => allocation[c]);

    const channelNames = allocatedChannels.join(', ');
    const marginPercent = Math.round((marginAllocated / quantity) * 100);
    const speedPercent = Math.round((speedChannelsList.reduce((sum, c) => sum + (allocation[c] || 0), 0) / quantity) * 100);

    if (remainingQty > 0) {
      overallRationale = `${marginPercent}% allocated to high-margin channels (${marginChannelsList.join(', ')}) and ${speedPercent}% to fast-absorption channels (${speedChannelsList.join(', ')}). ${remainingQty} units held back.`;
    } else {
      const maxMonths = Math.max(...allocatedChannels.map(c => {
        const ch = allChannels.find(ch => `${ch.channel}-${ch.marketplace}` === c);
        return ch?.demand?.absorptionCapacity > 0 ? (allocation[c] / ch.demand.absorptionCapacity) : 0;
      }));
      overallRationale = `${marginPercent}% allocated to high-margin channels (${marginChannelsList.join(', ')}) and ${speedPercent}% to fast-absorption channels (${speedChannelsList.join(', ')}). Estimated sell-through: ${maxMonths.toFixed(1)} months.`;
    }
  }

  // Calculate negotiation support if needed
  const bestNetProceedsInSourceCurrency = currencyService.convert(
    bestChannel.netProceeds,
    bestChannel.currency,
    currency
  );

  let negotiationSupport = null;
  let sourcingSuggestions = null;

  if (decision === 'Renegotiate' || decision === 'Source Elsewhere') {
    negotiationSupport = calculateNegotiationPrices(
      bestNetProceedsInSourceCurrency,
      buyPrice,
      currency
    );

    if (decision === 'Source Elsewhere') {
      sourcingSuggestions = generateSourcingSuggestion(
        supplierRegion,
        negotiationSupport.targetBuyPrice,
        productData?.category || 'default'
      );
    }
  }

  return {
    ean,
    productTitle: productData?.title || 'Unknown Product',
    input: { quantity, buyPrice, currency, supplierRegion },
    dealScore: {
      overall: Math.round(overallScore),
      breakdown: {
        netMarginScore: Math.round(marginScore),
        demandConfidenceScore: Math.round(demandScore),
        volumeRiskScore: Math.round(volumeRiskScore),
        dataReliabilityScore: Math.round(dataReliabilityScore)
      }
    },
    decision,
    explanation: explanation.trim(),
    bestChannel: {
      channel: bestChannel.channel,
      marketplace: bestChannel.marketplace,
      marginPercent: bestChannel.marginPercent,
      netProceeds: bestChannel.netProceeds,
      currency: bestChannel.currency
    },
    channelAnalysis: allChannels,
    allocationRecommendation: {
      totalQuantity: quantity,
      allocated: allocation,
      hold: remainingQty,
      rationale: overallRationale,
      channelDetails: allocationDetails
    },
    // Negotiation support for Renegotiate decision
    negotiationSupport: negotiationSupport ? {
      ...negotiationSupport,
      message: negotiationSupport.currentBuyPrice <= negotiationSupport.targetBuyPrice
        ? `Current price of ${currency} ${negotiationSupport.currentBuyPrice} already achieves ${negotiationSupport.currentMarginPercent.toFixed(1)}% margin (above ${negotiationSupport.targetMarginPercent}% target). Good deal - proceed with caution on volume.`
        : `To achieve ${negotiationSupport.targetMarginPercent}% margin, negotiate down to ${currency} ${negotiationSupport.targetBuyPrice}. Walk away if above ${currency} ${negotiationSupport.walkAwayPrice}.`
    } : null,
    // Sourcing suggestions for Source Elsewhere decision  
    sourcingSuggestions: sourcingSuggestions,
    // Compliance flags for Amazon selling restrictions
    compliance: complianceService.getComplianceFlags(productData)
  };
}

export default {
  evaluateMultiChannel,
  THRESHOLDS,
  WEIGHTS
};
