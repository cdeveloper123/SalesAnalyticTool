/**
 * Duty Calculator Service
 * 
 * Calculates import duties based on:
 * - Origin country (where product ships from)
 * - Destination country (where product sells)
 * - Product category
 * 
 * Uses 2024-2025 tariff rates
 */

// Common HS Code categories and their typical duty rates
// Source: US HTS, UK Trade Tariff, EU TARIC (2024-2025)
const DUTY_RATES = {
  // From China (CN)
  CN: {
    US: {
      electronics: 0.00, computers: 0.00, video_games: 0.00, toys_games: 0.00,
      clothing_apparel: 0.12, footwear: 0.20, furniture: 0.00, home_garden: 0.05,
      sports_outdoors: 0.04, health_beauty: 0.00, kitchen: 0.03, pet_supplies: 0.00,
      automotive: 0.025, jewelry: 0.065, watches: 0.065, books_media: 0.00,
      musical_instruments: 0.045, default: 0.05
    },
    UK: {
      electronics: 0.00, computers: 0.00, video_games: 0.00, toys_games: 0.047,
      clothing_apparel: 0.12, footwear: 0.08, furniture: 0.00, home_garden: 0.04,
      sports_outdoors: 0.04, health_beauty: 0.00, kitchen: 0.03, pet_supplies: 0.00,
      automotive: 0.04, jewelry: 0.025, watches: 0.045, books_media: 0.00,
      musical_instruments: 0.035, default: 0.04
    },
    DE: {
      electronics: 0.00, computers: 0.00, video_games: 0.00, toys_games: 0.047,
      clothing_apparel: 0.12, footwear: 0.08, furniture: 0.00, home_garden: 0.04,
      sports_outdoors: 0.04, health_beauty: 0.00, kitchen: 0.03, pet_supplies: 0.00,
      automotive: 0.04, jewelry: 0.025, watches: 0.045, books_media: 0.00,
      musical_instruments: 0.035, default: 0.04
    },
    FR: {
      // EU Common External Tariff (same as DE)
      electronics: 0.00, computers: 0.00, video_games: 0.00, toys_games: 0.047,
      clothing_apparel: 0.12, footwear: 0.08, furniture: 0.00, home_garden: 0.04,
      sports_outdoors: 0.04, health_beauty: 0.00, kitchen: 0.03, pet_supplies: 0.00,
      automotive: 0.04, jewelry: 0.025, watches: 0.045, books_media: 0.00,
      musical_instruments: 0.035, default: 0.04
    },
    IT: {
      // EU Common External Tariff (same as DE)
      electronics: 0.00, computers: 0.00, video_games: 0.00, toys_games: 0.047,
      clothing_apparel: 0.12, footwear: 0.08, furniture: 0.00, home_garden: 0.04,
      sports_outdoors: 0.04, health_beauty: 0.00, kitchen: 0.03, pet_supplies: 0.00,
      automotive: 0.04, jewelry: 0.025, watches: 0.045, books_media: 0.00,
      musical_instruments: 0.035, default: 0.04
    },
    AU: {
      // Australia tariffs on Chinese goods
      electronics: 0.00, computers: 0.00, video_games: 0.00, toys_games: 0.00,
      clothing_apparel: 0.05, footwear: 0.10, furniture: 0.00, home_garden: 0.05,
      sports_outdoors: 0.05, health_beauty: 0.00, kitchen: 0.05, pet_supplies: 0.00,
      automotive: 0.05, jewelry: 0.05, watches: 0.05, books_media: 0.00,
      musical_instruments: 0.05, default: 0.05
    }
  },

  // From EU countries (Italy, France, Germany, Spain, etc.)
  // Note: Intra-EU trade has 0% duty, but exports to non-EU have standard rates
  IT: {
    US: { electronics: 0.00, toys_games: 0.00, clothing_apparel: 0.08, default: 0.03 },
    UK: { electronics: 0.00, toys_games: 0.00, clothing_apparel: 0.00, default: 0.00 },  // UK-EU Trade Agreement
    DE: { default: 0.00 },  // Intra-EU = 0%
    FR: { default: 0.00 },  // Intra-EU = 0%
    ES: { default: 0.00 },  // Intra-EU = 0%
    AU: { electronics: 0.00, toys_games: 0.00, clothing_apparel: 0.05, default: 0.05 }
  },

  FR: {
    US: { electronics: 0.00, toys_games: 0.00, clothing_apparel: 0.08, default: 0.03 },
    UK: { electronics: 0.00, toys_games: 0.00, clothing_apparel: 0.00, default: 0.00 },
    DE: { default: 0.00 },  // Intra-EU = 0%
    IT: { default: 0.00 },  // Intra-EU = 0%
    ES: { default: 0.00 },  // Intra-EU = 0%
    AU: { electronics: 0.00, toys_games: 0.00, clothing_apparel: 0.05, default: 0.05 }
  },

  DE: {
    US: { electronics: 0.00, toys_games: 0.00, clothing_apparel: 0.08, default: 0.03 },
    UK: { electronics: 0.00, toys_games: 0.00, clothing_apparel: 0.00, default: 0.00 },
    FR: { default: 0.00 },  // Intra-EU = 0%
    IT: { default: 0.00 },  // Intra-EU = 0%
    ES: { default: 0.00 },  // Intra-EU = 0%
    AU: { electronics: 0.00, toys_games: 0.00, clothing_apparel: 0.05, default: 0.05 }
  },

  ES: {
    US: { electronics: 0.00, toys_games: 0.00, clothing_apparel: 0.08, default: 0.03 },
    UK: { electronics: 0.00, toys_games: 0.00, clothing_apparel: 0.00, default: 0.00 },
    DE: { default: 0.00 },  // Intra-EU = 0%
    FR: { default: 0.00 },  // Intra-EU = 0%
    IT: { default: 0.00 },  // Intra-EU = 0%
    AU: { electronics: 0.00, toys_games: 0.00, clothing_apparel: 0.05, default: 0.05 }
  },

  // Legacy EU entry (kept for backward compatibility)
  EU: {
    US: { electronics: 0.00, toys_games: 0.00, clothing_apparel: 0.08, default: 0.03 },
    UK: { electronics: 0.00, toys_games: 0.00, clothing_apparel: 0.00, default: 0.00 },
    DE: { default: 0.00 },  // Intra-EU = 0%
    FR: { default: 0.00 },  // Intra-EU = 0%
    IT: { default: 0.00 },  // Intra-EU = 0%
    AU: { electronics: 0.00, toys_games: 0.00, clothing_apparel: 0.05, default: 0.05 }
  },

  // From UK
  UK: {
    US: { electronics: 0.00, toys_games: 0.00, default: 0.03 },
    DE: { electronics: 0.00, toys_games: 0.00, default: 0.00 },  // UK-EU Trade Agreement
    FR: { electronics: 0.00, toys_games: 0.00, default: 0.00 },
    IT: { electronics: 0.00, toys_games: 0.00, default: 0.00 },
    AU: { electronics: 0.00, toys_games: 0.00, default: 0.05 }
  },

  // From US
  US: {
    UK: { electronics: 0.00, toys_games: 0.00, default: 0.03 },
    DE: { electronics: 0.00, toys_games: 0.00, default: 0.03 },
    FR: { electronics: 0.00, toys_games: 0.00, default: 0.03 },
    IT: { electronics: 0.00, toys_games: 0.00, default: 0.03 },
    AU: { electronics: 0.00, toys_games: 0.00, default: 0.05 }
  }
};

