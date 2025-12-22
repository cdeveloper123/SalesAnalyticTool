/**
 * Deal Evaluation Engine (Step 5)
 * 
 * The "Brain" that combines all data to produce:
 * - Deal Quality Score (0-100%)
 * - Decision: Buy / Renegotiate / Source Elsewhere / Pass
 * - Plain-English explanation
 * 
 * Input: Product data, pricing, fees, demand estimates, user offer
 * Output: Complete deal evaluation
 * 
 * Multi-Channel Support: Amazon (US/UK/DE) + eBay (US/UK/DE)
 */

import feeCalculator from './feeCalculator.js';
import demandEstimator from './demandEstimator.js';
import currencyService from './currencyService.js';
import ebayService from './ebayService.js';

// Scoring weights
const WEIGHTS = {
  netMargin: 0.40,        // 40% - Most important
  demandConfidence: 0.25, // 25% - How sure are we about sales?
  volumeRisk: 0.20,       // 20% - Can the market absorb this qty?
  dataReliability: 0.15   // 15% - Quality of our data
};

// Thresholds
const THRESHOLDS = {
  minMarginPercent: 15,       // Minimum acceptable margin
  goodMarginPercent: 30,      // Good margin
  excellentMarginPercent: 50, // Excellent margin
  maxMonthsToSell: 6,         // Max acceptable sell-through time
  dangerMonthsToSell: 12      // Danger zone for inventory
};

/**
 * Calculate Net Margin Score (0-100)
 */
function calculateMarginScore(netProceeds, landedCost) {
  if (landedCost <= 0) return 0;
  
  const marginPercent = ((netProceeds - landedCost) / landedCost) * 100;
  
  if (marginPercent < 0) return 0;
  if (marginPercent < THRESHOLDS.minMarginPercent) return marginPercent * 2; // 0-30
  if (marginPercent < THRESHOLDS.goodMarginPercent) return 30 + ((marginPercent - 15) / 15) * 30; // 30-60
  if (marginPercent < THRESHOLDS.excellentMarginPercent) return 60 + ((marginPercent - 30) / 20) * 25; // 60-85
  return Math.min(100, 85 + ((marginPercent - 50) / 50) * 15); // 85-100
}

/**
 * Calculate Demand Confidence Score (0-100)
 */
function calculateDemandScore(demandData) {
  if (!demandData || demandData.confidence === 'None') return 0;
  
  const baseScore = demandData.confidenceScore || 0;
  
  // Bonus for high volume potential
  if (demandData.estimatedMonthlySales.mid > 200) {
    return Math.min(100, baseScore + 10);
  }
  
  return baseScore;
}

/**
 * Calculate Volume Risk Score (0-100, higher = less risk)
 */
function calculateVolumeRiskScore(quantity, demandData) {
  if (!demandData || demandData.absorptionCapacity <= 0) return 20;
  
  // Calculate months to sell at conservative rate
  const monthsToSell = quantity / demandData.absorptionCapacity;
  
  if (monthsToSell <= 1) return 100;  // Can sell in 1 month - great
  if (monthsToSell <= 3) return 85;   // 1-3 months - good
  if (monthsToSell <= THRESHOLDS.maxMonthsToSell) return 60; // 3-6 months - acceptable
  if (monthsToSell <= THRESHOLDS.dangerMonthsToSell) return 35; // 6-12 months - risky
  return 10; // >12 months - danger
}

/**
 * Calculate Data Reliability Score (0-100)
 */
function calculateDataReliabilityScore(productData, pricingData) {
  let score = 0;
  
  // Product data quality
  if (productData) {
    if (productData.title) score += 15;
    if (productData.category) score += 15;
    if (productData.dimensions?.weightKg) score += 10;
  }
  
  // Pricing data quality
  if (pricingData) {
    const markets = Object.keys(pricingData).length;
    score += markets * 15; // 15 points per market with data
    
    // Bonus for having sales rank
    for (const data of Object.values(pricingData)) {
      if (data.salesRank) score += 5;
    }
  }
  
  return Math.min(100, score);
}

/**
 * Generate decision based on scores
 */
function generateDecision(overallScore, marginPercent, volumeRisk) {
  if (overallScore >= 75 && marginPercent >= THRESHOLDS.minMarginPercent) {
    return 'Buy';
  }
  
  if (overallScore >= 55 && marginPercent >= 10) {
    return 'Renegotiate';
  }
  
  if (overallScore >= 40 && marginPercent > 0) {
    return 'Source Elsewhere';
  }
  
  return 'Pass';
}

/**
 * Generate plain-English explanation
 */
