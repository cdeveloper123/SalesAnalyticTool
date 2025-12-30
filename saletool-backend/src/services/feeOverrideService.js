/**
 * Fee Override Service
 * 
 * Handles manual overrides for marketplace fees including:
 * - Referral fee rate override
 * - FBA fee override
 * - Closing fee override
 * - Payment processing fee override
 * - Custom fee structure per marketplace
 * - Fee schedule versioning
 */

const FEE_SCHEDULE_VERSION = '2025-01'; // Current fee schedule version

/**
 * Validate fee override structure
 */
export function validateFeeOverride(override) {
  if (!override || typeof override !== 'object') {
    return { valid: false, error: 'Override must be an object' };
  }

  const { marketplace, referralRate, fbaFee, closingFee, paymentFee, feeScheduleVersion } = override;

  // Validate marketplace
  if (marketplace && typeof marketplace !== 'string') {
    return { valid: false, error: 'Marketplace must be a string' };
  }

  // Validate referral rate (0-1 for percentage)
  if (referralRate !== undefined) {
    if (typeof referralRate !== 'number' || referralRate < 0 || referralRate > 1) {
      return { valid: false, error: 'Referral rate must be a number between 0 and 1 (e.g., 0.15 for 15%)' };
    }
  }

  // Validate FBA fee
  if (fbaFee !== undefined) {
    if (typeof fbaFee !== 'number' || fbaFee < 0) {
      return { valid: false, error: 'FBA fee must be a non-negative number' };
    }
  }

  // Validate closing fee
  if (closingFee !== undefined) {
    if (typeof closingFee !== 'number' || closingFee < 0) {
      return { valid: false, error: 'Closing fee must be a non-negative number' };
    }
  }

  // Validate payment processing fee
  if (paymentFee !== undefined) {
    if (typeof paymentFee !== 'number' || paymentFee < 0 || paymentFee > 1) {
      return { valid: false, error: 'Payment processing fee must be a number between 0 and 1' };
    }
  }

  // Validate fee schedule version
  if (feeScheduleVersion && typeof feeScheduleVersion !== 'string') {
    return { valid: false, error: 'Fee schedule version must be a string' };
  }

  return { valid: true };
}

/**
 * Get fee override for a marketplace
 * 
 * @param {string} marketplace - Marketplace code (US, UK, DE, etc.)
 * @param {object} overrides - Override object or array of overrides
 * @returns {object|null} - Override data for this marketplace, or null if no override
 */
export function getFeeOverrideForMarketplace(marketplace, overrides) {
  if (!overrides) return null;

  // Handle array of overrides
  const overrideArray = Array.isArray(overrides) ? overrides : [overrides];

  // Find matching override for this marketplace
  const matchingOverride = overrideArray.find(override => {
    const overrideMarketplace = override.marketplace?.toUpperCase();
    const routeMarketplace = marketplace?.toUpperCase();
    return overrideMarketplace === routeMarketplace;
  });

  if (!matchingOverride) return null;

  // Validate the override
  const validation = validateFeeOverride(matchingOverride);
  if (!validation.valid) {
    console.warn(`Invalid fee override: ${validation.error}`);
    return null;
  }

  return {
    isOverridden: true,
    marketplace: marketplace.toUpperCase(),
    referralRate: matchingOverride.referralRate,
    fbaFee: matchingOverride.fbaFee,
    closingFee: matchingOverride.closingFee,
    paymentFee: matchingOverride.paymentFee,
    feeScheduleVersion: matchingOverride.feeScheduleVersion || FEE_SCHEDULE_VERSION
  };
}

/**
 * Get fee schedule version
 * 
 * @param {string} marketplace - Marketplace code
 * @param {object} overrides - Override object or array
 * @returns {string} - Fee schedule version
 */
export function getFeeScheduleVersion(marketplace, overrides) {
  const override = getFeeOverrideForMarketplace(marketplace, overrides);
  if (override && override.feeScheduleVersion) {
    return override.feeScheduleVersion;
  }
  return FEE_SCHEDULE_VERSION;
}

/**
 * Apply fee overrides to a calculation result
 * 
 * @param {string} marketplace - Marketplace code
 * @param {number} sellPrice - Sell price
 * @param {string} category - Product category
 * @param {object} defaultFeeResult - Default fee calculation result
 * @param {object} overrides - Override object or array
 * @returns {object} - Fee calculation result with overrides applied
 */
export function applyFeeOverrides(marketplace, sellPrice, category, defaultFeeResult, overrides) {
  if (!overrides) {
    return {
      ...defaultFeeResult,
      feeScheduleVersion: FEE_SCHEDULE_VERSION
    };
  }

  const override = getFeeOverrideForMarketplace(marketplace, overrides);

  if (!override) {
    return {
      ...defaultFeeResult,
      feeScheduleVersion: FEE_SCHEDULE_VERSION
    };
  }

  // Calculate fees with overrides
  const referralRate = override.referralRate !== undefined 
    ? override.referralRate 
    : (defaultFeeResult.breakdown?.referralRate || 0) / 100;
  
  const referralFee = sellPrice * referralRate;

  const fbaFee = override.fbaFee !== undefined 
    ? override.fbaFee 
    : (defaultFeeResult.breakdown?.fbaFee || 0);

  const closingFee = override.closingFee !== undefined 
    ? override.closingFee 
    : (defaultFeeResult.breakdown?.closingFee || 0);

  // Payment processing fee (if provided)
  const paymentFeeRate = override.paymentFee !== undefined ? override.paymentFee : 0;
  const paymentFee = sellPrice * paymentFeeRate;

  // Total fees
  const totalFees = referralFee + fbaFee + closingFee + paymentFee;

  // VAT calculation (keep from default if not overridden)
  const vatAmount = defaultFeeResult.breakdown?.vat || 0;
  const vatRate = defaultFeeResult.breakdown?.vatRate || 0;

  // Net proceeds
  const netProceeds = sellPrice - vatAmount - totalFees;

  return {
    ...defaultFeeResult,
    marketplace: marketplace.toUpperCase(),
    sellPrice: Number(sellPrice.toFixed(2)),
    breakdown: {
      vat: Number(vatAmount.toFixed(2)),
      vatRate: vatRate,
      referralFee: Number(referralFee.toFixed(2)),
      referralRate: referralRate * 100,
      fbaFee: Number(fbaFee.toFixed(2)),
      closingFee: Number(closingFee.toFixed(2)),
      paymentFee: Number(paymentFee.toFixed(2)),
      paymentFeeRate: paymentFeeRate * 100
    },
    totalFees: Number(totalFees.toFixed(2)),
    netProceeds: Number(netProceeds.toFixed(2)),
    netMarginPercent: Number(((netProceeds / sellPrice) * 100).toFixed(1)),
    feeScheduleVersion: override.feeScheduleVersion || FEE_SCHEDULE_VERSION,
    isOverridden: true,
    overrideMetadata: {
      originalReferralRate: (defaultFeeResult.breakdown?.referralRate || 0) / 100,
      originalFbaFee: defaultFeeResult.breakdown?.fbaFee || 0,
      originalClosingFee: defaultFeeResult.breakdown?.closingFee || 0,
      originalTotalFees: defaultFeeResult.totalFees || 0
    }
  };
}

export default {
  validateFeeOverride,
  getFeeOverrideForMarketplace,
  getFeeScheduleVersion,
  applyFeeOverrides,
  FEE_SCHEDULE_VERSION
};

