/**
 * Assumption Visibility Service
 * 
 * Extracts and returns all assumptions used in calculations
 * Tracks assumption versions and changes
 */

import { getPrisma } from '../config/database.js';
import { getDataSourceMetadata } from './dataSourceMetadata.js';

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
 * @param {object} metadata - Additional metadata (marketData, analyzedAt, etc.)
 * @returns {object} - Complete assumptions breakdown
 */
export function getAllAssumptionsUsed(calculationResult, overrides = null, input = null, metadata = null) {
  const analysisTimestamp = metadata?.analyzedAt 
    ? (metadata.analyzedAt instanceof Date ? metadata.analyzedAt.toISOString() : metadata.analyzedAt)
    : new Date().toISOString();

  const assumptions = {
    version: getAssumptionVersion(),
    timestamp: analysisTimestamp,
    input: input || {},
    shipping: {},
    duty: {},
    fees: {},
    currency: {},
    overrides: overrides || {},
    dataFreshness: {},
    sourceConfidence: {},
    methodology: {}
  };

  // Extract shipping assumptions from channel analysis
  if (calculationResult.channelAnalysis) {
    const channels = Array.isArray(calculationResult.channelAnalysis) 
      ? calculationResult.channelAnalysis 
      : Object.values(calculationResult.channelAnalysis);

    channels.forEach(channel => {
      const marketplace = channel.marketplace || channel.market;
      const channelName = channel.channel || 'Amazon';
      
      if (marketplace && channel.landedCost) {
        // Shipping assumptions with metadata
        const shippingMethod = channel.landedCost.shipping?.method || 'air';
        const isShippingOverridden = channel.landedCost.shipping?.isOverridden || false;
        
        assumptions.shipping[marketplace] = {
          origin: input?.supplierRegion || 'CN',
          destination: marketplace,
          method: shippingMethod,
          ratePerKg: channel.landedCost.shipping?.ratePerKg,
          transitDays: channel.landedCost.shipping?.transitDays,
          minCharge: channel.landedCost.shipping?.minCharge,
          isOverridden: isShippingOverridden
        };

        // Shipping data freshness
        const shippingMetadata = getDataSourceMetadata('shippingRates');
        assumptions.dataFreshness[`shipping_${marketplace}`] = {
          source: isShippingOverridden ? 'user_override' : 'default_calculator',
          timestamp: analysisTimestamp, // When calculation was performed
          age: 'calculated_at_analysis',
          dataSourceLastUpdated: isShippingOverridden ? undefined : shippingMetadata?.lastUpdated, // When shipping rates table was last updated
          dataSourceVersion: isShippingOverridden ? undefined : shippingMetadata?.version
        };

        // Shipping source confidence
        assumptions.sourceConfidence[`shipping_${marketplace}`] = {
          level: isShippingOverridden ? 'high' : 'medium',
          reason: isShippingOverridden 
            ? 'User-provided override value' 
            : 'Calculated using default shipping calculator based on route and method'
        };

        // Shipping methodology
        assumptions.methodology[`shipping_${marketplace}`] = {
          calculation: isShippingOverridden
            ? 'Manual override provided by user'
            : `Default ${shippingMethod} shipping rates applied based on origin (${input?.supplierRegion || 'CN'}) to ${marketplace}. Rate per kg and transit days from standard shipping calculator.`,
          rule: isShippingOverridden ? 'user_override' : 'default_calculator'
        };

        // Duty assumptions
        // Duty info is stored at top level of landedCost, not under duty property
        const dutyCalculationMethod = channel.landedCost.calculationMethod || channel.landedCost.duty?.calculationMethod || 'category';
        const isDutyOverridden = channel.landedCost.isOverridden || channel.landedCost.duty?.isOverridden || false;
        const dutyRate = channel.landedCost.dutyRate || channel.landedCost.duty?.dutyRate;
        const dutyPercent = channel.landedCost.dutyPercent ? `${channel.landedCost.dutyPercent}%` : (channel.landedCost.duty?.dutyPercent || '0%');
        
        assumptions.duty[marketplace] = {
          origin: input?.supplierRegion || 'CN',
          destination: marketplace,
          category: channel.landedCost.category || channel.landedCost.duty?.category || input?.category,
          hsCode: channel.landedCost.hsCode || channel.landedCost.duty?.hsCode,
          rate: dutyRate,
          ratePercent: dutyPercent,
          calculationMethod: dutyCalculationMethod,
          isOverridden: isDutyOverridden
        };

        // Duty data freshness
        const dutyMetadata = dutyCalculationMethod === 'hs_code' 
          ? getDataSourceMetadata('tariffLookup')
          : getDataSourceMetadata('dutyRates');
        const hsCodeMappingMetadata = dutyCalculationMethod === 'hs_code' 
          ? getDataSourceMetadata('hsCodeMapping')
          : null;
        
        assumptions.dataFreshness[`duty_${marketplace}`] = {
          source: isDutyOverridden ? 'user_override' : (dutyCalculationMethod === 'hs_code' ? 'hs_code_lookup' : 'category_based'),
          timestamp: analysisTimestamp, // When calculation was performed
          age: 'calculated_at_analysis',
          dataSourceLastUpdated: isDutyOverridden ? undefined : dutyMetadata?.lastUpdated, // When duty/tariff data was last updated
          dataSourceVersion: isDutyOverridden ? undefined : dutyMetadata?.version,
          hsCodeMappingLastUpdated: isDutyOverridden ? undefined : hsCodeMappingMetadata?.lastUpdated // When HS code mapping was last updated
        };

        // Duty source confidence
        assumptions.sourceConfidence[`duty_${marketplace}`] = {
          level: isDutyOverridden ? 'high' : (dutyCalculationMethod === 'hs_code' ? 'high' : 'medium'),
          reason: isDutyOverridden
            ? 'User-provided override value'
            : dutyCalculationMethod === 'hs_code'
            ? 'HS code-based duty rate lookup'
            : 'Category-based duty rate estimation'
        };

        // Duty methodology
        const dutyHsCode = channel.landedCost.hsCode || channel.landedCost.duty?.hsCode;
        const dutyCategory = channel.landedCost.category || channel.landedCost.duty?.category || input?.category || 'default';
        const dutyPercentValue = channel.landedCost.dutyPercent || channel.landedCost.duty?.dutyPercent || 0;
        
        assumptions.methodology[`duty_${marketplace}`] = {
          calculation: isDutyOverridden
            ? 'Manual duty rate override provided by user'
            : dutyCalculationMethod === 'hs_code'
            ? `HS code ${dutyHsCode || 'N/A'} used to lookup duty rate for ${marketplace}. Rate: ${dutyPercentValue}%`
            : `Category-based duty calculation for ${dutyCategory} category in ${marketplace}. Rate: ${dutyPercentValue}%`,
          rule: isDutyOverridden ? 'user_override' : dutyCalculationMethod
        };
      }

      // Fee assumptions
      if (marketplace && channel.fees) {
        const isFeeOverridden = channel.fees.isOverridden || false;
        const sellPriceSource = channel.pricingSource || 'api';
        const sellPriceConfidence = channel.confidence || 'Medium';
        
        assumptions.fees[marketplace] = {
          marketplace,
          sellPrice: channel.sellPrice,
          sellPriceSource: sellPriceSource,
          category: input?.category || 'default',
          referralRate: channel.fees.breakdown?.referralRate || 0,
          referralFee: channel.fees.breakdown?.referralFee || 0,
          fbaFee: channel.fees.breakdown?.fbaFee || 0,
          closingFee: channel.fees.breakdown?.closingFee || 0,
          vatRate: channel.fees.breakdown?.vatRate || 0,
          vatAmount: channel.fees.breakdown?.vat || 0,
          feeScheduleVersion: channel.fees.feeScheduleVersion || '2025-01',
          isOverridden: isFeeOverridden
        };

        // Fee data freshness
        const feeScheduleMetadata = getDataSourceMetadata('feeSchedule');
        assumptions.dataFreshness[`fees_${marketplace}`] = {
          source: sellPriceSource,
          timestamp: analysisTimestamp, // When calculation was performed
          age: 'calculated_at_analysis',
          feeScheduleVersion: channel.fees.feeScheduleVersion || '2025-01',
          feeScheduleLastUpdated: isFeeOverridden ? undefined : feeScheduleMetadata?.lastUpdated, // When fee schedule was last updated
          dataSourceVersion: isFeeOverridden ? undefined : feeScheduleMetadata?.version
        };

        // Fee source confidence
        assumptions.sourceConfidence[`fees_${marketplace}`] = {
          level: sellPriceConfidence.toLowerCase(),
          reason: isFeeOverridden
            ? 'User-provided fee overrides'
            : `Sell price from ${sellPriceSource === 'api' ? channelName + ' API' : sellPriceSource}. Fee schedule version ${channel.fees.feeScheduleVersion || '2025-01'} applied.`,
          sellPriceConfidence: sellPriceConfidence
        };

        // Fee methodology
        const vatTreatment = channel.fees.breakdown?.vatRate > 0 
          ? `VAT-inclusive pricing. VAT rate: ${channel.fees.breakdown?.vatRate}% (${marketplace} standard rate).`
          : 'VAT-exclusive pricing or no VAT applicable.';
        
        assumptions.methodology[`fees_${marketplace}`] = {
          calculation: isFeeOverridden
            ? 'Manual fee overrides provided by user'
            : `${channelName} fee structure applied: Referral fee ${(channel.fees.breakdown?.referralRate || 0) * 100}%, FBA fee ${channel.fees.breakdown?.fbaFee || 0} ${channel.currency || 'USD'}, Closing fee ${channel.fees.breakdown?.closingFee || 0} ${channel.currency || 'USD'}. ${vatTreatment}`,
          rule: isFeeOverridden ? 'user_override' : 'fee_schedule',
          feeScheduleVersion: channel.fees.feeScheduleVersion || '2025-01',
          vatTreatment: vatTreatment
        };
      }
    });
  }

  // Extract currency assumptions with metadata
  if (input?.currency) {
    const currencyCacheStatus = metadata?.currencyCacheStatus || {
      hasCache: false,
      lastUpdated: null,
      cacheAge: null,
      isExpired: true
    };
    
    assumptions.currency = {
      buyPriceCurrency: input.currency,
      fxRates: {
        timestamp: currencyCacheStatus.lastUpdated || analysisTimestamp,
        source: currencyCacheStatus.hasCache ? 'live_api_cached' : 'fallback',
        cacheAge: currencyCacheStatus.cacheAge,
        isExpired: currencyCacheStatus.isExpired
      }
    };

    // Currency data freshness
    assumptions.dataFreshness.currency = {
      source: currencyCacheStatus.hasCache ? 'freecurrencyapi.com' : 'fallback_rates',
      timestamp: currencyCacheStatus.lastUpdated || analysisTimestamp,
      age: currencyCacheStatus.cacheAge || 'unknown',
      isExpired: currencyCacheStatus.isExpired
    };

    // Currency source confidence
    assumptions.sourceConfidence.currency = {
      level: currencyCacheStatus.hasCache && !currencyCacheStatus.isExpired ? 'high' : 'medium',
      reason: currencyCacheStatus.hasCache && !currencyCacheStatus.isExpired
        ? 'Live exchange rates from freecurrencyapi.com (cached)'
        : currencyCacheStatus.hasCache
        ? 'Cached exchange rates (may be expired)'
        : 'Fallback exchange rates used'
    };

    // Currency methodology - dynamic based on actual source
    const isUsingFallback = !currencyCacheStatus.hasCache || 
                           (currencyCacheStatus.isExpired && !currencyCacheStatus.lastUpdated);
    const isExpiredButHasCache = currencyCacheStatus.hasCache && currencyCacheStatus.isExpired;
    
    let calculationMessage;
    if (isUsingFallback) {
      calculationMessage = `Fallback exchange rates used (hardcoded values). Base currency: USD. Rates converted using: ${input.currency} to USD, then to target marketplace currency.`;
    } else if (isExpiredButHasCache) {
      calculationMessage = `Exchange rates from freecurrencyapi.com (cache expired, refreshing in background). Base currency: USD. Rates converted using: ${input.currency} to USD, then to target marketplace currency.`;
    } else {
      calculationMessage = `Exchange rates fetched from freecurrencyapi.com. Base currency: USD. Rates converted using: ${input.currency} to USD, then to target marketplace currency.`;
    }
    
    assumptions.methodology.currency = {
      calculation: calculationMessage,
      rule: 'live_api_with_fallback',
      cacheStatus: currencyCacheStatus
    };
  }

  return assumptions;
}

