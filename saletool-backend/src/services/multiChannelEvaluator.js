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
  targetMarginPercent: 25,  // For negotiation target price
  marginGuardrailThreshold: 120 // ROI above which we flag for driver verification
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
 * Identify factors driving high margins for trust transparency
 */
function identifyMarginDrivers(channel, landedCost, pricing, input = null, marketplace = null) {
  const drivers = [];

  // Rule 1: Mock Pricing
  if (pricing?.dataSource === 'mock' || pricing?.dataSource === 'mock-fallback') {
    drivers.push({
      name: 'Mock Pricing',
      description: 'Using sample data instead of live marketplace API'
    });
  }

  // Rule 2: VAT Reclamation
  if (landedCost?.reclaimVat) {
    drivers.push({
      name: 'VAT Reclaim',
      description: 'Input VAT is reclaimed, lowering effective sourcing cost'
    });
  }

  // Rule 3: Manual Overrides
  if (landedCost?.isOverridden || landedCost?.shipping?.isOverridden) {
    drivers.push({
      name: 'Manual Assumptions',
      description: 'One or more costs/tariffs use manual user overrides'
    });
  }

  // Rule 4: Extreme ROI Gap
  // If sell price is more than 3x the buy price
  const sellPrice = channel?.sellPrice || 0;
  const buyPrice = landedCost?.buyPrice || 0;
  if (buyPrice > 0 && (sellPrice / buyPrice) > 3) {
    drivers.push({
      name: 'High Price Delta',
      description: 'Sell price is significantly (>3x) above the buy price'
    });
  }

  // Rule 5: Assumed/Estimated Sell Price
  // Retailer and Distributor channels always use assumed prices
  if (channel?.channel === 'Retailer' || channel?.channel === 'Distributor') {
    drivers.push({
      name: 'Assumed Sell Price',
      description: 'Sell price is estimated from reference marketplace, not live API data'
    });
  }
  // Also check if pricing source indicates assumed price
  else if (pricing?.dataSource === 'estimated' || pricing?.pricingSource === 'estimated') {
    drivers.push({
      name: 'Assumed Sell Price',
      description: 'Sell price is estimated/derived, not from live marketplace API'
    });
  }

  // Rule 6: Missing Costs
  const missingCosts = [];
  
  // Check for missing duty (should be calculated for cross-border shipments)
  if (landedCost && !landedCost.isOverridden && input) {
    const hasOrigin = input?.supplier_region || input?.origin;
    const hasDestination = marketplace || channel?.marketplace;
    // Only flag if it's a cross-border shipment and duty is 0
    if (hasOrigin && hasDestination && hasOrigin !== hasDestination && landedCost.duty === 0) {
      missingCosts.push('duty');
    }
  }

  // Check for missing shipping
  if (landedCost && !landedCost.shipping?.isOverridden && input) {
    const hasOrigin = input?.supplier_region || input?.origin;
    const hasDestination = marketplace || channel?.marketplace;
    // Only flag if it's a cross-border shipment and shipping cost is 0 or missing
    if (hasOrigin && hasDestination && hasOrigin !== hasDestination) {
      const shippingCost = landedCost.shipping?.cost || 0;
      if (shippingCost === 0) {
        missingCosts.push('shipping');
      }
    }
  }

  // Check for missing import VAT (when applicable for EU/UK markets)
  if (landedCost) {
    const hasDestination = marketplace || channel?.marketplace;
    const vatMarkets = ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PL', 'SE', 'DK', 'FI', 'IE', 'PT', 'CZ', 'GR', 'RO', 'HU'];
    if (hasDestination && vatMarkets.includes(hasDestination)) {
      const importVat = landedCost.importVat || 0;
      const importVatRate = landedCost.importVatRate || 0;
      // Flag if VAT should apply but is 0 (unless explicitly reclaimed)
      if (importVat === 0 && importVatRate === 0 && !landedCost.reclaimVat) {
        missingCosts.push('import VAT');
      }
    }
  }

  if (missingCosts.length > 0) {
    drivers.push({
      name: 'Missing Costs',
      description: `One or more cost components may be missing: ${missingCosts.join(', ')}. This could inflate margin calculations.`
    });
  }

  return drivers;
}

/**
 * Generate detailed explanation for channel recommendation
 */