// Category mapping for common product categories
const CATEGORY_MAPPING = {
  // Amazon categories → duty categories
  'Video Games': 'video_games',
  'Electronics': 'electronics',
  'Computers & Accessories': 'computers',
  'Toys & Games': 'toys_games',
  'Clothing, Shoes & Jewelry': 'clothing_apparel',
  'Clothing': 'clothing_apparel',
  'Shoes': 'footwear',
  'Home & Kitchen': 'kitchen',
  'Garden & Outdoor': 'home_garden',
  'Sports & Outdoors': 'sports_outdoors',
  'Health & Beauty': 'health_beauty',
  'Pet Supplies': 'pet_supplies',
  'Automotive': 'automotive',
  'Jewelry': 'jewelry',
  'Watches': 'watches',
  'Books': 'books_media',
  'Musical Instruments': 'musical_instruments',
  'Furniture': 'furniture'
};

/**
 * Calculate import duty for a product
 */
export function calculateDuty(productValue, origin, destination, category = 'default') {
  // Normalize inputs
  origin = origin?.toUpperCase() || 'CN';
  destination = destination?.toUpperCase() || 'US';

  // Map category to duty category
  const dutyCategory = CATEGORY_MAPPING[category] || category?.toLowerCase() || 'default';

  // Get rates for origin → destination
  const originRates = DUTY_RATES[origin] || DUTY_RATES['CN'];
  const destRates = originRates?.[destination] || originRates?.['US'] || {};

  // Get rate for category
  const dutyRate = destRates[dutyCategory] !== undefined
    ? destRates[dutyCategory]
    : (destRates['default'] || 0.05);

  const dutyAmount = productValue * dutyRate;

  return {
    origin,
    destination,
    category: dutyCategory,
    dutyRate,
    dutyPercent: (dutyRate * 100).toFixed(1) + '%',
    productValue,
    dutyAmount: Number(dutyAmount.toFixed(2))
  };
}

/**
 * Calculate duty for multiple units
 */
export function calculateTotalDuty(unitPrice, quantity, origin, destination, category) {
  const singleDuty = calculateDuty(unitPrice, origin, destination, category);

  return {
    ...singleDuty,
    quantity,
    totalValue: unitPrice * quantity,
    totalDuty: Number((singleDuty.dutyAmount * quantity).toFixed(2)),
    perUnitDuty: singleDuty.dutyAmount
  };
}

/**
 * Get available origin countries
 */
export function getOriginCountries() {
  return Object.keys(DUTY_RATES);
}

/**
 * Get supported destination countries for an origin
 */
export function getDestinationCountries(origin) {
  return Object.keys(DUTY_RATES[origin] || {});
}

export default {
  calculateDuty,
  calculateTotalDuty,
  getOriginCountries,
  getDestinationCountries,
  CATEGORY_MAPPING
};