function generateExplanation(analysis) {
  const { scores, decision, bestMarket, worstMarket, monthsToSell, marginPercent } = analysis;
  
  let explanation = '';
  
  // Lead with the decision
  switch (decision) {
    case 'Buy':
      explanation = `Strong opportunity. `;
      break;
    case 'Renegotiate':
      explanation = `Potential opportunity, but needs better terms. `;
      break;
    case 'Source Elsewhere':
      explanation = `Weak deal at current terms. `;
      break;
    case 'Pass':
      explanation = `Not recommended. `;
      break;
  }
  
  // Margin commentary
  if (marginPercent >= THRESHOLDS.goodMarginPercent) {
    explanation += `Margins are healthy at ${marginPercent.toFixed(1)}%. `;
  } else if (marginPercent >= THRESHOLDS.minMarginPercent) {
    explanation += `Margins are acceptable at ${marginPercent.toFixed(1)}%, but leave little room for error. `;
  } else if (marginPercent > 0) {
    explanation += `Margins are thin at ${marginPercent.toFixed(1)}% - high risk of loss after fees. `;
  } else {
    explanation += `Negative margin - would lose money on every sale. `;
  }
  
  // Volume/demand commentary
  if (monthsToSell > THRESHOLDS.dangerMonthsToSell) {
    explanation += `Major concern: ${monthsToSell.toFixed(0)}+ months to sell through this quantity. High overstock risk. `;
  } else if (monthsToSell > THRESHOLDS.maxMonthsToSell) {
    explanation += `Volume risk: would take ${monthsToSell.toFixed(0)} months to sell. Consider reducing quantity. `;
  }
  
  // Best market recommendation
  if (bestMarket) {
    explanation += `Best opportunity in ${bestMarket.marketplace}. `;
  }
  
  // Warnings
  if (worstMarket && worstMarket.recommendation === 'Avoid') {
    explanation += `Avoid ${worstMarket.marketplace} due to low margins. `;
  }
  
  return explanation.trim();
}

/**
 * Calculate target buy price for negotiation
 */
function calculateNegotiationPrices(netProceeds, currentBuyPrice, targetMarginPercent = 25) {
  // Target price to achieve desired margin
  const targetBuyPrice = netProceeds / (1 + targetMarginPercent / 100);
  
  // Walk-away price at minimum acceptable margin
  const walkAwayPrice = netProceeds / (1 + THRESHOLDS.minMarginPercent / 100);
  
  return {
    targetBuyPrice: Number(targetBuyPrice.toFixed(2)),
    walkAwayPrice: Number(walkAwayPrice.toFixed(2)),
    currentBuyPrice: Number(currentBuyPrice.toFixed(2)),
    savings: Number((currentBuyPrice - targetBuyPrice).toFixed(2))
  };
}

/**
 * Calculate allocation recommendation
 */
function calculateAllocation(quantity, demandByMarket) {
  const allocation = {};
  let remaining = quantity;
  const totalAbsorption = Object.values(demandByMarket).reduce(
    (sum, d) => sum + (d.absorptionCapacity || 0), 0
  );
  
  if (totalAbsorption === 0) {
    return {
      suggestedAllocation: {},
      hold: quantity,
      rationale: 'Insufficient demand data to recommend allocation.'
    };
  }
  
  // Sort markets by absorption capacity
  const sortedMarkets = Object.entries(demandByMarket)
    .sort((a, b) => (b[1].absorptionCapacity || 0) - (a[1].absorptionCapacity || 0));
  
  for (const [market, demand] of sortedMarkets) {
    if (remaining <= 0) break;
    
    // Allocate up to 3 months of absorption
    const maxAllocation = (demand.absorptionCapacity || 0) * 3;
    const allocated = Math.min(remaining, maxAllocation);
    
    if (allocated > 0) {
      allocation[market] = allocated;
      remaining -= allocated;
    }
  }
  
  return {
    totalQuantity: quantity,
    suggestedAllocation: allocation,
    hold: remaining,
    rationale: remaining > 0 
      ? `Hold ${remaining} units for phased release to avoid market flooding.`
      : 'Full quantity can be absorbed across markets within 3 months.'
  };
}

/**
 * Main evaluation function
 */
