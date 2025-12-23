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
        referral: fees.referralFee,
        fba: fees.fbaFee,
        vat: fees.vat
      }
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
function processAmazonChannelWithLandedCost(marketplace, pricing, productData, landedCost, currency, quantity) {
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
    fees: {
      total: fees.totalFees,
      breakdown: {
        referral: fees.referralFee,
        fba: fees.fbaFee,
        vat: fees.vat
      }
    },
    netProceeds: fees.netProceeds,
    landedCost: {
      buyPrice: landedCost.buyPrice,
      duty: landedCost.duty,
      shipping: landedCost.shipping,
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
function processEbayChannelWithLandedCost(marketplace, pricing, landedCost, currency, quantity) {
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
      shipping: landedCost.shipping,
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
 */
export function evaluateMultiChannel(input, productData, amazonPricing, ebayPricing) {
  const { ean, quantity, buyPrice, currency = 'USD', supplierRegion = 'CN' } = input;

  // Get product weight (default 0.5kg)
  const weightKg = productData?.dimensions?.weightKg || 0.5;
  const category = productData?.category || 'default';

  // Calculate duty and shipping for each destination
  const landedCosts = {};
  const destinations = ['US', 'UK', 'DE', 'FR', 'IT', 'AU'];

  for (const dest of destinations) {
    // Calculate duty (per unit)
    const dutyResult = dutyCalculator.calculateDuty(buyPrice, supplierRegion, dest, category);

    // Calculate shipping (per unit, using air freight as default)
    const shippingResult = shippingCalculator.calculateBulkShipping(weightKg, quantity, supplierRegion, dest, 'air');

    // Total landed cost per unit in source currency
    const landedCost = buyPrice + dutyResult.dutyAmount + shippingResult.perUnitShippingCost;

    landedCosts[dest] = {
      buyPrice,
      duty: dutyResult.dutyAmount,
      dutyPercent: dutyResult.dutyRate * 100,
      shipping: shippingResult.perUnitShippingCost,
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
      const channel = processAmazonChannelWithLandedCost(marketplace, pricing, productData, landed, currency, quantity);
      if (channel) allChannels.push(channel);
    }
  }

  // Process eBay channels
  if (ebayPricing) {
    for (const [marketplace, pricing] of Object.entries(ebayPricing)) {
      const landed = landedCosts[marketplace] || landedCosts['US'];
      const channel = processEbayChannelWithLandedCost(marketplace, pricing, landed, currency, quantity);
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
        shipping: usLanded?.shipping || 0,
        total: usLandedCost
      };

      // Calculate months to sell
      const absorptionCapacity = Math.round((withMargin.demand?.estimatedMonthlySales?.mid || 30) * 0.15);
      withMargin.demand.absorptionCapacity = absorptionCapacity;
      withMargin.monthsToSell = absorptionCapacity > 0 ? Number((quantity / absorptionCapacity).toFixed(1)) : 999;

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
        shipping: usLanded?.shipping || 0,
        total: usLandedCost
      };

      // For distributors, absorption capacity is higher (bulk sales)
      const absorptionCapacity = Math.round((withMargin.demand?.estimatedMonthlySales?.mid || 500) * 0.20);
      withMargin.demand.absorptionCapacity = absorptionCapacity;
      withMargin.monthsToSell = absorptionCapacity > 0 ? Number((quantity / absorptionCapacity).toFixed(1)) : 999;

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
  const buyPriceUSD = currencyService.toUSD(buyPrice, currency);
  const bestNetProceedsUSD = currencyService.toUSD(bestChannel.netProceeds, bestChannel.currency);

  // Calculate overall scores
  const marginScore = calculateMarginScore(bestNetProceedsUSD, buyPriceUSD);
  const demandScore = calculateDemandScore(bestChannel.demand);

  // Calculate total absorption across all recommended channels
  const recommendedChannels = allChannels.filter(c => c.recommendation === 'Sell');
  const totalAbsorption = recommendedChannels.reduce((sum, c) => sum + (c.demand.absorptionCapacity || 0), 0);
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
      const key = `${channel.channel}-${channel.marketplace}`;
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
    const key = `${channel.channel}-${channel.marketplace}`;
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
    const channel = allChannels.find(c => `${c.channel}-${c.marketplace}` === channelKey);
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

  // Add skipped channels to details
  for (const channel of sortedByMargin) {
    const key = `${channel.channel}-${channel.marketplace}`;
    if (allocation[key]) continue;

    const absorptionCapacity = channel.demand?.absorptionCapacity || 0;
    if (absorptionCapacity === 0 && channel.marginPercent >= THRESHOLDS.minMarginPercent) {
      allocationDetails[key] = `Skipped ${key} despite ${channel.marginPercent.toFixed(1)}% margin due to insufficient market absorption capacity (no reliable demand data available).`;
    } else if (absorptionCapacity > 0 && !allocation[key]) {
      allocationDetails[key] = `Skipped ${key} (${channel.marginPercent.toFixed(1)}% margin, ${(quantity / absorptionCapacity).toFixed(1)} months to sell) - lower priority than allocated channels.`;
    }
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
