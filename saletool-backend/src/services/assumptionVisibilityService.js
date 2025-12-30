/**
 * Assumption Visibility Service
 * 
 * Extracts and returns all assumptions used in calculations
 * Tracks assumption versions and changes
 */

const ASSUMPTION_VERSION = '1.0.0';
const ASSUMPTION_SET_DATE = '2025-01-01';

/**
 * Get assumption version information
 */
export function getAssumptionVersion() {
  return {
    version: ASSUMPTION_VERSION,
    setDate: ASSUMPTION_SET_DATE,
    description: 'Default assumption set for 2025'
  };
}

/**
 * Extract all assumptions used in a calculation result
 * 
 * @param {object} calculationResult - Result from multiChannelEvaluator
 * @param {object} overrides - Assumption overrides that were applied
 * @param {object} input - Original input parameters
 * @returns {object} - Complete assumptions breakdown
 */
export function getAllAssumptionsUsed(calculationResult, overrides = null, input = null) {
  const assumptions = {
    version: getAssumptionVersion(),
    timestamp: new Date().toISOString(),
    input: input || {},
    shipping: {},
    duty: {},
    fees: {},
    currency: {},
    overrides: overrides || {}
  };

  // Extract shipping assumptions from channel analysis
  if (calculationResult.channelAnalysis) {
    const channels = Array.isArray(calculationResult.channelAnalysis) 
      ? calculationResult.channelAnalysis 
      : Object.values(calculationResult.channelAnalysis);

    channels.forEach(channel => {
      const marketplace = channel.marketplace || channel.market;
      if (marketplace && channel.landedCost) {
        assumptions.shipping[marketplace] = {
          origin: input?.supplierRegion || 'CN',
          destination: marketplace,
          method: channel.landedCost.shipping?.method || 'air',
          ratePerKg: channel.landedCost.shipping?.ratePerKg,
          transitDays: channel.landedCost.shipping?.transitDays,
          minCharge: channel.landedCost.shipping?.minCharge,
          isOverridden: channel.landedCost.shipping?.isOverridden || false
        };

        // Duty assumptions
        assumptions.duty[marketplace] = {
          origin: input?.supplierRegion || 'CN',
          destination: marketplace,
          category: channel.landedCost.duty?.category || input?.category,
          hsCode: channel.landedCost.duty?.hsCode,
          rate: channel.landedCost.duty?.dutyRate,
          ratePercent: channel.landedCost.duty?.dutyPercent,
          calculationMethod: channel.landedCost.duty?.calculationMethod || 'category',
          isOverridden: channel.landedCost.duty?.isOverridden || false
        };
      }

      // Fee assumptions
      if (marketplace && channel.fees) {
        assumptions.fees[marketplace] = {
          marketplace,
          sellPrice: channel.sellPrice,
          category: input?.category || 'default',
          referralRate: channel.fees.breakdown?.referralRate || 0,
          referralFee: channel.fees.breakdown?.referralFee || 0,
          fbaFee: channel.fees.breakdown?.fbaFee || 0,
          closingFee: channel.fees.breakdown?.closingFee || 0,
          vatRate: channel.fees.breakdown?.vatRate || 0,
          vatAmount: channel.fees.breakdown?.vat || 0,
          feeScheduleVersion: channel.fees.feeScheduleVersion || '2025-01',
          isOverridden: channel.fees.isOverridden || false
        };
      }
    });
  }

  // Extract currency assumptions
  if (input?.currency) {
    assumptions.currency = {
      buyPriceCurrency: input.currency,
      fxRates: {
        // In a full implementation, this would include actual FX rates used
        timestamp: new Date().toISOString(),
        source: 'default'
      }
    };
  }

  return assumptions;
}

/**
 * Track assumption change in history
 * 
 * @param {string} dealId - Deal ID (optional)
 * @param {string} assumptionType - Type of assumption ('shipping', 'duty', 'fee')
 * @param {object} oldValue - Previous assumption value
 * @param {object} newValue - New assumption value
 * @param {string} changedBy - User ID or identifier (optional)
 * @returns {object} - History entry
 */
export function trackAssumptionChange(dealId, assumptionType, oldValue, newValue, changedBy = null) {
  return {
    dealId: dealId || null,
    assumptionType,
    oldValue,
    newValue,
    changedBy: changedBy || 'system',
    timestamp: new Date().toISOString()
  };
}

/**
 * Format assumptions for API response
 * 
 * @param {object} assumptions - Raw assumptions object
 * @returns {object} - Formatted assumptions for display
 */
export function formatAssumptionsForDisplay(assumptions) {
  const formatted = {
    version: assumptions.version,
    timestamp: assumptions.timestamp,
    summary: {
      shippingRoutes: Object.keys(assumptions.shipping || {}).length,
      dutyRoutes: Object.keys(assumptions.duty || {}).length,
      feeMarketplaces: Object.keys(assumptions.fees || {}).length,
      hasOverrides: Object.keys(assumptions.overrides || {}).length > 0
    },
    details: {
      shipping: assumptions.shipping,
      duty: assumptions.duty,
      fees: assumptions.fees,
      currency: assumptions.currency
    },
    overrides: assumptions.overrides
  };

  return formatted;
}

export default {
  getAssumptionVersion,
  getAllAssumptionsUsed,
  trackAssumptionChange,
  formatAssumptionsForDisplay
};

