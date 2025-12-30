/**
 * Shipping Override Service
 * 
 * Handles manual overrides for shipping rates, methods, transit times, and minimum charges
 */

/**
 * Validate shipping override structure
 */
export function validateShippingOverride(override) {
  if (!override || typeof override !== 'object') {
    return { valid: false, error: 'Override must be an object' };
  }

  const { origin, destination, method, ratePerKg, transitDays, minCharge } = override;

  // Validate origin and destination
  if (origin && typeof origin !== 'string') {
    return { valid: false, error: 'Origin must be a string' };
  }
  if (destination && typeof destination !== 'string') {
    return { valid: false, error: 'Destination must be a string' };
  }

  // Validate method
  if (method && !['sea', 'air', 'express'].includes(method.toLowerCase())) {
    return { valid: false, error: 'Method must be sea, air, or express' };
  }

  // Validate ratePerKg
  if (ratePerKg !== undefined && (typeof ratePerKg !== 'number' || ratePerKg < 0)) {
    return { valid: false, error: 'Rate per KG must be a non-negative number' };
  }

  // Validate transitDays
  if (transitDays !== undefined && (typeof transitDays !== 'number' || transitDays < 0)) {
    return { valid: false, error: 'Transit days must be a non-negative number' };
  }

  // Validate minCharge
  if (minCharge !== undefined && (typeof minCharge !== 'number' || minCharge < 0)) {
    return { valid: false, error: 'Minimum charge must be a non-negative number' };
  }

  return { valid: true };
}

/**
 * Apply shipping overrides to a route
 * 
 * @param {string} origin - Origin country code
 * @param {string} destination - Destination country code
 * @param {string} defaultMethod - Default shipping method
 * @param {object} defaultRates - Default rates from shippingCalculator
 * @param {object} overrides - Override object or array of overrides
 * @returns {object} - Override data for this route, or null if no override
 */
export function getShippingOverrideForRoute(origin, destination, defaultMethod, defaultRates, overrides) {
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
  const validation = validateShippingOverride(matchingOverride);
  if (!validation.valid) {
    console.warn(`Invalid shipping override: ${validation.error}`);
    return null;
  }

  // Build override result
  const result = {
    isOverridden: true,
    method: matchingOverride.method?.toLowerCase() || defaultMethod,
    ratePerKg: matchingOverride.ratePerKg !== undefined ? matchingOverride.ratePerKg : defaultRates?.perKg,
    transitDays: matchingOverride.transitDays !== undefined ? matchingOverride.transitDays : defaultRates?.transitDays,
    minCharge: matchingOverride.minCharge !== undefined ? matchingOverride.minCharge : defaultRates?.minCharge
  };

  return result;
}

/**
 * Get shipping options with overrides applied
 * 
 * @param {number} weightKg - Weight in kilograms
 * @param {string} origin - Origin country code
 * @param {string} destination - Destination country code
 * @param {object} defaultOptions - Default shipping options from shippingCalculator
 * @param {object} overrides - Override object or array
 * @returns {array} - Array of shipping options with overrides applied
 */
export function getShippingOptionsWithOverrides(weightKg, origin, destination, defaultOptions, overrides) {
  if (!defaultOptions || !Array.isArray(defaultOptions)) {
    return defaultOptions || [];
  }

  return defaultOptions.map(option => {
    const override = getShippingOverrideForRoute(
      origin,
      destination,
      option.method,
      { perKg: option.ratePerKg, transitDays: option.transitDays, minCharge: option.minCharge },
      overrides
    );

    if (override) {
      // Calculate cost with override
      const rawCost = weightKg * override.ratePerKg;
      const shippingCost = Math.max(rawCost, override.minCharge);

      return {
        ...option,
        method: override.method,
        ratePerKg: override.ratePerKg,
        transitDays: override.transitDays,
        minCharge: override.minCharge,
        shippingCost: Number(shippingCost.toFixed(2)),
        isOverridden: true
      };
    }

    return option;
  });
}

/**
 * Apply shipping overrides to a calculation result
 * 
 * @param {object} calculationResult - Result from shippingCalculator
 * @param {object} overrides - Override object or array
 * @returns {object} - Calculation result with overrides applied
 */
export function applyShippingOverrides(calculationResult, overrides) {
  if (!calculationResult || !overrides) {
    return calculationResult;
  }

  const { origin, destination, method, weightKg } = calculationResult;

  const override = getShippingOverrideForRoute(
    origin,
    destination,
    method,
    {
      perKg: calculationResult.ratePerKg,
      transitDays: calculationResult.transitDays,
      minCharge: calculationResult.minCharge
    },
    overrides
  );

  if (!override) {
    return calculationResult;
  }

  // Recalculate with override values
  const rawCost = weightKg * override.ratePerKg;
  const shippingCost = Math.max(rawCost, override.minCharge);

  return {
    ...calculationResult,
    method: override.method,
    ratePerKg: override.ratePerKg,
    transitDays: override.transitDays,
    minCharge: override.minCharge,
    shippingCost: Number(shippingCost.toFixed(2)),
    isOverridden: true,
    overrideMetadata: {
      originalRatePerKg: calculationResult.ratePerKg,
      originalTransitDays: calculationResult.transitDays,
      originalMinCharge: calculationResult.minCharge,
      originalMethod: calculationResult.method
    }
  };
}

export default {
  validateShippingOverride,
  getShippingOverrideForRoute,
  getShippingOptionsWithOverrides,
  applyShippingOverrides
};

