/**
 * Distributor Service - Mocked Wholesale/Distributor Channel Data
 * 
 * Provides pricing and volume estimates for B2B distributor channels.
 * Currently mocked - designed to be replaced with live API integrations.
 * 
 * Note: In distributor channels, YOU are the SELLER and the distributor is the BUYER.
 * Distributors pay wholesale prices (40-60% of retail) and resell to retailers.
 * 
 * Supported Distributors:
 * - Ingram Micro (Global - Electronics/Gaming)
 * - Alliance Entertainment (US - Gaming/Media)
 */

// ============================================================================
// DISTRIBUTOR CONFIGURATIONS
// ============================================================================

const DISTRIBUTORS = {
  ingramMicro: {
    name: 'Ingram Micro',
    region: 'US',
    currency: 'USD',
    type: 'Tech Distribution',
    description: 'Largest IT/Electronics distributor globally',
    // Distributors pay ~50-60% of retail price
    buyPricePercent: 0.55,
    minimumOrder: 500,
    typicalOrder: 2000,
    monthlyCapacity: 10000,
    paymentTerms: 'Net 30',
    returnPolicy: '5% allowance',
    categories: ['Electronics', 'Video Games', 'Computers']
  },
  allianceEntertainment: {
    name: 'Alliance Entertainment',
    region: 'US',
    currency: 'USD',
    type: 'Entertainment Distribution',
    description: 'Major US distributor for games, media, and entertainment',
    // Entertainment distributors pay slightly higher margins
    buyPricePercent: 0.58,
    minimumOrder: 1000,
    typicalOrder: 5000,
    monthlyCapacity: 20000,
    paymentTerms: 'Net 45',
    returnPolicy: '3% allowance',
    categories: ['Video Games', 'Toys', 'Media']
  }
};

// ============================================================================
// CATEGORY ADJUSTMENTS FOR DISTRIBUTORS
// ============================================================================

const CATEGORY_ADJUSTMENTS = {
  'Video Games': { priceAdjust: 1.0, demandMultiplier: 1.0 },
  'Electronics': { priceAdjust: 0.95, demandMultiplier: 0.8 },
  'Toys': { priceAdjust: 1.05, demandMultiplier: 1.2 },
  'Media': { priceAdjust: 0.90, demandMultiplier: 0.6 },
  'default': { priceAdjust: 1.0, demandMultiplier: 0.5 }
};

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Get distributor pricing for a product
 * 
 * In distributor channels:
 * - sellPrice = what the distributor will pay YOU
 * - This is typically 50-60% of retail price
 * - Lower than your buy price = loss (avoid selling to distributors)
 * 
 * @param {Object} productData - Product information
 * @param {number} retailPrice - Retail reference price (Amazon price)
 * @param {string} category - Product category
 * @returns {Array} Distributor channel data
 */
export function getDistributorPricing(productData, retailPrice, category = 'default') {
  const channels = [];
  const categoryAdjust = CATEGORY_ADJUSTMENTS[category] || CATEGORY_ADJUSTMENTS.default;
  
  for (const [distributorId, distributor] of Object.entries(DISTRIBUTORS)) {
    // Skip if category doesn't match
    if (!distributor.categories.includes(category) && category !== 'default') {
      continue;
    }
    
    // Calculate what distributor would pay (wholesale price)
    const wholesalePrice = retailPrice * distributor.buyPricePercent * categoryAdjust.priceAdjust;
    const sellPrice = Number(wholesalePrice.toFixed(2));
    
    // No fees when selling to distributor (they pay you directly)
    const netProceeds = sellPrice;
    
    // Estimate monthly volume they could absorb
    const baseVolume = distributor.monthlyCapacity;
    const adjustedVolume = Math.round(baseVolume * categoryAdjust.demandMultiplier);
    
    channels.push({
      channel: 'Distributor',
      distributor: distributor.name,
      marketplace: distributor.region,
      // In distributor model, sellPrice = what they pay you (wholesale)
      sellPrice,
      currency: distributor.currency,
      fees: {
        total: 0,
        breakdown: {
          note: 'No platform fees - direct B2B sale'
        }
      },
      netProceeds,
      demand: {
        estimatedMonthlySales: {
          low: Math.round(adjustedVolume * 0.3),
          mid: Math.round(adjustedVolume * 0.5),
          high: adjustedVolume
        },
        confidence: 'Medium',
        source: 'Distributor capacity estimate'
      },
      volume: {
        minimumOrder: distributor.minimumOrder,
        typicalOrder: distributor.typicalOrder,
        monthlyCapacity: adjustedVolume
      },
      terms: {
        paymentTerms: distributor.paymentTerms,
        returnPolicy: distributor.returnPolicy
      },
      notes: `${distributor.name} pays ~${Math.round(distributor.buyPricePercent * 100)}% of retail. ${distributor.description}`
    });
  }
  
  return channels;
}

/**
 * Calculate margin for distributor channel
 * @param {Object} channel - Distributor channel data
 * @param {number} landedCost - Your landed cost per unit
 * @returns {Object} Channel with margin calculations
 */
export function calculateDistributorMargin(channel, landedCost) {
  // For distributors: margin = what they pay you - your cost
  const netMargin = channel.netProceeds - landedCost;
  const marginPercent = landedCost > 0 ? (netMargin / landedCost) * 100 : 0;
  
  // Distributors are usually avoid unless you have very low costs
  let recommendation = 'Avoid';
  if (marginPercent >= 10) {
    recommendation = 'Consider';
  }
  if (marginPercent >= 20) {
    recommendation = 'Sell';
  }
  
  return {
    ...channel,
    landedCostConverted: landedCost,
    netMargin: Number(netMargin.toFixed(2)),
    marginPercent: Number(marginPercent.toFixed(1)),
    recommendation,
    riskFlags: marginPercent < 0 ? ['Selling at loss'] : []
  };
}

export default {
  getDistributorPricing,
  calculateDistributorMargin,
  DISTRIBUTORS
};
