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
      // US tariffs on Chinese goods (Section 301 + Regular MFN)
      electronics: 0.00,           // Consumer electronics often 0%
      computers: 0.00,             // Laptops, tablets 0%
      video_games: 0.00,           // Game consoles 0%
      toys_games: 0.00,            // Toys 0%
      clothing_apparel: 0.12,      // 12% average
      footwear: 0.20,              // 20% average
      furniture: 0.00,             // Most furniture 0%
      home_garden: 0.05,           // 5% average
      sports_outdoors: 0.04,       // 4% average
      health_beauty: 0.00,         // Most 0%
      kitchen: 0.03,               // 3% average
      pet_supplies: 0.00,          // 0%
      automotive: 0.025,           // 2.5%
      jewelry: 0.065,              // 6.5%
      watches: 0.065,              // 6.5%
      books_media: 0.00,           // 0%
      musical_instruments: 0.045,  // 4.5%
      default: 0.05                // Default 5%
    },
    UK: {
      // UK tariffs post-Brexit (UK Global Tariff)
      electronics: 0.00,
      computers: 0.00,
      video_games: 0.00,
      toys_games: 0.047,           // 4.7%
      clothing_apparel: 0.12,
      footwear: 0.08,              // 8%
      furniture: 0.00,
      home_garden: 0.04,
      sports_outdoors: 0.04,
      health_beauty: 0.00,
      kitchen: 0.03,
      pet_supplies: 0.00,
      automotive: 0.04,
      jewelry: 0.025,
      watches: 0.045,
      books_media: 0.00,
      musical_instruments: 0.035,
      default: 0.04
    },
    DE: {
      // EU Common External Tariff (applies to Germany)
      electronics: 0.00,
      computers: 0.00,
      video_games: 0.00,
      toys_games: 0.047,
      clothing_apparel: 0.12,
      footwear: 0.08,
      furniture: 0.00,
      home_garden: 0.04,
      sports_outdoors: 0.04,
      health_beauty: 0.00,
      kitchen: 0.03,
      pet_supplies: 0.00,
      automotive: 0.04,
      jewelry: 0.025,
      watches: 0.045,
      books_media: 0.00,
      musical_instruments: 0.035,
      default: 0.04
    }
  },
  
  // From EU countries
  EU: {
    US: {
      electronics: 0.00,
      toys_games: 0.00,
      clothing_apparel: 0.08,
      default: 0.03
    },
    UK: {
      // EU-UK Trade Agreement (mostly 0%)
      electronics: 0.00,
      toys_games: 0.00,
      clothing_apparel: 0.00,
      default: 0.00
    },
    DE: {
      // Intra-EU = 0%
      default: 0.00
    }
  },
  
  // From UK
  UK: {
    US: {
      electronics: 0.00,
      toys_games: 0.00,
      default: 0.03
    },
    DE: {
      // UK-EU Trade Agreement
      electronics: 0.00,
      toys_games: 0.00,
      default: 0.00
    }
  },
  
  // From US
  US: {
    UK: {
      electronics: 0.00,
      toys_games: 0.00,
      default: 0.03
    },
    DE: {
      electronics: 0.00,
      toys_games: 0.00,
      default: 0.03
    }
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