/**
 * Track assumption change in history and persist to database
 * 
 * @param {string} dealId - Deal ID (optional)
 * @param {string} assumptionType - Type of assumption ('shipping', 'duty', 'fee')
 * @param {object} oldValue - Previous assumption value
 * @param {object} newValue - New assumption value
 * @param {string} changedBy - User ID or identifier (optional)
 * @returns {object} - History entry (persisted to database)
 */
export async function trackAssumptionChange(dealId, assumptionType, oldValue, newValue, changedBy = null) {
  const historyEntry = {
    dealId: dealId || null,
    assumptionType,
    oldValue: oldValue || null,
    newValue: newValue || null,
    changedBy: changedBy || 'user'
  };

  // Persist to database
  try {
    const prisma = getPrisma();
    if (prisma && prisma.assumptionHistory) {
      const saved = await prisma.assumptionHistory.create({
        data: historyEntry
      });
      return {
        ...saved,
        timestamp: saved.createdAt.toISOString()
      };
    }
  } catch (error) {
    console.error('[AssumptionVisibility] Error persisting history:', error.message);
  }

  // Return in-memory object as fallback
  return {
    ...historyEntry,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get assumption change history for a deal
 * 
 * @param {string} dealId - Deal ID
 * @param {number} limit - Maximum number of entries to return (default 50)
 * @returns {array} - Array of history entries
 */
export async function getAssumptionHistory(dealId, limit = 50) {
  try {
    const prisma = getPrisma();
    if (!prisma || !prisma.assumptionHistory) {
      return [];
    }

    const history = await prisma.assumptionHistory.findMany({
      where: { dealId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return history.map(h => ({
      id: h.id,
      dealId: h.dealId,
      assumptionType: h.assumptionType,
      oldValue: h.oldValue,
      newValue: h.newValue,
      changedBy: h.changedBy,
      timestamp: h.createdAt.toISOString()
    }));
  } catch (error) {
    console.error('[AssumptionVisibility] Error getting history:', error.message);
    return [];
  }
}

/**
 * Compare two override objects and detect if there are actual changes
 * 
 * @param {object} oldValue - Previous override value
 * @param {object} newValue - New override value
 * @returns {boolean} - True if values are different
 */
export function hasOverrideChanged(oldValue, newValue) {
  // Handle null/undefined cases
  if (!oldValue && !newValue) return false;
  if (!oldValue || !newValue) return true;
  
  // Deep comparison using JSON stringify
  return JSON.stringify(oldValue) !== JSON.stringify(newValue);
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
    overrides: assumptions.overrides,
    // Include enhanced metadata
    dataFreshness: assumptions.dataFreshness || {},
    sourceConfidence: assumptions.sourceConfidence || {},
    methodology: assumptions.methodology || {}
  };

  return formatted;
}

export default {
  getAssumptionVersion,
  getAllAssumptionsUsed,
  trackAssumptionChange,
  getAssumptionHistory,
  hasOverrideChanged,
  formatAssumptionsForDisplay
};

