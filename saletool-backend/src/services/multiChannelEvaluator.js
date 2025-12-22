/**
 * Multi-Channel Deal Evaluator
 * 
 * Evaluates deals across multiple sales channels (Amazon, eBay, etc.)
 * Compares margins, demand, and risks to recommend best channels
 */

import feeCalculator from './feeCalculator.js';
import demandEstimator from './demandEstimator.js';
import currencyService from './currencyService.js';
import ebayService from './ebayService.js';

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
  dangerMonthsToSell: 12
};

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
      estimatedMonthlySales: demand?.estimatedMonthlySales || {low: 0, mid: 0, high: 0},
      confidence: demand?.confidence || 'Low',
      absorptionCapacity: demand?.absorptionCapacity || 0
    },
    monthsToSell: Number(monthsToSell.toFixed(1)),
    recommendation: marginPercent >= THRESHOLDS.minMarginPercent ? 'Sell' : 'Avoid',
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
    demand: {
      estimatedMonthlySales: { low: monthlySales, mid: monthlySales, high: monthlySales },
      confidence: pricing.confidence || 'Low',
      absorptionCapacity
    },
    monthsToSell: Number(monthsToSell.toFixed(1)),
    recommendation: marginPercent >= THRESHOLDS.minMarginPercent ? 'Sell' : 'Avoid',
    riskFlags: monthsToSell > THRESHOLDS.maxMonthsToSell ? ['High inventory risk'] : []
  };
}

/**
 * Multi-Channel Deal Evaluation
 */
export function evaluateMultiChannel(input, productData, amazonPricing, ebayPricing) {
  const { ean, quantity, buyPrice, currency = 'USD', supplierRegion = 'Unknown' } = input;
  
  // Process all channels
  const allChannels = [];
  
  // Process Amazon channels
  if (amazonPricing) {
    for (const [marketplace, pricing] of Object.entries(amazonPricing)) {
      const channel = processAmazonChannel(marketplace, pricing, productData, buyPrice, currency, quantity);
      if (channel) allChannels.push(channel);
    }
  }
  
  // Process eBay channels
  if (ebayPricing) {
    for (const [marketplace, pricing] of Object.entries(ebayPricing)) {
      const channel = processEbayChannel(marketplace, pricing, buyPrice, currency, quantity);
      if (channel) allChannels.push(channel);
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
  
  const dataReliabilityScore = allChannels.length * 20; // 20 points per channel with data
  
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
  
  // Channel allocation recommendation
  const allocation = {};
  let remainingQty = quantity;
  
  for (const channel of recommendedChannels) {
    if (remainingQty <= 0) break;
    
    const maxAllocation = (channel.demand.absorptionCapacity || 0) * 3; // 3 months of capacity
    const allocated = Math.min(remainingQty, Math.floor(maxAllocation));
    
    if (allocated > 0) {
      const key = `${channel.channel}-${channel.marketplace}`;
      allocation[key] = allocated;
      remainingQty -= allocated;
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
      rationale: remainingQty > 0 
        ? `Hold ${remainingQty} units to avoid flooding markets.`
        : 'Full quantity can be absorbed within 3 months.'
    }
  };
}

export default {
  evaluateMultiChannel,
  THRESHOLDS,
  WEIGHTS
};
