/**
 * Shipping Cost Calculator Service
 * 
 * Estimates shipping costs based on:
 * - Origin and destination countries
 * - Shipping method (sea, air, express)
 * - Package weight
 * 
 * Uses 2024-2025 freight rates (averaged from major carriers)
 */

// Shipping rates per KG (2024-2025 estimates)
// Sources: DHL, FedEx, UPS, Flexport estimates
const SHIPPING_RATES = {
  // From China
  CN: {
    US: {
      sea: { perKg: 2.50, transitDays: 30, minCharge: 150 },
      air: { perKg: 6.00, transitDays: 7, minCharge: 80 },
      express: { perKg: 12.00, transitDays: 3, minCharge: 30 }
    },
    UK: {
      sea: { perKg: 3.00, transitDays: 35, minCharge: 180 },
      air: { perKg: 7.00, transitDays: 7, minCharge: 90 },
      express: { perKg: 14.00, transitDays: 4, minCharge: 35 }
    },
    DE: {
      sea: { perKg: 2.80, transitDays: 35, minCharge: 170 },
      air: { perKg: 6.50, transitDays: 7, minCharge: 85 },
      express: { perKg: 13.00, transitDays: 4, minCharge: 32 }
    },
    FR: {
      sea: { perKg: 2.90, transitDays: 36, minCharge: 175 },
      air: { perKg: 6.80, transitDays: 7, minCharge: 88 },
      express: { perKg: 13.50, transitDays: 4, minCharge: 33 }
    },
    IT: {
      sea: { perKg: 3.00, transitDays: 38, minCharge: 180 },
      air: { perKg: 7.00, transitDays: 8, minCharge: 90 },
      express: { perKg: 14.00, transitDays: 5, minCharge: 35 }
    },
    AU: {
      sea: { perKg: 2.20, transitDays: 25, minCharge: 140 },
      air: { perKg: 5.50, transitDays: 5, minCharge: 70 },
      express: { perKg: 11.00, transitDays: 3, minCharge: 28 }
    }
  },
  
  // From EU
  EU: {
    US: { sea: { perKg: 2.00, transitDays: 20, minCharge: 120 }, air: { perKg: 5.00, transitDays: 5, minCharge: 60 }, express: { perKg: 10.00, transitDays: 2, minCharge: 25 } },
    UK: { sea: { perKg: 1.50, transitDays: 7, minCharge: 50 }, air: { perKg: 3.50, transitDays: 2, minCharge: 40 }, express: { perKg: 7.00, transitDays: 1, minCharge: 20 } },
    DE: { sea: { perKg: 1.00, transitDays: 3, minCharge: 30 }, air: { perKg: 2.50, transitDays: 1, minCharge: 25 }, express: { perKg: 5.00, transitDays: 1, minCharge: 15 } },
    FR: { sea: { perKg: 1.20, transitDays: 3, minCharge: 35 }, air: { perKg: 2.80, transitDays: 1, minCharge: 28 }, express: { perKg: 5.50, transitDays: 1, minCharge: 16 } },
    IT: { sea: { perKg: 1.30, transitDays: 4, minCharge: 38 }, air: { perKg: 3.00, transitDays: 2, minCharge: 30 }, express: { perKg: 6.00, transitDays: 1, minCharge: 18 } },
    AU: { sea: { perKg: 3.50, transitDays: 35, minCharge: 200 }, air: { perKg: 8.00, transitDays: 10, minCharge: 100 }, express: { perKg: 16.00, transitDays: 5, minCharge: 40 } }
  },
  
  // From UK
  UK: {
    US: { sea: { perKg: 2.20, transitDays: 18, minCharge: 100 }, air: { perKg: 5.50, transitDays: 4, minCharge: 55 }, express: { perKg: 11.00, transitDays: 2, minCharge: 28 } },
    DE: { sea: { perKg: 1.80, transitDays: 5, minCharge: 60 }, air: { perKg: 4.00, transitDays: 2, minCharge: 45 }, express: { perKg: 8.00, transitDays: 1, minCharge: 22 } },
    FR: { sea: { perKg: 1.60, transitDays: 4, minCharge: 55 }, air: { perKg: 3.50, transitDays: 2, minCharge: 40 }, express: { perKg: 7.00, transitDays: 1, minCharge: 20 } },
    IT: { sea: { perKg: 2.00, transitDays: 6, minCharge: 65 }, air: { perKg: 4.50, transitDays: 3, minCharge: 50 }, express: { perKg: 9.00, transitDays: 2, minCharge: 25 } },
    AU: { sea: { perKg: 3.00, transitDays: 30, minCharge: 180 }, air: { perKg: 7.50, transitDays: 12, minCharge: 95 }, express: { perKg: 15.00, transitDays: 4, minCharge: 38 } }
  },
  
  // From US
  US: {
    UK: { sea: { perKg: 2.50, transitDays: 20, minCharge: 110 }, air: { perKg: 6.00, transitDays: 4, minCharge: 65 }, express: { perKg: 12.00, transitDays: 2, minCharge: 30 } },
    DE: { sea: { perKg: 2.50, transitDays: 22, minCharge: 115 }, air: { perKg: 6.00, transitDays: 5, minCharge: 70 }, express: { perKg: 12.00, transitDays: 3, minCharge: 32 } },
    FR: { sea: { perKg: 2.60, transitDays: 22, minCharge: 118 }, air: { perKg: 6.20, transitDays: 5, minCharge: 72 }, express: { perKg: 12.50, transitDays: 3, minCharge: 33 } },
    IT: { sea: { perKg: 2.70, transitDays: 24, minCharge: 120 }, air: { perKg: 6.50, transitDays: 6, minCharge: 75 }, express: { perKg: 13.00, transitDays: 3, minCharge: 35 } },
    AU: { sea: { perKg: 2.00, transitDays: 25, minCharge: 130 }, air: { perKg: 5.00, transitDays: 8, minCharge: 60 }, express: { perKg: 10.00, transitDays: 3, minCharge: 28 } }
  }
};