function generateChannelExplanation(channel, marketplace, marginPercent, fees, demand, monthsToSell, recommendation, guardrailDrivers = []) {
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
      let demandText = `${demandInfo.low}-${demandInfo.high} units/month (${demand.confidence} confidence)`;

      // Append signals for transparency (e.g. "Sold 15 units in last 90 days")
      if (demand.signals && demand.signals.length > 0) {
        demandText += `; ${demand.signals.join(', ')}`;
      }

      parts.push(demandText);
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

  // Append high-margin guardrail if applicable
  if (marginPercent > THRESHOLDS.marginGuardrailThreshold && guardrailDrivers.length > 0) {
    const driverNames = guardrailDrivers.map(d => typeof d === 'string' ? d : d.name).join(', ');
    const guardrailMsg = `[Guardrail: High ROI driven by ${driverNames}]`;

    if (recommendation === 'Sell') {
      const combined = detailParts.length > 0 ? `${mainPart} (${guardrailMsg}); ${detailParts.join('; ')}` : `${mainPart} (${guardrailMsg})`;
      return combined;
    } else {
      return `${parts.join('; ')} (${guardrailMsg})`;
    }
  }

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
function processAmazonChannelWithLandedCost(marketplace, pricing, productData, landedCost, currency, quantity, feeOverrides = null, input = null) {
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

  // Convert landed cost to market currency (with FX metadata for transparency)
  const marketCurrency = fees.currency;
  const landedCostConversion = currencyService.convertWithMeta(landedCost.totalLandedCost, currency, marketCurrency);
  const landedCostInMarketCurrency = landedCostConversion.converted;

  // Calculate margin using landed cost
  // For VAT-registered sellers (reclaimVat=true), output VAT is a pass-through, not a cost
  // They collect VAT from buyers and remit to government - it doesn't affect their margin
  // So we use ex-VAT sell price minus fees as their effective revenue
  const effectiveRevenue = landedCost.reclaimVat
    ? (fees.priceExVat - fees.totalFees)   // VAT-registered: ex-VAT revenue minus fees
    : fees.netProceeds;                     // Non-VAT-registered: gross minus VAT minus fees

  const netMargin = effectiveRevenue - landedCostInMarketCurrency;
  const marginPercent = landedCostInMarketCurrency > 0
    ? (netMargin / landedCostInMarketCurrency) * 100
    : 0;

  // Determine data source status early to avoid reference errors
  const priceStatus = pricing.dataSource === 'mock' || pricing.dataSource === 'mock-fallback' ? 'MOCK' : 'LIVE';

  const demandData = {
    estimatedMonthlySales: demand?.estimatedMonthlySales || { low: 0, mid: 0, high: 0 },
    confidence: priceStatus === 'MOCK' ? 'Low' : (demand?.confidence || 'Low'),
    absorptionCapacity: demand?.absorptionCapacity || 0,
    signals: priceStatus === 'MOCK'
      ? (demand?.signals || []).filter(s => !s.toLowerCase().includes('high confidence')).concat(['Sample data / Mock signal'])
      : (demand?.signals || []),
    // Preserve demand inputs for recalculation (critical for assumption override re-evaluation)
    salesRank: demand?.salesRank,
    salesRankCategory: demand?.category,
    actualSalesSource: demand?.actualSalesSource,  // "500+ bought in past month"
    ratingsTotal: pricing?.ratingsTotal || 0,
    fbaOffers: pricing?.fbaOffers || 0,
    methodology: demand?.methodology
  };

  // Calculate months to sell
  const monthsToSell = demandData.absorptionCapacity > 0
    ? quantity / demandData.absorptionCapacity
    : 999;

  // Identify margin drivers for high-ROI transparency
  const guardrailDrivers = marginPercent > THRESHOLDS.marginGuardrailThreshold
    ? identifyMarginDrivers({ sellPrice: fees.sellPrice, channel: 'Amazon' }, landedCost, pricing, input, marketplace)
    : [];

  const recommendation = marginPercent >= THRESHOLDS.minMarginPercent ? 'Sell' : 'Avoid';
  const explanation = generateChannelExplanation('Amazon', marketplace, marginPercent, fees, demandData, monthsToSell, recommendation, guardrailDrivers);

  // Build dataSources object for transparency
  // priceStatus is defined above early in the function
  // Demand is only LIVE if: 1) we have actual sales data AND 2) it's from live API (not mock)
  const isDataFromLiveAPI = priceStatus === 'LIVE';
  const demandStatus = isDataFromLiveAPI
    ? (demand?.actualSalesSource ? 'LIVE' : 'ESTIMATED')
    : 'MOCK';
  const demandSource = priceStatus === 'MOCK'
    ? 'Mock Data'
    : (demand?.actualSalesSource
      ? `Amazon recent_sales: ${demand.actualSalesSource}`
      : `BSR Formula (Rank #${demand?.salesRank?.toLocaleString() || 'N/A'})`);

  return {
    channel: 'Amazon',
    marketplace,
    sellPrice: fees.sellPrice,
    priceExVat: fees.priceExVat,  // Ex-VAT sell price for transparency
    currency: marketCurrency,
    // Track sell price source for assumptions tracking
    pricingSource: pricing.dataSource || 'live',
    confidence: demandData.confidence || 'Medium',
    guardrail: guardrailDrivers.length > 0 ? { isFlagged: true, drivers: guardrailDrivers } : null,
    // Data source transparency per component
    dataSources: {
      price: { status: priceStatus, source: priceStatus === 'LIVE' ? 'Amazon API' : 'Mock Data' },
      demand: { status: demandStatus, source: demandSource },
      fees: { status: 'MOCK', source: `Fee Schedule v${fees.feeScheduleVersion || '2025-01'}` }
    },
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
    // FX transparency: show rate and timestamp used for conversion
    fx: landedCostConversion.fx,
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
function processEbayChannelWithLandedCost(marketplace, pricing, landedCost, currency, quantity, feeOverrides = null, input = null) {
  if (!pricing || !pricing.buyBoxPrice) return null;

  // Calculate eBay fees
  const fees = ebayService.calculateEbayFees(pricing.buyBoxPrice, marketplace);

  // Convert landed cost to market currency (with FX metadata for transparency)
  const marketCurrency = fees.currency;
  const landedCostConversion = currencyService.convertWithMeta(landedCost.totalLandedCost, currency, marketCurrency);
  const landedCostInMarketCurrency = landedCostConversion.converted;

  // Calculate margin using landed cost
  // For VAT-registered sellers (reclaimVat=true), output VAT is a pass-through, not a cost
  const effectiveRevenue = landedCost.reclaimVat
    ? (fees.priceExVat - fees.totalFees)   // VAT-registered: ex-VAT revenue minus fees
    : fees.netProceeds;                     // Non-VAT-registered: gross minus VAT minus fees

  const netMargin = effectiveRevenue - landedCostInMarketCurrency;
  const marginPercent = landedCostInMarketCurrency > 0
    ? (netMargin / landedCostInMarketCurrency) * 100
    : 0;

  // Estimate demand from eBay data
  const monthlySales = pricing.estimatedMonthlySales || 0;
  const absorptionCapacity = monthlySales * 0.7;
  const monthsToSell = absorptionCapacity > 0 ? quantity / absorptionCapacity : 999;

  // Determine data source status
  const priceStatus = pricing.dataSource === 'mock' || pricing.dataSource === 'mock-fallback' ? 'MOCK' : 'LIVE';

  const demandData = {
    estimatedMonthlySales: { low: monthlySales, mid: monthlySales, high: monthlySales },
    confidence: priceStatus === 'MOCK' ? 'Low' : (pricing.confidence || 'Low'),
    absorptionCapacity,
    signals: pricing.soldLast90Days !== undefined
      ? [`Sold ${pricing.soldLast90Days} units in last 90 days`]
      : (priceStatus === 'MOCK' ? ['Sample data / Mock signal'] : []),
    // Preserve demand inputs for recalculation
    soldLast90Days: pricing.soldLast90Days,
    listingsCount: pricing.activeListings
  };


  // Identify margin drivers for high-ROI transparency
  const guardrailDrivers = marginPercent > THRESHOLDS.marginGuardrailThreshold
    ? identifyMarginDrivers({ sellPrice: fees.sellPrice, channel: 'eBay' }, landedCost, pricing, input, marketplace)
    : [];

  const recommendation = marginPercent >= THRESHOLDS.minMarginPercent ? 'Sell' : 'Avoid';
  const explanation = generateChannelExplanation('eBay', marketplace, marginPercent, fees, demandData, monthsToSell, recommendation, guardrailDrivers);

  // Build dataSources object for transparency
  // priceStatus is calculated above
  // Demand is only LIVE if: 1) we have sold data AND 2) it's from live API (not mock)
  const isDataFromLiveAPI = priceStatus === 'LIVE';
  const demandStatus = isDataFromLiveAPI
    ? (pricing.soldLast90Days > 0 ? 'LIVE' : 'ESTIMATED')
    : 'MOCK';
  const demandSource = priceStatus === 'MOCK'
    ? 'Mock Data'
    : (pricing.soldLast90Days > 0
      ? `eBay Sold Items (${pricing.soldLast90Days} in 90 days)`
      : 'eBay Heuristics (listing count)');

  return {
    channel: 'eBay',
    marketplace,
    sellPrice: fees.sellPrice,
    priceExVat: fees.priceExVat,  // Ex-VAT sell price for transparency
    currency: marketCurrency,
    // Track sell price source for assumptions tracking
    // eBay prices are always live/api even if demand is estimated
    pricingSource: 'api',
    confidence: demandData.confidence || 'Medium',
    guardrail: guardrailDrivers.length > 0 ? { isFlagged: true, drivers: guardrailDrivers } : null,
    // Data source transparency per component
    dataSources: {
      price: { status: priceStatus, source: priceStatus === 'LIVE' ? 'eBay API' : 'Mock Data' },
      demand: { status: demandStatus, source: demandSource },
      fees: { status: 'MOCK', source: 'eBay Fee Schedule 2025' }
    },
    fees: {
      total: fees.totalFees,
      breakdown: {
        finalValue: fees.finalValueFee,
        perOrder: fees.perOrderFee,
        vat: fees.vat,
        vatRate: fees.vatRate
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
    // FX transparency: show rate and timestamp used for conversion
    fx: landedCostConversion.fx,
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
  const { ean, quantity, buyPrice, currency = 'USD', supplierRegion = 'CN', reclaimVat = true, hsCode = null } = input;

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

  // Check if we should use HS code calculation (either from input or from override)
  const hasHsCodeOverride = hsCode || (dutyOverrides && (
    Array.isArray(dutyOverrides)
      ? dutyOverrides.some(o => o.hsCode || o.calculationMethod === 'hscode')
      : (dutyOverrides.hsCode || dutyOverrides.calculationMethod === 'hscode')
  ));

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

    // Determine if we should use HS code calculation
    // Priority: 1) Override HS code, 2) Input HS code, 3) Category-based
    const shouldUseHSCode = matchingOverride?.hsCode || matchingOverride?.calculationMethod === 'hscode' || hsCode;
    const effectiveHSCode = matchingOverride?.hsCode || hsCode;

    if (shouldUseHSCode) {
      // Use async calculateDutyWithHSCode for real-time API lookup
      dutyResult = await dutyCalculator.calculateDutyWithHSCode(buyPrice, supplierRegion, dest, {
        hsCode: effectiveHSCode,
        category: category,
        productName: productName,
        overrides: matchingOverride || null
      });

      console.log(`[MultiChannel Evaluator] HS Code duty lookup for ${supplierRegion}->${dest}:`, {
        hsCode: effectiveHSCode || 'auto-detected',
        rate: dutyResult.dutyRate,
        ratePercent: dutyResult.dutyPercent,
        source: dutyResult.source || 'live',
        isOverride: !!matchingOverride
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
    const importVatRate = feeCalculator.VAT_RATES[dest]?.standard || 0;
    const normalizedShippingCost = currency === 'USD'
      ? shippingResult.perUnitShippingCost
      : currencyService.convert(shippingResult.perUnitShippingCost, 'USD', currency);
    const importVatAmount = (buyPrice + normalizedShippingCost + dutyResult.dutyAmount) * importVatRate;

    // Total landed cost per unit in source currency
    const landedCost = buyPrice + dutyResult.dutyAmount + normalizedShippingCost + (reclaimVat ? 0 : importVatAmount);

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
      shipping: normalizedShippingCost,
      shippingMethod: shippingResult.method,
      shippingRatePerKg: currency === 'USD' ? shippingResult.ratePerKg : currencyService.convert(shippingResult.ratePerKg, 'USD', currency),
      shippingTransitDays: shippingResult.transitDays,
      shippingMinCharge: currency === 'USD' ? shippingResult.minCharge : currencyService.convert(shippingResult.minCharge, 'USD', currency),
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
      const channel = processAmazonChannelWithLandedCost(marketplace, pricing, productData, landed, currency, quantity, feeOverrides, input);
      if (channel) allChannels.push(channel);
    }
  }

  // Process eBay channels
  if (ebayPricing) {
    for (const [marketplace, pricing] of Object.entries(ebayPricing)) {
      const landed = landedCosts[marketplace] || landedCosts['US'];
      const channel = processEbayChannelWithLandedCost(marketplace, pricing, landed, currency, quantity, feeOverrides, input);
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

      // FX transparency: Add FX info for retailer channels
      const retailerFxConversion = currencyService.convertWithMeta(usLandedCost, currency, retailer.currency);
      withMargin.fx = retailerFxConversion.fx;

      // Calculate months to sell
      const absorptionCapacity = Math.round((withMargin.demand?.estimatedMonthlySales?.mid || 30) * 0.15);
      withMargin.demand.absorptionCapacity = absorptionCapacity;
      withMargin.monthsToSell = absorptionCapacity > 0 ? Number((quantity / absorptionCapacity).toFixed(1)) : 999;

      // Track sell price source (based on reference price source)
      withMargin.pricingSource = hasAmazonUS
        ? (amazonPricing['US'].dataSource || 'live')
        : (ebayPricing['US'].dataSource || 'live');
      withMargin.confidence = 'Medium'; // Retailer channels use estimated pricing

      // Identify margin drivers for high-ROI transparency
      const guardrailDrivers = withMargin.marginPercent > THRESHOLDS.marginGuardrailThreshold
        ? identifyMarginDrivers({ sellPrice: withMargin.sellPrice, channel: 'Retailer', marketplace: retailer.marketplace }, withMargin.landedCost, { dataSource: withMargin.pricingSource }, input, retailer.marketplace)
        : [];

      // Add explanation
      withMargin.explanation = generateChannelExplanation(
        'Retailer',
        withMargin.retailer,
        withMargin.marginPercent,
        withMargin.fees,
        withMargin.demand,
        withMargin.monthsToSell,
        withMargin.recommendation,
        guardrailDrivers
      );

      if (guardrailDrivers.length > 0) {
        withMargin.guardrail = { isFlagged: true, drivers: guardrailDrivers };
      }

      // Data source transparency - Retailers are always MOCK
      withMargin.dataSources = {
        price: { status: 'MOCK', source: `Derived from ${hasAmazonUS ? 'Amazon' : 'eBay'} reference price` },
        demand: { status: 'MOCK', source: 'Mocked estimate (category-based)' },
        fees: { status: 'MOCK', source: `${withMargin.retailer} fee rates` }
      };

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

      // FX transparency: Add FX info for distributor channels
      const distributorFxConversion = currencyService.convertWithMeta(usLandedCost, currency, distributor.currency);
      withMargin.fx = distributorFxConversion.fx;

      // For distributors, absorption capacity is higher (bulk sales)
      const absorptionCapacity = Math.round((withMargin.demand?.estimatedMonthlySales?.mid || 500) * 0.20);
      withMargin.demand.absorptionCapacity = absorptionCapacity;
      withMargin.monthsToSell = absorptionCapacity > 0 ? Number((quantity / absorptionCapacity).toFixed(1)) : 999;

      // Track sell price source (based on reference price source)
      withMargin.pricingSource = hasAmazonUS
        ? (amazonPricing['US'].dataSource || 'live')
        : (ebayPricing['US'].dataSource || 'live');
      withMargin.confidence = 'Medium'; // Distributor channels use estimated pricing

      // Identify margin drivers for high-ROI transparency
      const guardrailDrivers = withMargin.marginPercent > THRESHOLDS.marginGuardrailThreshold
        ? identifyMarginDrivers({ sellPrice: withMargin.sellPrice, channel: 'Distributor', marketplace: distributor.marketplace }, withMargin.landedCost, { dataSource: withMargin.pricingSource }, input, distributor.marketplace)
        : [];

      // Add explanation  
      withMargin.explanation = generateChannelExplanation(
        'Distributor',
        withMargin.distributor,
        withMargin.marginPercent,
        withMargin.fees,
        withMargin.demand,
        withMargin.monthsToSell,
        withMargin.recommendation,
        guardrailDrivers
      );

      if (guardrailDrivers.length > 0) {
        withMargin.guardrail = { isFlagged: true, drivers: guardrailDrivers };
      }

      // Data source transparency - Distributors are always MOCK
      withMargin.dataSources = {
        price: { status: 'MOCK', source: `Derived from ${hasAmazonUS ? 'Amazon' : 'eBay'} reference price` },
        demand: { status: 'MOCK', source: 'Mocked estimate (distribution volume)' },
        fees: { status: 'MOCK', source: `${withMargin.distributor} wholesale terms` }
      };

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

  // Recommended channels and absorption (needed for allocation and volume risk)
  const recommendedChannels = allChannels.filter(c => c.recommendation === 'Sell');
  const totalAbsorption = recommendedChannels.reduce((sum, c) => sum + (c.demand?.absorptionCapacity || 0), 0);
  const overallMonthsToSell = totalAbsorption > 0 ? quantity / totalAbsorption : 999;

  const getChannelKey = (channel) => {
    if (channel.retailer) return `${channel.retailer}-${channel.marketplace}`;
    if (channel.distributor) return `${channel.distributor}-${channel.marketplace}`;
    return `${channel.channel}-${channel.marketplace}`;
  };

  // Run allocation before scoring so margin/demand/data reliability are deal-level (allocated channels)
  const sortedByMargin = [...recommendedChannels].sort((a, b) => b.marginPercent - a.marginPercent);
  const sortedBySpeed = [...recommendedChannels]
    .filter(c => (c.demand?.absorptionCapacity || 0) > 0)
    .sort((a, b) => {
      const monthsA = a.demand?.absorptionCapacity > 0 ? quantity / a.demand.absorptionCapacity : 999;
      const monthsB = b.demand?.absorptionCapacity > 0 ? quantity / b.demand.absorptionCapacity : 999;
      return monthsA - monthsB;
    });

  const allocation = {};
  const allocationDetails = {};
  let remainingQty = quantity;
  const marginAllocationTarget = Math.floor(quantity * 0.65);
  let marginAllocated = 0;
  const marginChannels = [];
  const speedChannels = [];

  for (const channel of sortedByMargin) {
    if (marginAllocated >= marginAllocationTarget || remainingQty <= 0) break;
    const absorptionCapacity = channel.demand?.absorptionCapacity || 0;
    if (absorptionCapacity === 0) continue;
    const maxAllocation = absorptionCapacity * 3;
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

  for (const channel of sortedBySpeed) {
    if (remainingQty <= 0) break;
    const key = getChannelKey(channel);
    if (allocation[key]) continue;
    const absorptionCapacity = channel.demand?.absorptionCapacity || 0;
    if (absorptionCapacity === 0) continue;
    const allocated = Math.min(remainingQty, Math.floor(absorptionCapacity * 3));
    if (allocated > 0) {
      allocation[key] = allocated;
      speedChannels.push(key);
      remainingQty -= allocated;
    }
  }

  for (const [channelKey, allocatedQty] of Object.entries(allocation)) {
    const channel = allChannels.find(c => getChannelKey(c) === channelKey);
    if (!channel) continue;
    const absorptionCapacity = channel.demand?.absorptionCapacity || 0;
    const monthlySales = channel.demand?.estimatedMonthlySales?.mid || 0;
    const monthsToSell = absorptionCapacity > 0 ? allocatedQty / absorptionCapacity : 0;
    const isMarginCh = marginChannels.includes(channelKey);
    const isSpeedCh = speedChannels.includes(channelKey);
    let channelRationale = `Allocated ${allocatedQty} units to ${channelKey} `;
    if (isMarginCh && isSpeedCh) channelRationale += `(hybrid: high margin ${channel.marginPercent.toFixed(1)}% + fast absorption ${monthsToSell.toFixed(1)} months). `;
    else if (isMarginCh) channelRationale += `based on HIGH MARGIN strategy (${channel.marginPercent.toFixed(1)}% margin). `;
    else if (isSpeedCh) channelRationale += `based on FAST ABSORPTION strategy (${monthsToSell.toFixed(1)} months to sell). `;
    if (absorptionCapacity > 0) {
      channelRationale += `Monthly absorption capacity: ${absorptionCapacity} units (${monthlySales} estimated sales × market share). This allocation represents ${monthsToSell.toFixed(1)} months of sales capacity. `;
    }
    channelRationale += `Margin: ${channel.marginPercent.toFixed(1)}%.`;
    allocationDetails[channelKey] = channelRationale;
  }

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

  for (const channel of allChannels) {
    const key = getChannelKey(channel);
    if (allocation[key] || channel.recommendation === 'Sell') continue;
    const absorptionCapacity = channel.demand?.absorptionCapacity || 0;
    let reason = channel.marginPercent < THRESHOLDS.minMarginPercent
      ? `Not allocated: ${key} has margin of ${channel.marginPercent.toFixed(1)}% (below ${THRESHOLDS.minMarginPercent}% threshold). `
      : `Not allocated: ${key} not recommended for selling. `;
    reason += absorptionCapacity === 0 ? 'No reliable demand data available.' : `Estimated ${(quantity / absorptionCapacity).toFixed(1)} months to sell through quantity.`;
    allocationDetails[key] = reason;
  }

  // Note: overallRationale will be updated after holdBackReason is calculated
  let overallRationale = '';

  // --- Deal-level scoring: margin/demand from allocated channels; volume as-is; data = how much is live vs mock ---
  const allocKeys = Object.keys(allocation);
  const hasAllocation = allocKeys.length > 0;

  const getLandedCostUSD = (ch) => {
    const total = ch.landedCost?.total ?? landedCosts[ch.marketplace]?.totalLandedCost ?? buyPrice;
    return currencyService.toUSD(total, currency);
  };
  const getNetProceedsUSD = (ch) => currencyService.toUSD(ch.netProceeds, ch.currency);

  let marginScore;
  let marginPercentActual;
  let marginDetailSource;

  if (hasAllocation) {
    let totalLandedUSD = 0;
    let totalProceedsUSD = 0;
    for (const key of allocKeys) {
      const ch = allChannels.find(c => getChannelKey(c) === key);
      if (!ch) continue;
      const q = allocation[key];
      totalLandedUSD += getLandedCostUSD(ch) * q;
      totalProceedsUSD += getNetProceedsUSD(ch) * q;
    }
    marginPercentActual = totalLandedUSD > 0 ? ((totalProceedsUSD - totalLandedUSD) / totalLandedUSD) * 100 : 0;
    marginScore = totalLandedUSD > 0 ? calculateMarginScore(totalProceedsUSD, totalLandedUSD) : 0;
    marginDetailSource = 'allocated';
  } else {
    marginPercentActual = bestLandedCostUSD > 0 ? ((bestNetProceedsUSD - bestLandedCostUSD) / bestLandedCostUSD) * 100 : 0;
    marginScore = calculateMarginScore(bestNetProceedsUSD, bestLandedCostUSD);
    marginDetailSource = 'bestChannel';
  }

  // Demand: always weighted over all channels (by absorption capacity), with per-channel breakdown for tooltip
  const demandPool = allChannels;
  let demandScore;
  const demandBreakdownRows = [];
  let demandWeightedSum = 0;
  let demandTotalWeight = 0;
  for (const ch of demandPool) {
    const key = getChannelKey(ch);
    const d = ch.demand;
    const baseScore = d && d.confidence !== 'None' ? (d.confidenceScore ?? 50) : 0;
    const salesMid = d?.estimatedMonthlySales?.mid;
    const addedTen = !!(salesMid != null && salesMid > 200);
    const channelScore = calculateDemandScore(d);
    const weight = (d?.absorptionCapacity || 0) > 0 ? d.absorptionCapacity : 1;
    demandWeightedSum += channelScore * weight;
    demandTotalWeight += weight;
    demandBreakdownRows.push({
      channelKey: key,
      allocatedQty: weight,
      weight,
      baseScore,
      estimatedMonthlySales: salesMid,
      addedTen,
      channelScore: Math.round(channelScore * 10) / 10
    });
  }
  if (demandTotalWeight > 0) {
    demandScore = demandWeightedSum / demandTotalWeight;
  } else {
    demandScore = demandPool.length > 0
      ? demandPool.reduce((s, c) => s + calculateDemandScore(c.demand), 0) / demandPool.length
      : calculateDemandScore(bestChannel.demand);
  }
  let demandBreakdown = null;
  if (demandBreakdownRows.length > 0 && demandTotalWeight > 0) {
    const sumParts = demandBreakdownRows.map(b => `${b.channelScore}×${b.weight}`).join(' + ');
    demandBreakdown = {
      rows: demandBreakdownRows,
      totalQty: Math.round(demandTotalWeight),
      totalWeight: demandTotalWeight,
      weightedFormula: `${Math.round(demandScore * 10) / 10} = (${sumParts}) / ${Math.round(demandTotalWeight * 10) / 10}`
    };
  }

  // Determine why units are held back
  const totalAllocated = hasAllocation ? allocKeys.reduce((sum, k) => sum + (allocation[k] || 0), 0) : 0;
  const heldBackQty = quantity - totalAllocated;
  
  // Check if ANY channels have absorption capacity (regardless of margin)
  const channelsWithAbsorption = allChannels.filter(c => (c.demand?.absorptionCapacity || 0) > 0);
  const totalAbsorptionCapacity = channelsWithAbsorption.reduce((sum, c) => 
    sum + (c.demand?.absorptionCapacity || 0), 0
  );
  
  // Check if there are viable channels (with good margins) that have absorption capacity
  const viableChannelsWithCapacity = channelsWithAbsorption.filter(c => 
    c.marginPercent >= THRESHOLDS.minMarginPercent
  );
  const totalViableAbsorption = viableChannelsWithCapacity.reduce((sum, c) => 
    sum + (c.demand?.absorptionCapacity || 0), 0
  );
  
  // Determine hold-back reason
  // Check if remaining units could be allocated if margins were better
  const unallocatedChannelsWithCapacity = allChannels.filter(c => {
    const key = getChannelKey(c);
    return !allocation[key] && 
           (c.demand?.absorptionCapacity || 0) > 0 &&
           c.marginPercent < THRESHOLDS.minMarginPercent;
  });
  const unallocatedAbsorptionCapacity = unallocatedChannelsWithCapacity.reduce((sum, c) => 
    sum + (c.demand?.absorptionCapacity || 0), 0
  );
  
  const holdBackReason = heldBackQty > 0
    ? totalAllocated === 0 && totalAbsorptionCapacity === 0
      ? 'no_absorption' // No channels have absorption capacity - can't sell
      : totalAllocated === 0 && totalAbsorptionCapacity > 0 && totalViableAbsorption === 0
        ? 'low_margins' // Channels exist with absorption but margins too low - strategic hold
      : totalAllocated === 0 && totalViableAbsorption > 0
        ? 'low_margins' // Shouldn't happen (would be allocated), but handle edge case
      : totalAllocated > 0 && unallocatedAbsorptionCapacity > 0 && remainingQty > 0
        ? 'low_margins' // Some allocated, but remaining units held back due to low margins on other channels
        : 'strategic' // Some allocated, rest held back strategically (market flooding prevention)
    : null;

  // Volume risk months: when there is allocation, use slowest allocated channel (bottleneck)
  // When held back due to low margins but absorption exists, calculate risk as if we could sell (worst case)
  // When held back due to no absorption, risk is maximum
  const volumeRiskMonthsToSell = hasAllocation && allocKeys.length > 0
    ? (() => {
        const perChannel = allocKeys.map(k => {
          const ch = allChannels.find(c => getChannelKey(c) === k);
          const cap = ch?.demand?.absorptionCapacity || 0;
          return cap > 0 ? allocation[k] / cap : 0;
        });
        const maxM = perChannel.length ? Math.max(...perChannel) : 0;
        return maxM > 0 ? maxM : 999;
      })()
    : holdBackReason === 'low_margins' && totalAbsorptionCapacity > 0
      ? quantity / totalAbsorptionCapacity // Calculate as if margins improve and we could sell on channels with capacity
      : overallMonthsToSell;

  // Volume risk bands: ≤2 no risk (100), then increasing risk → decreasing score
  // Higher months to sell = higher risk = lower score
  // No absorption capacity = maximum risk = 0 score
  // Low margins hold-back: calculate risk based on viable channels (if margins improve, can sell)
  const volumeRiskScore = holdBackReason === 'no_absorption' || volumeRiskMonthsToSell >= 999 || volumeRiskMonthsToSell > 12 ? 0
    : volumeRiskMonthsToSell <= 2 ? 100
      : volumeRiskMonthsToSell <= 3 ? 85
        : volumeRiskMonthsToSell <= 4 ? 75
          : volumeRiskMonthsToSell <= 5 ? 70
            : volumeRiskMonthsToSell <= 7 ? 50
              : volumeRiskMonthsToSell <= 9 ? 30
                : volumeRiskMonthsToSell <= 12 ? 15
                  : 0;

  // Update overallRationale based on hold-back reason
  if (Object.keys(allocation).length === 0) {
    if (holdBackReason === 'no_absorption') {
      overallRationale = 'No channels allocated due to insufficient market absorption capacity.';
    } else if (holdBackReason === 'low_margins') {
      const bestMargin = allChannels.length > 0 ? Math.max(...allChannels.map(c => c.marginPercent)) : 0;
      overallRationale = `No channels allocated - margins below ${THRESHOLDS.minMarginPercent}% threshold (best margin: ${bestMargin.toFixed(1)}%). ${totalAbsorptionCapacity.toFixed(0)} units/mo capacity exists if margins improve.`;
    } else {
      overallRationale = 'No channels allocated due to insufficient market absorption capacity.';
    }
  } else {
    const allocatedChannels = Object.keys(allocation);
    const marginChannelsList = marginChannels.filter(c => allocation[c]);
    const speedChannelsList = speedChannels.filter(c => allocation[c]);
    const marginPct = Math.round((marginAllocated / quantity) * 100);
    const speedPct = Math.round((speedChannelsList.reduce((sum, c) => sum + (allocation[c] || 0), 0) / quantity) * 100);
    if (remainingQty > 0) {
      if (holdBackReason === 'low_margins') {
        const unallocatedBestMargin = unallocatedChannelsWithCapacity.length > 0 
          ? Math.max(...unallocatedChannelsWithCapacity.map(c => c.marginPercent))
          : (allChannels.length > 0 ? Math.max(...allChannels.map(c => c.marginPercent)) : 0);
        overallRationale = `${marginPct}% allocated to high-margin channels (${marginChannelsList.join(', ')}) and ${speedPct}% to fast-absorption channels (${speedChannelsList.join(', ')}). ${remainingQty} units held back - remaining channels have margins below ${THRESHOLDS.minMarginPercent}% threshold (best unallocated margin: ${unallocatedBestMargin.toFixed(1)}%). ${unallocatedAbsorptionCapacity.toFixed(0)} units/mo capacity exists if margins improve.`;
      } else if (holdBackReason === 'strategic') {
        overallRationale = `${marginPct}% allocated to high-margin channels (${marginChannelsList.join(', ')}) and ${speedPct}% to fast-absorption channels (${speedChannelsList.join(', ')}). ${remainingQty} units held back to avoid market flooding. Release in phases based on actual sales performance.`;
      } else {
        overallRationale = `${marginPct}% allocated to high-margin channels (${marginChannelsList.join(', ')}) and ${speedPct}% to fast-absorption channels (${speedChannelsList.join(', ')}). ${remainingQty} units held back.`;
      }
    } else {
      const maxMonths = Math.max(...allocatedChannels.map(c => {
        const ch = allChannels.find(ch => getChannelKey(ch) === c);
        return ch?.demand?.absorptionCapacity > 0 ? (allocation[c] / ch.demand.absorptionCapacity) : 0;
      }), 0);
      overallRationale = `${marginPct}% allocated to high-margin channels (${marginChannelsList.join(', ')}) and ${speedPct}% to fast-absorption channels (${speedChannelsList.join(', ')}). Estimated sell-through: ${maxMonths.toFixed(1)} months.`;
    }
  }

  // Live = real prices and demand (not mock). A channel is mock if pricing/demand source is mock or dataSources.price/demand.status is MOCK. (Costs/landed cost are not tracked as live vs mock.)
  const isMock = (ch) => {
    const ps = ch.pricingSource || ch.dataSource;
    if (ps === 'mock' || ps === 'mock-fallback') return true;
    const status = ch.dataSources?.price?.status || ch.dataSources?.demand?.status;
    return status === 'MOCK';
  };

  // Data reliability: always use all channels (consistent count regardless of margin/allocation)
  const dataReliabilityPool = allChannels;
  let dataReliabilityLiveN = 0;
  for (const ch of dataReliabilityPool) {
    if (!isMock(ch)) dataReliabilityLiveN += 1;
  }
  const dataReliabilityN = dataReliabilityPool.length;
  const dataReliabilityScore = dataReliabilityN > 0 ? Math.round(100 * (dataReliabilityLiveN / dataReliabilityN)) : 0;
  const dataReliabilityDetail = {
    liveChannels: dataReliabilityLiveN,
    totalChannels: dataReliabilityN,
    formula: '100 × (live channels / total channels)',
    whatCounts: 'Live = real prices and demand (not mock or fallback).'
  };

  // Calculate overall score
  const overallScore =
    marginScore * WEIGHTS.netMargin +
    demandScore * WEIGHTS.demandConfidence +
    volumeRiskScore * WEIGHTS.volumeRisk +
    dataReliabilityScore * WEIGHTS.dataReliability;

  // Build calculation details per component — whole-deal only; no single-channel emphasis
  const marginNetProceedsUSD = hasAllocation
    ? allocKeys.reduce((s, k) => { const ch = allChannels.find(c => getChannelKey(c) === k); return ch ? s + getNetProceedsUSD(ch) * (allocation[k] || 0) : s; }, 0)
    : bestNetProceedsUSD;
  const marginLandedUSD = hasAllocation
    ? allocKeys.reduce((s, k) => { const ch = allChannels.find(c => getChannelKey(c) === k); return ch ? s + getLandedCostUSD(ch) * (allocation[k] || 0) : s; }, 0)
    : bestLandedCostUSD;

  const calculationDetails = {
    margin: {
      netProceedsUSD: Number(marginNetProceedsUSD.toFixed(2)),
      landedCostUSD: Number(marginLandedUSD.toFixed(2)),
      marginPercent: Number(marginPercentActual.toFixed(1)),
      formula: 'Margin % = (Net proceeds − Landed cost) / Landed cost × 100',
      bands: `Score bands: <15% → 0–30 pts, 15–30% → 30–60 pts, 30–50% → 60–85 pts, 50%+ → 85–100 pts`,
      scope: marginDetailSource === 'allocated' ? 'deal' : 'single',
      allocatedChannels: marginDetailSource === 'allocated' ? allocKeys : undefined,
      bestChannel: marginDetailSource === 'allocated' ? undefined : `${bestChannel.channel}-${bestChannel.marketplace}`,
      source: marginDetailSource === 'allocated' ? `Deal margin across allocated channels: ${allocKeys.join(', ')}` : 'Single best-margin channel (no allocation)'
    },
    demand: {
      confidence: 'Weighted over all channels (by absorption)',
      confidenceScore: Math.round(demandScore),
      scope: 'deal',
      allocatedChannelCount: allChannels.length,
      source: `Demand score weighted by absorption across all ${allChannels.length} channel(s)`,
      ...(demandBreakdown && { breakdown: demandBreakdown })
    },
    volumeRisk: {
      quantity,
      totalAbsorptionCapacity: holdBackReason === 'no_absorption'
        ? 0 // No absorption capacity available
        : Math.round(totalAbsorptionCapacity), // Always show total capacity (all channels with absorption)
      monthsToSell: holdBackReason === 'no_absorption' ? null : Number(volumeRiskMonthsToSell.toFixed(1)),
      holdBackReason: holdBackReason, // 'no_absorption', 'low_margins', 'strategic', or null
      heldBackQty: heldBackQty,
      formula: holdBackReason === 'no_absorption'
        ? 'All units held back - no absorption capacity, maximum inventory risk'
        : holdBackReason === 'low_margins'
          ? `All units held back - margins too low (${totalAbsorptionCapacity.toFixed(0)} units/mo capacity exists if margins improve)`
          : hasAllocation
            ? "Months to sell = slowest allocated channel's (allocated qty ÷ absorption)"
            : 'Months to sell = Quantity / Total absorption across recommended channels',
      bands: '≤2 mo → 100 (no risk), 2–3 → 85, 3–4 → 75, 4–5 → 70, 5–7 → 50, 7–9 → 30, 9–12 → 15, >12 or no absorption → 0 (max risk)',
      scope: 'deal',
      basedOnAllocatedChannels: !!hasAllocation
    },
    dataReliability: {
      channelsWithData: dataReliabilityDetail.totalChannels ?? 0,
      liveChannels: dataReliabilityDetail.liveChannels ?? 0,
      formula: dataReliabilityDetail.formula,
      whatCounts: dataReliabilityDetail.whatCounts,
      metric: 'channels',
      maxChannelsFor100: 5,
      scope: 'deal'
    }
  };

  // Penalties: points lost from ideal (100) per component, with reason (deal-level wording when applicable)
  const penalties = [];
  if (marginScore < 100) {
    const lost = Math.round(100 - marginScore);
    let reason = '';
    if (marginPercentActual < 0) reason = 'Negative margin';
    else if (marginPercentActual < THRESHOLDS.minMarginPercent) reason = `Margin ${marginPercentActual.toFixed(1)}% below minimum ${THRESHOLDS.minMarginPercent}%`;
    else if (marginPercentActual < THRESHOLDS.goodMarginPercent) reason = `Margin ${marginPercentActual.toFixed(1)}% below good threshold (${THRESHOLDS.goodMarginPercent}%)`;
    else reason = `Margin ${marginPercentActual.toFixed(1)}% below excellent (${THRESHOLDS.excellentMarginPercent}%+)`;
    if (marginDetailSource === 'allocated') reason += ' (allocation-weighted)';
    penalties.push({ component: 'margin', pointsLost: lost, reason, weight: WEIGHTS.netMargin, weightedImpact: Number((lost * WEIGHTS.netMargin).toFixed(1)) });
  }
  if (demandScore < 100) {
    const roundedDemand = Math.round(demandScore);
    const lost = 100 - roundedDemand; // Match displayed score: 54/100 → −46 pts
    const reason = 'Base from demand confidence (50 when not reported); +10 only if est. monthly sales > 200. Weighted by absorption across all channels.';
    penalties.push({ component: 'demand', pointsLost: lost, reason, weight: WEIGHTS.demandConfidence, weightedImpact: Number((lost * WEIGHTS.demandConfidence).toFixed(1)) });
  }
  if (volumeRiskScore < 100) {
    const lost = Math.round(100 - volumeRiskScore);
    let reason = '';
    if (holdBackReason === 'no_absorption') {
      reason = `All ${quantity} units held back - no absorption capacity available, maximum inventory risk`;
    } else if (holdBackReason === 'low_margins') {
      const bestMargin = allChannels.length > 0 ? Math.max(...allChannels.map(c => c.marginPercent)) : 0;
      reason = `All ${quantity} units held back - margins below ${THRESHOLDS.minMarginPercent}% threshold (best margin: ${bestMargin.toFixed(1)}%). ${totalAbsorptionCapacity.toFixed(0)} units/mo capacity exists if margins improve (${(quantity / totalAbsorptionCapacity).toFixed(1)} months to sell at current capacity)`;
    } else if (volumeRiskMonthsToSell >= 999 || volumeRiskMonthsToSell > THRESHOLDS.dangerMonthsToSell) {
      reason = `High inventory risk: ${volumeRiskMonthsToSell >= 999 ? 'no absorption capacity' : `${volumeRiskMonthsToSell.toFixed(0)}+ months to sell`}`;
    } else if (volumeRiskMonthsToSell > THRESHOLDS.maxMonthsToSell) {
      reason = `Volume risk: ${volumeRiskMonthsToSell.toFixed(1)} months to sell (threshold ${THRESHOLDS.maxMonthsToSell})`;
    } else {
      reason = hasAllocation ? `Slowest allocated channel: ${volumeRiskMonthsToSell.toFixed(1)} months to sell` : `${volumeRiskMonthsToSell.toFixed(1)} months to sell through quantity`;
    }
    penalties.push({ component: 'volumeRisk', pointsLost: lost, reason, weight: WEIGHTS.volumeRisk, weightedImpact: Number((lost * WEIGHTS.volumeRisk).toFixed(1)) });
  }
  if (dataReliabilityScore < 100) {
    const lost = Math.round(100 - dataReliabilityScore);
    const reason = `${(dataReliabilityDetail.totalChannels || 0) - (dataReliabilityDetail.liveChannels || 0)} of ${dataReliabilityDetail.totalChannels || 0} channels use mock prices or demand`;
    penalties.push({
      component: 'dataReliability',
      pointsLost: lost,
      reason,
      weight: WEIGHTS.dataReliability,
      weightedImpact: Number((lost * WEIGHTS.dataReliability).toFixed(1))
    });
  }

  // Generate decision using deal-level margin (allocation-weighted or best-channel)
  const decision = overallScore >= 75 && marginPercentActual >= THRESHOLDS.minMarginPercent ? 'Buy'
    : overallScore >= 55 && marginPercentActual >= 10 ? 'Renegotiate'
      : overallScore >= 40 && marginPercentActual > 0 ? 'Source Elsewhere'
        : 'Pass';

  // Generate detailed decision explanation with threshold analysis
  const generateDecisionExplanation = () => {
    const thresholds = [
      {
        name: 'Overall Score',
        required: decision === 'Buy' ? 75 : decision === 'Renegotiate' ? 55 : decision === 'Source Elsewhere' ? 40 : 0,
        actual: Math.round(overallScore),
        met: decision === 'Buy' ? overallScore >= 75 : decision === 'Renegotiate' ? overallScore >= 55 : decision === 'Source Elsewhere' ? overallScore >= 40 : false,
        description: decision === 'Buy' ? 'Score ≥ 75% required for Buy' : decision === 'Renegotiate' ? 'Score ≥ 55% required for Renegotiate' : decision === 'Source Elsewhere' ? 'Score ≥ 40% required for Source Elsewhere' : 'Score too low for any positive decision'
      },
      {
        name: 'Margin',
        required: decision === 'Buy' ? THRESHOLDS.minMarginPercent : decision === 'Renegotiate' ? 10 : decision === 'Source Elsewhere' ? 0 : THRESHOLDS.minMarginPercent,
        actual: marginPercentActual,
        met: decision === 'Buy' ? marginPercentActual >= THRESHOLDS.minMarginPercent : decision === 'Renegotiate' ? marginPercentActual >= 10 : decision === 'Source Elsewhere' ? marginPercentActual > 0 : false,
        description: decision === 'Buy' ? `Margin ≥ ${THRESHOLDS.minMarginPercent}% required` : decision === 'Renegotiate' ? 'Margin ≥ 10% required' : decision === 'Source Elsewhere' ? 'Margin > 0% required' : `Margin < ${THRESHOLDS.minMarginPercent}% threshold`
      },
      {
        name: 'Volume Risk',
        required: THRESHOLDS.maxMonthsToSell,
        actual: volumeRiskMonthsToSell,
        met: volumeRiskMonthsToSell <= THRESHOLDS.maxMonthsToSell,
        description: `Months to sell ≤ ${THRESHOLDS.maxMonthsToSell} months (low risk)`
      },
      {
        name: 'Demand Confidence',
        required: 50, // Base threshold for demand
        actual: Math.round(demandScore),
        met: demandScore >= 50,
        description: 'Demand confidence score ≥ 50 (moderate confidence)'
      },
      {
        name: 'Data Reliability',
        required: 60, // Reasonable threshold
        actual: Math.round(dataReliabilityScore),
        met: dataReliabilityScore >= 60,
        description: 'Data reliability score ≥ 60 (mostly live data)'
      }
    ];

    // Generate "Why [Decision]" explanation (format Margin % and Volume Risk months to 2 decimals)
    const fmt = (t, val) => (t.name === 'Margin' || t.name === 'Volume Risk' ? Number(val).toFixed(2) : String(val));
    let whyExplanation = '';
    const metThresholds = thresholds.filter(t => t.met);
    const unmetThresholds = thresholds.filter(t => !t.met);

    switch (decision) {
      case 'Buy':
        whyExplanation = `This deal meets all critical thresholds for a Buy recommendation. `;
        if (metThresholds.length > 0) {
          whyExplanation += `Key strengths: ${metThresholds.map(t => `${t.name} (${fmt(t, t.actual)}${t.name === 'Margin' ? '%' : t.name === 'Volume Risk' ? ' months' : ''})`).join(', ')}. `;
        }
        if (unmetThresholds.length > 0) {
          whyExplanation += `Note: ${unmetThresholds.map(t => `${t.name} is ${fmt(t, t.actual)}${t.name === 'Margin' ? '%' : t.name === 'Volume Risk' ? ' months' : ''} (threshold: ${fmt(t, t.required)}${t.name === 'Margin' ? '%' : t.name === 'Volume Risk' ? ' months' : ''})`).join(', ')}, but overall score and margin requirements are met.`;
        }
        break;
      case 'Renegotiate':
        whyExplanation = `This deal shows potential but needs better terms. `;
        if (metThresholds.length > 0) {
          whyExplanation += `Met thresholds: ${metThresholds.map(t => `${t.name}`).join(', ')}. `;
        }
        if (unmetThresholds.length > 0) {
          whyExplanation += `Areas for improvement: ${unmetThresholds.map(t => `${t.name} is ${fmt(t, t.actual)}${t.name === 'Margin' ? '%' : t.name === 'Volume Risk' ? ' months' : ''} (needs ${fmt(t, t.required)}${t.name === 'Margin' ? '%' : t.name === 'Volume Risk' ? ' months' : ''})`).join(', ')}.`;
        }
        break;
      case 'Source Elsewhere':
        whyExplanation = `Current terms are weak. `;
        if (metThresholds.length > 0) {
          whyExplanation += `Some positive factors: ${metThresholds.map(t => `${t.name}`).join(', ')}. `;
        }
        if (unmetThresholds.length > 0) {
          whyExplanation += `Key gaps: ${unmetThresholds.map(t => `${t.name} is ${fmt(t, t.actual)}${t.name === 'Margin' ? '%' : t.name === 'Volume Risk' ? ' months' : ''} (needs ${fmt(t, t.required)}${t.name === 'Margin' ? '%' : t.name === 'Volume Risk' ? ' months' : ''})`).join(', ')}. Consider sourcing from alternative suppliers for better pricing.`;
        }
        break;
      case 'Pass':
        whyExplanation = `This deal does not meet minimum requirements. `;
        if (unmetThresholds.length > 0) {
          whyExplanation += `Critical issues: ${unmetThresholds.map(t => `${t.name} is ${fmt(t, t.actual)}${t.name === 'Margin' ? '%' : t.name === 'Volume Risk' ? ' months' : ''} (requires ${fmt(t, t.required)}${t.name === 'Margin' ? '%' : t.name === 'Volume Risk' ? ' months' : ''})`).join(', ')}.`;
        }
        break;
    }

    return {
      whyExplanation,
      thresholds,
      summary: {
        metCount: metThresholds.length,
        totalCount: thresholds.length,
        criticalUnmet: unmetThresholds.filter(t => t.name === 'Overall Score' || t.name === 'Margin').map(t => t.name)
      }
    };
  };

  const decisionExplanation = generateDecisionExplanation();

  // Generate explanation (keeping existing format for backward compatibility)
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

  if (volumeRiskMonthsToSell > THRESHOLDS.dangerMonthsToSell) {
    explanation += `High inventory risk: ${volumeRiskMonthsToSell.toFixed(0)}+ months to sell${hasAllocation ? ' (slowest allocated channel)' : ' through quantity'}. `;
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

  // Get FX cache status for transparency
  const fxStatus = currencyService.getCacheStatus();

  // Add classification metadata to each channel
  for (const channel of allChannels) {
    const key = getChannelKey(channel);
    const isViable = channel.marginPercent >= THRESHOLDS.minMarginPercent;
    const isRecommended = channel.recommendation === 'Sell';
    const isAllocated = allocation[key] && allocation[key] > 0;

    // Generate classification reason
    let classificationReason = '';
    if (isAllocated) {
      const isMarginChannel = marginChannels.includes(key);
      const isSpeedChannel = speedChannels.includes(key);
      if (isMarginChannel && isSpeedChannel) {
        classificationReason = `Allocated ${allocation[key]} units due to high margin and fast absorption.`;
      } else if (isMarginChannel) {
        classificationReason = `Allocated ${allocation[key]} units due to high margin (${channel.marginPercent.toFixed(1)}%).`;
      } else if (isSpeedChannel) {
        const monthsToSell = channel.demand?.absorptionCapacity > 0 
          ? (allocation[key] / channel.demand.absorptionCapacity).toFixed(1)
          : 'N/A';
        classificationReason = `Allocated ${allocation[key]} units due to fast absorption (${monthsToSell} months to sell).`;
      } else {
        classificationReason = `Allocated ${allocation[key]} units.`;
      }
    } else if (isRecommended) {
      const absorptionCapacity = channel.demand?.absorptionCapacity || 0;
      if (absorptionCapacity === 0) {
        classificationReason = 'Recommended but not allocated: insufficient market absorption capacity.';
      } else {
        const monthsToSell = quantity / absorptionCapacity;
        classificationReason = `Recommended but not allocated: lower priority than other channels (${monthsToSell.toFixed(1)} months to sell).`;
      }
    } else if (isViable) {
      classificationReason = `Viable (${channel.marginPercent.toFixed(1)}% margin) but not recommended due to ${channel.recommendation === 'Avoid' ? 'low demand confidence or other factors' : 'suboptimal conditions'}.`;
    } else {
      classificationReason = `Not viable: margin ${channel.marginPercent.toFixed(1)}% is below ${THRESHOLDS.minMarginPercent}% threshold.`;
    }

    channel.classification = {
      isViable,
      isRecommended,
      isAllocated,
      classificationReason
    };
  }

  // Calculate classification summary statistics
  const viableChannels = allChannels.filter(c => c.classification.isViable);
  const recommendedChannelsCount = allChannels.filter(c => c.classification.isRecommended).length;
  const allocatedChannelsCount = Object.keys(allocation).length;

  // Generate explanation for why allocation differs from recommendations
  let classificationExplanation = '';
  if (recommendedChannelsCount > allocatedChannelsCount) {
    const notAllocatedRecommended = allChannels.filter(
      c => c.classification.isRecommended && !c.classification.isAllocated
    );
    const reasons = [];
    
    const lowCapacity = notAllocatedRecommended.filter(c => (c.demand?.absorptionCapacity || 0) === 0);
    if (lowCapacity.length > 0) {
      reasons.push(`${lowCapacity.length} channel${lowCapacity.length > 1 ? 's have' : ' has'} insufficient absorption capacity`);
    }
    
    const lowerPriority = notAllocatedRecommended.filter(c => (c.demand?.absorptionCapacity || 0) > 0);
    if (lowerPriority.length > 0) {
      reasons.push(`${lowerPriority.length} channel${lowerPriority.length > 1 ? 's are' : ' is'} lower priority than allocated channels`);
    }
    
    classificationExplanation = `${recommendedChannelsCount} channels are recommended, but only ${allocatedChannelsCount} received allocation. `;
    if (reasons.length > 0) {
      classificationExplanation += `Reason: ${reasons.join(' and ')}. `;
    }
    classificationExplanation += `Allocation prioritizes high-margin and fast-turnover channels (max 3 months per channel).`;
  } else if (recommendedChannelsCount === allocatedChannelsCount && allocatedChannelsCount > 0) {
    classificationExplanation = `All ${recommendedChannelsCount} recommended channels received allocation.`;
  } else {
    classificationExplanation = `No channels allocated. ${recommendedChannelsCount} channel${recommendedChannelsCount !== 1 ? 's are' : ' is'} recommended but allocation was not possible due to capacity constraints.`;
  }

  return {
    ean,
    productTitle: productData?.title || 'Unknown Product',
    input: { quantity, buyPrice, currency, supplierRegion },
    // Currency transparency: document scoring methodology and FX status
    currencyInfo: {
      inputCurrency: currency,
      scoringMethod: 'marginPercent',
      scoringExplanation: 'Channels ranked by ROI % calculated in each market\'s local currency',
      fxAppliedOnce: true,
      fxConversionPoint: 'Landed cost converted from input currency to each market\'s local currency',
      fxTimestamp: fxStatus.lastUpdated,
      fxSource: fxStatus.hasCache ? 'live' : 'fallback'
    },
    dealScore: {
      overall: Math.round(overallScore),
      breakdown: {
        netMarginScore: Math.round(marginScore),
        demandConfidenceScore: Math.round(demandScore),
        volumeRiskScore: Math.round(volumeRiskScore),
        dataReliabilityScore: Math.round(dataReliabilityScore)
      },
      weighted: {
        marginContribution: Number((marginScore * WEIGHTS.netMargin).toFixed(2)),
        demandContribution: Number((demandScore * WEIGHTS.demandConfidence).toFixed(2)),
        volumeContribution: Number((volumeRiskScore * WEIGHTS.volumeRisk).toFixed(2)),
        reliabilityContribution: Number((dataReliabilityScore * WEIGHTS.dataReliability).toFixed(2))
      },
      weights: {
        netMargin: WEIGHTS.netMargin,
        demandConfidence: WEIGHTS.demandConfidence,
        volumeRisk: WEIGHTS.volumeRisk,
        dataReliability: WEIGHTS.dataReliability
      },
      calculationDetails,
      penalties
    },
    decision,
    explanation: explanation.trim(),
    decisionExplanation: {
      whyExplanation: decisionExplanation.whyExplanation,
      thresholds: decisionExplanation.thresholds.map(t => ({
        name: t.name,
        required: t.required,
        actual: Number(t.actual.toFixed(1)),
        met: t.met,
        description: t.description
      })),
      summary: decisionExplanation.summary
    },
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
