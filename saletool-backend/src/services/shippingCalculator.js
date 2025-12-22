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
      sea: {
        perKg: 2.50,           // Sea freight ~$2.50/kg
        transitDays: 30,       // 25-35 days
        minCharge: 150         // Minimum charge
      },
      air: {
        perKg: 6.00,           // Air freight ~$6/kg
        transitDays: 7,        // 5-10 days
        minCharge: 80
      },
      express: {
        perKg: 12.00,          // Express ~$12/kg (DHL/FedEx)
        transitDays: 3,        // 2-5 days
        minCharge: 30
      }
    },
    UK: {
      sea: {
        perKg: 3.00,
        transitDays: 35,
        minCharge: 180
      },
      air: {
        perKg: 7.00,
        transitDays: 7,
        minCharge: 90
      },
      express: {
        perKg: 14.00,
        transitDays: 4,
        minCharge: 35
      }
    },
    DE: {
      sea: {
        perKg: 2.80,
        transitDays: 35,
        minCharge: 170
      },
      air: {
        perKg: 6.50,
        transitDays: 7,
        minCharge: 85
      },
      express: {
        perKg: 13.00,
        transitDays: 4,
        minCharge: 32
      }
    }
  },
  
  // From EU (Germany as proxy)
  EU: {
    US: {
      sea: { perKg: 2.00, transitDays: 20, minCharge: 120 },
      air: { perKg: 5.00, transitDays: 5, minCharge: 60 },
      express: { perKg: 10.00, transitDays: 2, minCharge: 25 }
    },
    UK: {
      sea: { perKg: 1.50, transitDays: 7, minCharge: 50 },
      air: { perKg: 3.50, transitDays: 2, minCharge: 40 },
      express: { perKg: 7.00, transitDays: 1, minCharge: 20 }
    },
    DE: {
      // Intra-EU ground shipping
      sea: { perKg: 1.00, transitDays: 3, minCharge: 30 },
      air: { perKg: 2.50, transitDays: 1, minCharge: 25 },
      express: { perKg: 5.00, transitDays: 1, minCharge: 15 }
    }
  },
  
  // From UK
  UK: {
    US: {
      sea: { perKg: 2.20, transitDays: 18, minCharge: 100 },
      air: { perKg: 5.50, transitDays: 4, minCharge: 55 },
      express: { perKg: 11.00, transitDays: 2, minCharge: 28 }
    },
    DE: {
      sea: { perKg: 1.80, transitDays: 5, minCharge: 60 },
      air: { perKg: 4.00, transitDays: 2, minCharge: 45 },
      express: { perKg: 8.00, transitDays: 1, minCharge: 22 }
    }
  },
  
  // From US
  US: {
    UK: {
      sea: { perKg: 2.50, transitDays: 20, minCharge: 110 },
      air: { perKg: 6.00, transitDays: 4, minCharge: 65 },
      express: { perKg: 12.00, transitDays: 2, minCharge: 30 }
    },
    DE: {
      sea: { perKg: 2.50, transitDays: 22, minCharge: 115 },
      air: { perKg: 6.00, transitDays: 5, minCharge: 70 },
      express: { perKg: 12.00, transitDays: 3, minCharge: 32 }
    }
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
