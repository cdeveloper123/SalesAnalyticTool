/**
 * Duty Override Service
 * 
 * Handles manual overrides for duty calculations including:
 * - HS code input and validation
 * - Manual duty rate override
 * - Direct duty amount override
 * - Calculation method selection (category-based vs HS code-based)
 */

/**
 * Validate HS code format
 * HS codes are typically 6-10 digits
 */
export function validateHSCode(hsCode) {
  if (!hsCode) {
    return { valid: false, error: 'HS code is required' };
  }

  // Convert to string and remove spaces/dashes
  const cleaned = String(hsCode).replace(/[\s-]/g, '');

  // Check if it's all digits
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, error: 'HS code must contain only digits' };
  }

  // Check length (6-10 digits)
  if (cleaned.length < 6 || cleaned.length > 10) {
    return { valid: false, error: 'HS code must be 6-10 digits' };
  }

  return { valid: true, cleaned };
}

/**
 * Validate duty override structure
 */
export function validateDutyOverride(override) {
  if (!override || typeof override !== 'object') {
    return { valid: false, error: 'Override must be an object' };
  }

  const { origin, destination, hsCode, rate, amount, calculationMethod } = override;

  // Validate origin and destination
  if (origin && typeof origin !== 'string') {
    return { valid: false, error: 'Origin must be a string' };
  }
  if (destination && typeof destination !== 'string') {
    return { valid: false, error: 'Destination must be a string' };
  }

  // Validate HS code if provided
  if (hsCode) {
    const hsValidation = validateHSCode(hsCode);
    if (!hsValidation.valid) {
      return { valid: false, error: hsValidation.error };
    }
  }

  // Validate rate (0-1 for percentage, or could be percentage like 0.12 for 12%)
  if (rate !== undefined) {
    if (typeof rate !== 'number' || rate < 0 || rate > 1) {
      return { valid: false, error: 'Duty rate must be a number between 0 and 1 (e.g., 0.12 for 12%)' };
    }
  }

  // Validate amount (direct duty amount)
  if (amount !== undefined) {
    if (typeof amount !== 'number' || amount < 0) {
      return { valid: false, error: 'Duty amount must be a non-negative number' };
    }
  }

  // Validate calculation method
  if (calculationMethod && !['category', 'hscode', 'direct'].includes(calculationMethod.toLowerCase())) {
    return { valid: false, error: 'Calculation method must be category, hscode, or direct' };
  }

  // If using direct amount, amount must be provided
  if (calculationMethod === 'direct' && amount === undefined) {
    return { valid: false, error: 'Direct calculation method requires amount to be specified' };
  }

  // If using HS code method, HS code must be provided
  if (calculationMethod === 'hscode' && !hsCode) {
    return { valid: false, error: 'HS code calculation method requires HS code to be specified' };
  }

  return { valid: true };
}

/**
 * Get duty calculation method from override
 * 
 * @param {object} override - Duty override object
 * @returns {string} - 'category', 'hscode', or 'direct'
 */
export function getDutyCalculationMethod(override) {
  if (!override) return 'category';

  if (override.calculationMethod) {
    return override.calculationMethod.toLowerCase();
  }

  // Infer method from override data
  if (override.amount !== undefined) {
    return 'direct';
  }

  if (override.hsCode) {
    return 'hscode';
  }

  if (override.rate !== undefined) {
    return 'hscode'; // Rate override typically means HS code-based
  }

  return 'category';
}

/**
 * Get duty override for a route
 * 
 * @param {string} origin - Origin country code
 * @param {string} destination - Destination country code
 * @param {object} overrides - Override object or array of overrides
 * @returns {object|null} - Override data for this route, or null if no override
 */
export function getDutyOverrideForRoute(origin, destination, overrides) {
  if (!overrides) return null;

  // Handle array of overrides
  const overrideArray = Array.isArray(overrides) ? overrides : [overrides];

  // Find matching override for this route
  const matchingOverride = overrideArray.find(override => {
    const overrideOrigin = override.origin?.toUpperCase();
    const overrideDest = override.destination?.toUpperCase();
    const routeOrigin = origin?.toUpperCase();
    const routeDest = destination?.toUpperCase();

    return overrideOrigin === routeOrigin && overrideDest === routeDest;
  });

  if (!matchingOverride) return null;

  // Validate the override
  const validation = validateDutyOverride(matchingOverride);
  if (!validation.valid) {
    console.warn(`Invalid duty override: ${validation.error}`);
    return null;
  }

  // Clean HS code if provided
  let cleanedHSCode = null;
  if (matchingOverride.hsCode) {
    const hsValidation = validateHSCode(matchingOverride.hsCode);
    if (hsValidation.valid) {
      cleanedHSCode = hsValidation.cleaned;
    }
  }

  return {
    isOverridden: true,
    hsCode: cleanedHSCode,
    rate: matchingOverride.rate,
    amount: matchingOverride.amount,
    calculationMethod: getDutyCalculationMethod(matchingOverride)
  };
}

/**
 * Apply duty overrides to a calculation
 * 
 * @param {number} productValue - Product value
 * @param {string} origin - Origin country code
 * @param {string} destination - Destination country code
 * @param {string} category - Product category (for fallback)
 * @param {object} defaultDutyResult - Default duty calculation result
 * @param {object} overrides - Override object or array
 * @returns {object} - Duty calculation result with overrides applied
 */
export function applyDutyOverrides(productValue, origin, destination, category, defaultDutyResult, overrides) {
  if (!overrides) {
    return defaultDutyResult;
  }

  const override = getDutyOverrideForRoute(origin, destination, overrides);

  if (!override) {
    return defaultDutyResult;
  }

  let dutyAmount;
  let dutyRate;
  let calculationMethod = override.calculationMethod;

  // Calculate duty based on method
  if (calculationMethod === 'direct') {
    // Direct amount override
    dutyAmount = override.amount;
    dutyRate = productValue > 0 ? dutyAmount / productValue : 0;
  } else if (calculationMethod === 'hscode' && override.rate !== undefined) {
    // HS code with rate override
    dutyRate = override.rate;
    dutyAmount = productValue * dutyRate;
  } else if (calculationMethod === 'hscode' && override.hsCode) {
    // HS code provided but no rate - use default rate for now
    // In a full implementation, this would lookup HS code in tariff database
    dutyRate = defaultDutyResult?.dutyRate || 0.05;
    dutyAmount = productValue * dutyRate;
  } else {
    // Fallback to default
    dutyAmount = defaultDutyResult?.dutyAmount || 0;
    dutyRate = defaultDutyResult?.dutyRate || 0;
  }

  return {
    ...defaultDutyResult,
    origin,
    destination,
    category: override.hsCode ? `HS Code: ${override.hsCode}` : category,
    hsCode: override.hsCode,
    dutyRate: Number(dutyRate.toFixed(4)),
    dutyPercent: (dutyRate * 100).toFixed(1) + '%',
    productValue,
    dutyAmount: Number(dutyAmount.toFixed(2)),
    calculationMethod: calculationMethod,
    isOverridden: true,
    overrideMetadata: {
      originalDutyRate: defaultDutyResult?.dutyRate,
      originalDutyAmount: defaultDutyResult?.dutyAmount,
      originalCategory: defaultDutyResult?.category
    }
  };
}

export default {
  validateHSCode,
  validateDutyOverride,
  getDutyCalculationMethod,
  getDutyOverrideForRoute,
  applyDutyOverrides
};