export function evaluateDeal(input, productData, pricingData) {
  const {
    ean,
    quantity,
    buyPrice,
    currency = 'USD',
    supplierRegion = 'Unknown'
  } = input;
  
  // Calculate fees for all markets
  const feesByMarket = {};
  const demandByMarket = {};
  
  for (const [market, pricing] of Object.entries(pricingData || {})) {
    if (pricing && pricing.buyBoxPrice) {
      feesByMarket[market] = feeCalculator.calculateFees(
        market,
        pricing.buyBoxPrice,
        productData?.category?.[market] || productData?.category,
        productData?.dimensions?.weightKg || 0.5
      );
      
      demandByMarket[market] = demandEstimator.estimateDemand(market, pricing);
    }
  }
  
  // Find best market by net margin (in USD for comparison)
  let bestMarket = null;
  let bestMarginUSD = -Infinity;
  let bestNetProceedsUSD = 0;
  
  for (const [market, fees] of Object.entries(feesByMarket)) {
    const marketCurrency = currencyService.getCurrencyForMarketplace(market);
    
    // Convert everything to USD for fair comparison
    const netProceedsUSD = currencyService.toUSD(fees.netProceeds, marketCurrency);
    const buyPriceUSD = currencyService.toUSD(buyPrice, currency);
    const marginUSD = netProceedsUSD - buyPriceUSD;
    
    if (marginUSD > bestMarginUSD) {
      bestMarginUSD = marginUSD;
      bestNetProceedsUSD = netProceedsUSD;
      bestMarket = { marketplace: market, ...fees, marginUSD };
    }
  }
  
  // Calculate landed cost in USD for overall scoring
  const landedCostUSD = currencyService.toUSD(buyPrice, currency);
  
  // Calculate per-unit margin on best market (in USD)
  const marginPerUnit = bestMarginUSD;
  const marginPercent = landedCostUSD > 0 ? (marginPerUnit / landedCostUSD) * 100 : 0;
  
  // Calculate total demand capacity
  const totalAbsorption = Object.values(demandByMarket).reduce(
    (sum, d) => sum + (d.absorptionCapacity || 0), 0
  );
  const monthsToSell = totalAbsorption > 0 ? quantity / totalAbsorption : 999;
  
  // Calculate component scores (using USD-based margin)
  const scores = {
    netMarginScore: calculateMarginScore(bestNetProceedsUSD, landedCostUSD),
    demandConfidenceScore: calculateDemandScore(demandByMarket[bestMarket?.marketplace]),
    volumeRiskScore: calculateVolumeRiskScore(quantity, { absorptionCapacity: totalAbsorption }),
    dataReliabilityScore: calculateDataReliabilityScore(productData, pricingData)
  };
  
  // Calculate overall score
  const overallScore = 
    scores.netMarginScore * WEIGHTS.netMargin +
    scores.demandConfidenceScore * WEIGHTS.demandConfidence +
    scores.volumeRiskScore * WEIGHTS.volumeRisk +
    scores.dataReliabilityScore * WEIGHTS.dataReliability;
  
  // Generate decision
  const decision = generateDecision(overallScore, marginPercent, scores.volumeRiskScore);
  
  // Build market analysis
  const marketAnalysis = [];
  for (const [market, fees] of Object.entries(feesByMarket)) {
    const demand = demandByMarket[market];
    
    // Convert buy price to market's local currency
    const marketCurrency = currencyService.getCurrencyForMarketplace(market);
    const buyPriceInMarketCurrency = currencyService.convert(buyPrice, currency, marketCurrency);
    
    // Calculate margin in local currency
    const marketMargin = fees.netProceeds - buyPriceInMarketCurrency;
    const marketMarginPercent = buyPriceInMarketCurrency > 0 ? (marketMargin / buyPriceInMarketCurrency) * 100 : 0;
    const marketMonths = demand?.absorptionCapacity > 0 
      ? quantity / demand.absorptionCapacity 
      : 999;
    
    marketAnalysis.push({
      marketplace: market,
      recommendation: marketMarginPercent >= THRESHOLDS.minMarginPercent ? 'Sell' : 'Avoid',
      sellPrice: fees.sellPrice,
      currency: fees.currency,
      totalFees: fees.totalFees,
      netProceeds: fees.netProceeds,
      buyPriceConverted: buyPriceInMarketCurrency,
      netMargin: Number(marketMargin.toFixed(2)),
      marginPercent: Number(marketMarginPercent.toFixed(1)),
      monthlySalesEst: demand ? `${demand.estimatedMonthlySales.low}-${demand.estimatedMonthlySales.high}` : 'Unknown',
      monthsToSell: Number(marketMonths.toFixed(1)),
      confidence: demand?.confidence || 'Low',
      riskFlags: demand?.signals?.filter(s => s.includes('risk') || s.includes('caution')) || []
    });
  }
  
  // Sort by margin
  marketAnalysis.sort((a, b) => b.marginPercent - a.marginPercent);
  
  // Find worst market
  const worstMarket = marketAnalysis.find(m => m.recommendation === 'Avoid');
  
  // Generate explanation
  const explanation = generateExplanation({
    scores,
    decision,
    bestMarket: marketAnalysis[0],
    worstMarket,
    monthsToSell,
    marginPercent
  });
  
  // Calculate allocation
  const allocation = calculateAllocation(quantity, demandByMarket);
  
  // Calculate negotiation support
  const negotiationSupport = decision === 'Renegotiate' || decision === 'Source Elsewhere'
    ? calculateNegotiationPrices(bestNetProceedsUSD, landedCostUSD)
    : null;
  
  return {
    ean,
    productTitle: productData?.title || 'Unknown Product',
    input: {
      quantity,
      buyPrice,
      currency,
      supplierRegion
    },
    dealScore: {
      overall: Math.round(overallScore),
      breakdown: {
        netMarginScore: Math.round(scores.netMarginScore),
        demandConfidenceScore: Math.round(scores.demandConfidenceScore),
        volumeRiskScore: Math.round(scores.volumeRiskScore),
        dataReliabilityScore: Math.round(scores.dataReliabilityScore)
      }
    },
    decision,
    explanation,
    marketAnalysis,
    allocationRecommendation: allocation,
    negotiationSupport,
    rawData: {
      feesByMarket,
      demandByMarket
    }
  };
}

// Re-export multi-channel evaluator
export { evaluateMultiChannel } from './multiChannelEvaluator.js';

export default {
  evaluateDeal,
  evaluateMultiChannel,
  WEIGHTS,
  THRESHOLDS
};
