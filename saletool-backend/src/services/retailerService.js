/**
 * Retailer Service - Mocked Retail Channel Data
 * 
 * Provides pricing and demand estimates for non-Amazon retailers.
 * Currently mocked - designed to be replaced with live API integrations.
 * 
 * Supported Retailers:
 * - Walmart (US)
 * - Target (US)
 */

// ============================================================================
// RETAILER CONFIGURATIONS
// ============================================================================

const RETAILERS = {
  walmart: {
    name: 'Walmart',
    marketplace: 'US',
    currency: 'USD',
    type: 'Mass Retail',
    commissionPercent: 15,
    fixedFee: 0,
    paymentFeePercent: 4.3,
    requirements: {
      vendorAccount: true,
      minimumOrder: null,
      slottingFee: null
    },
    // Price multiplier relative to Amazon (Walmart typically 5-10% lower)
    priceMultiplier: 0.93
  },
  target: {
    name: 'Target',
    marketplace: 'US',
    currency: 'USD',
    type: 'Mass Retail',
    commissionPercent: 15,
    fixedFee: 0,
    paymentFeePercent: 2.9,
    requirements: {
      vendorAccount: true,
      minimumOrder: null,
      slottingFee: null
    },
    // Price multiplier relative to Amazon (Target typically 3-5% lower)
    priceMultiplier: 0.96
  }
};

// ============================================================================
// CATEGORY PRICE ADJUSTMENTS
// ============================================================================

const CATEGORY_ADJUSTMENTS = {
  'Video Games': { priceAdjust: 1.0, demandMultiplier: 0.3 },
  'Electronics': { priceAdjust: 0.98, demandMultiplier: 0.4 },
  'Toys': { priceAdjust: 1.02, demandMultiplier: 0.5 },
  'Home': { priceAdjust: 0.95, demandMultiplier: 0.35 },
  'default': { priceAdjust: 1.0, demandMultiplier: 0.3 }
};

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Get retailer pricing for a product
 * @param {Object} productData - Product information
 * @param {number} amazonPrice - Amazon reference price
 * @param {string} category - Product category
 * @returns {Array} Retailer channel data
 */
export function getRetailerPricing(productData, amazonPrice, category = 'default') {
  const channels = [];
  const categoryAdjust = CATEGORY_ADJUSTMENTS[category] || CATEGORY_ADJUSTMENTS.default;

  for (const [retailerId, retailer] of Object.entries(RETAILERS)) {
    // Calculate estimated sell price based on Amazon price
    const basePrice = amazonPrice * retailer.priceMultiplier * categoryAdjust.priceAdjust;
    const sellPrice = Number(basePrice.toFixed(2));

    // Calculate fees
    const commissionFee = sellPrice * (retailer.commissionPercent / 100);
    const paymentFee = sellPrice * (retailer.paymentFeePercent / 100);
    const totalFees = commissionFee + paymentFee + retailer.fixedFee;

    // Calculate net proceeds
    const netProceeds = sellPrice - totalFees;

    // Estimate demand (mocked - lower than Amazon typically)
    const baseDemand = 100; // Assume 100 units/month base
    const estimatedMonthlySales = Math.round(baseDemand * categoryAdjust.demandMultiplier);

    channels.push({
      channel: 'Retailer',
      retailer: retailer.name,
      marketplace: retailer.marketplace,
      sellPrice,
      currency: retailer.currency,
      fees: {
        total: Number(totalFees.toFixed(2)),
        breakdown: {
          commission: Number(commissionFee.toFixed(2)),
          commissionRate: retailer.commissionPercent / 100, // As decimal (0-1)
          paymentFee: Number(paymentFee.toFixed(2)),
          paymentFeeRate: retailer.paymentFeePercent / 100, // As decimal (0-1)
          fixedFee: retailer.fixedFee
        }
      },
      netProceeds: Number(netProceeds.toFixed(2)),
      demand: {
        estimatedMonthlySales: {
          low: Math.round(estimatedMonthlySales * 0.5),
          mid: estimatedMonthlySales,
          high: Math.round(estimatedMonthlySales * 1.5)
        },
        confidence: 'Low',
        source: 'Mocked estimate'
      },
      requirements: retailer.requirements,
      notes: `${retailer.name} typically prices ${Math.round((1 - retailer.priceMultiplier) * 100)}% below Amazon`
    });
  }

  return channels;
}

/**
 * Calculate margin for retailer channel
 * @param {Object} channel - Retailer channel data
 * @param {number} landedCost - Landed cost per unit
 * @returns {Object} Channel with margin calculations
 */
export function calculateRetailerMargin(channel, landedCost) {
  const netMargin = channel.netProceeds - landedCost;
  const marginPercent = landedCost > 0 ? (netMargin / landedCost) * 100 : 0;

  return {
    ...channel,
    landedCostConverted: landedCost,
    netMargin: Number(netMargin.toFixed(2)),
    marginPercent: Number(marginPercent.toFixed(1)),
    recommendation: marginPercent >= 15 ? 'Sell' : 'Avoid'
  };
}

export default {
  getRetailerPricing,
  calculateRetailerMargin,
  RETAILERS
};