// Default rates if route not found
const DEFAULT_RATES = {
  sea: { perKg: 3.00, transitDays: 30, minCharge: 150 },
  air: { perKg: 7.00, transitDays: 7, minCharge: 80 },
  express: { perKg: 15.00, transitDays: 5, minCharge: 40 }
};

/**
 * Calculate shipping cost for a single unit
 */
export function calculateShipping(weightKg, origin, destination, method = 'air') {
  // Normalize inputs
  origin = origin?.toUpperCase() || 'CN';
  destination = destination?.toUpperCase() || 'US';
  method = method?.toLowerCase() || 'air';
  weightKg = Number(weightKg) || 0.5; // Default 0.5 kg
  
  // Get rates
  const originRates = SHIPPING_RATES[origin] || SHIPPING_RATES['CN'];
  const destRates = originRates?.[destination] || originRates?.['US'] || {};
  const methodRates = destRates[method] || DEFAULT_RATES[method] || DEFAULT_RATES['air'];
  
  // Calculate cost
  const rawCost = weightKg * methodRates.perKg;
  const shippingCost = Math.max(rawCost, methodRates.minCharge);
  
  return {
    origin,
    destination,
    method,
    weightKg,
    ratePerKg: methodRates.perKg,
    minCharge: methodRates.minCharge,
    transitDays: methodRates.transitDays,
    shippingCost: Number(shippingCost.toFixed(2)),
    currency: 'USD'
  };
}

/**
 * Calculate shipping cost for multiple units
 */
export function calculateBulkShipping(weightKg, quantity, origin, destination, method = 'air') {
  weightKg = Number(weightKg) || 0.5;
  quantity = Number(quantity) || 1;
  
  const totalWeight = weightKg * quantity;
  const singleUnitShipping = calculateShipping(weightKg, origin, destination, method);
  
  // For bulk, calculate total and per-unit
  const bulkCost = calculateShipping(totalWeight, origin, destination, method);
  
  return {
    ...bulkCost,
    weightPerUnit: weightKg,
    quantity,
    totalWeight,
    totalShippingCost: bulkCost.shippingCost,
    perUnitShippingCost: Number((bulkCost.shippingCost / quantity).toFixed(2))
  };
}

/**
 * Get all available shipping methods with rates for a route
 */
export function getAllShippingOptions(weightKg, origin, destination) {
  const methods = ['sea', 'air', 'express'];
  
  return methods.map(method => ({
    method,
    ...calculateShipping(weightKg, origin, destination, method)
  }));
}

/**
 * Recommend best shipping method based on criteria
 */
export function recommendShipping(weightKg, urgency = 'normal') {
  switch (urgency) {
    case 'urgent':
      return 'express';
    case 'fast':
      return 'air';
    case 'economy':
      return 'sea';
    default:
      return 'air'; // Default to air for balanced cost/speed
  }
}

export default {
  calculateShipping,
  calculateBulkShipping,
  getAllShippingOptions,
  recommendShipping
};
