/**
 * Fee Calculator Service (Step 3) - Updated December 2025
 * 
 * Calculates Amazon fees and net proceeds for US, UK, and DE marketplaces.
 * Uses Amazon's published 2025 fee schedules.
 * 
 * Input: Sell price, category, weight, dimensions, marketplace
 * Output: Fee breakdown + Net Proceeds
 */

import { applyFeeOverrides } from './feeOverrideService.js';

// ============================================================================
// REFERRAL FEE RATES BY CATEGORY (2025)
// ============================================================================

const REFERRAL_RATES = {
  US: {
    // Electronics & Computers - 8%
    'Electronics': 0.08,
    'Consumer Electronics': 0.08,
    'Computers': 0.08,
    'Camera & Photo': 0.08,
    'Cell Phones & Accessories': 0.08,
    'Television & Video': 0.08,
    
    // Video Games - 15%
    'Video Games': 0.15,
    'Video Game Consoles': 0.15,
    
    // Apparel - Tiered
    'Apparel': { 
      tiers: [
        { maxPrice: 15, rate: 0.05 },
        { maxPrice: 20, rate: 0.10 },
        { maxPrice: Infinity, rate: 0.17 }
      ]
    },
    'Clothing': {
      tiers: [
        { maxPrice: 15, rate: 0.05 },
        { maxPrice: 20, rate: 0.10 },
        { maxPrice: Infinity, rate: 0.17 }
      ]
    },
    
    // Standard 15% Categories
    'Home & Kitchen': 0.15,
    'Kitchen & Dining': 0.15,
    'Toys & Games': 0.15,
    'Sports & Outdoors': 0.15,
    'Patio, Lawn & Garden': 0.15,
    'Pet Supplies': 0.15,
    'Office Products': 0.15,
    'Baby': 0.15,
    'Health & Personal Care': 0.15,
    'Beauty': 0.15,
    'Grocery': 0.15,
    'Musical Instruments': 0.15,
    'Automotive': 0.15,
    'Industrial & Scientific': 0.15,
    'Tools & Home Improvement': 0.15,
    
    // Higher Rate Categories
    'Jewelry': 0.20,
    'Watches': 0.16,
    'Luggage': 0.15,
    
    // Amazon Device Accessories - Highest
    'Amazon Device Accessories': 0.45,
    
    // Media (with closing fee)
    'Books': 0.15,
    'Music': 0.15,
    'DVD': 0.15,
    'Software': 0.15,
    
    // Default
    'default': 0.15
  },
  
  UK: {
    'Electronics': 0.08,
    'Computers': 0.08,
    'Video Games': 0.15,
    'PC & Video Games': 0.15,
    'Home & Kitchen': 0.15,
    'Toys & Games': 0.15,
    'Sports & Outdoors': 0.15,
    'Beauty': 0.15,
    'Health & Personal Care': 0.15,
    'Clothing': 0.15,
    'Shoes': 0.15,
    'Jewellery': 0.20,
    'Watches': 0.15,
    'default': 0.15
  },
  
  DE: {
    'Elektronik': 0.08,
    'Computer': 0.08,
    'Games': 0.15,
    'PC & Videospiele': 0.15,
    'Küche & Haushalt': 0.15,
    'Spielzeug': 0.15,
    'Sport & Freizeit': 0.15,
    'Beauty': 0.15,
    'Drogerie & Körperpflege': 0.15,
    'Bekleidung': 0.15,
    'Schuhe': 0.15,
    'Schmuck': 0.20,
    'Uhren': 0.15,
    'default': 0.15
  },
  
  FR: {
    'Électronique': 0.08,
    'Informatique': 0.08,
    'Jeux vidéo': 0.15,
    'Cuisine & Maison': 0.15,
    'Jouets': 0.15,
    'Sports & Loisirs': 0.15,
    'Beauté': 0.15,
    'Santé': 0.15,
    'Vêtements': 0.15,
    'default': 0.15
  },
  
  IT: {
    'Elettronica': 0.08,
    'Informatica': 0.08,
    'Videogiochi': 0.15,
    'Casa e cucina': 0.15,
    'Giochi e giocattoli': 0.15,
    'Sport e tempo libero': 0.15,
    'Bellezza': 0.15,
    'Salute': 0.15,
    'Abbigliamento': 0.15,
    'default': 0.15
  },
  
  AU: {
    'Electronics': 0.08,
    'Computers': 0.08,
    'Video Games': 0.15,
    'Home & Kitchen': 0.15,
    'Toys & Games': 0.15,
    'Sports & Outdoors': 0.15,
    'Beauty': 0.15,
    'Health': 0.15,
    'Clothing': 0.15,
    'default': 0.15
  }
};

// ============================================================================
// FBA SIZE TIERS AND FEES (2025 Non-Peak)
// ============================================================================

const FBA_SIZE_TIERS = {
  US: {
    // Dimensions in inches, weight in oz/lb
    smallStandard: {
      maxLength: 15,
      maxWidth: 12,
      maxHeight: 0.75,
      maxWeight: 16, // 1 lb in oz
      fees: [
        { maxWeight: 2, fee: 3.06 },
        { maxWeight: 4, fee: 3.15 },
        { maxWeight: 6, fee: 3.24 },
        { maxWeight: 8, fee: 3.33 },
        { maxWeight: 10, fee: 3.43 },
        { maxWeight: 12, fee: 3.53 },
        { maxWeight: 14, fee: 3.60 },
        { maxWeight: 16, fee: 3.87 }
      ]
    },
    largeStandard: {
      maxLength: 18,
      maxWidth: 14,
      maxHeight: 8,
      maxWeight: 320, // 20 lb in oz
      fees: [
        { maxWeight: 4, fee: 3.68 },
        { maxWeight: 8, fee: 3.90 },
        { maxWeight: 12, fee: 4.15 },
        { maxWeight: 16, fee: 4.55 },
        { maxWeight: 24, fee: 5.00 },
        { maxWeight: 32, fee: 5.30 },
        { maxWeight: 48, fee: 5.70 },
        { maxWeight: 80, fee: 6.15 },
        { maxWeight: 160, fee: 7.05 },
        { maxWeight: 320, fee: 7.46 }
      ],
      additionalPerOz: 0.08 // per 4oz above 3 lb
    },
    largeBulky: {
      maxWeight: 800, // 50 lb in oz
      baseFee: 9.61,
      perLb: 0.38 // per lb above first lb
    },
    extraLarge: {
      baseFee: 26.33,
      perLb: 0.38
    }
  },
  
  UK: {
    // Fees in GBP, dimensions in cm, weight in grams
    envelope: {
      maxLength: 33,
      maxWidth: 23,
      maxHeight: 2.5,
      maxWeight: 100,
      fee: 1.83
    },
    smallStandard: {
      maxLength: 35,
      maxWidth: 25,
      maxHeight: 12,
      maxWeight: 400,
      fees: [
        { maxWeight: 100, fee: 2.04 },
        { maxWeight: 210, fee: 2.16 },
        { maxWeight: 400, fee: 2.41 }
      ]
    },
    largeStandard: {
      maxWeight: 12000,
      fees: [
        { maxWeight: 400, fee: 2.80 },
        { maxWeight: 900, fee: 3.05 },
        { maxWeight: 1400, fee: 3.68 },
        { maxWeight: 1900, fee: 3.99 },
        { maxWeight: 2900, fee: 4.66 },
        { maxWeight: 3900, fee: 4.95 },
        { maxWeight: 5900, fee: 5.32 },
        { maxWeight: 8900, fee: 5.72 },
        { maxWeight: 12000, fee: 6.53 }
      ]
    },
    largeBulky: {
      baseFee: 7.78,
      perKg: 0.30
    }
  },
  
  DE: {
    // Fees in EUR, dimensions in cm, weight in grams
    envelope: {
      maxLength: 33,
      maxWidth: 23,
      maxHeight: 2.5,
      maxWeight: 100,
      fee: 2.16
    },
    smallStandard: {
      maxLength: 35,
      maxWidth: 25,
      maxHeight: 12,
      maxWeight: 400,
      fees: [
        { maxWeight: 100, fee: 2.37 },
        { maxWeight: 210, fee: 2.50 },
        { maxWeight: 400, fee: 2.78 }
      ]
    },
    largeStandard: {
      maxWeight: 12000,
      fees: [
        { maxWeight: 400, fee: 3.21 },
        { maxWeight: 900, fee: 3.51 },
        { maxWeight: 1400, fee: 4.24 },
        { maxWeight: 1900, fee: 4.60 },
        { maxWeight: 2900, fee: 5.38 },
        { maxWeight: 3900, fee: 5.71 },
        { maxWeight: 5900, fee: 6.14 },
        { maxWeight: 8900, fee: 6.60 },
        { maxWeight: 12000, fee: 7.54 }
      ]
    },
    largeBulky: {
      baseFee: 9.07,
      perKg: 0.35
    }
  },
  
  // FR and IT use same EU structure as DE
  FR: {
    envelope: { maxLength: 33, maxWidth: 23, maxHeight: 2.5, maxWeight: 100, fee: 2.16 },
    smallStandard: { maxLength: 35, maxWidth: 25, maxHeight: 12, maxWeight: 400,
      fees: [{ maxWeight: 100, fee: 2.37 }, { maxWeight: 210, fee: 2.50 }, { maxWeight: 400, fee: 2.78 }]
    },
    largeStandard: { maxWeight: 12000,
      fees: [{ maxWeight: 400, fee: 3.21 }, { maxWeight: 900, fee: 3.51 }, { maxWeight: 1400, fee: 4.24 },
             { maxWeight: 1900, fee: 4.60 }, { maxWeight: 2900, fee: 5.38 }, { maxWeight: 3900, fee: 5.71 },
             { maxWeight: 5900, fee: 6.14 }, { maxWeight: 8900, fee: 6.60 }, { maxWeight: 12000, fee: 7.54 }]
    },
    largeBulky: { baseFee: 9.07, perKg: 0.35 }
  },
  
  IT: {
    envelope: { maxLength: 33, maxWidth: 23, maxHeight: 2.5, maxWeight: 100, fee: 2.16 },
    smallStandard: { maxLength: 35, maxWidth: 25, maxHeight: 12, maxWeight: 400,
      fees: [{ maxWeight: 100, fee: 2.37 }, { maxWeight: 210, fee: 2.50 }, { maxWeight: 400, fee: 2.78 }]
    },
    largeStandard: { maxWeight: 12000,
      fees: [{ maxWeight: 400, fee: 3.21 }, { maxWeight: 900, fee: 3.51 }, { maxWeight: 1400, fee: 4.24 },
             { maxWeight: 1900, fee: 4.60 }, { maxWeight: 2900, fee: 5.38 }, { maxWeight: 3900, fee: 5.71 },
             { maxWeight: 5900, fee: 6.14 }, { maxWeight: 8900, fee: 6.60 }, { maxWeight: 12000, fee: 7.54 }]
    },
    largeBulky: { baseFee: 9.07, perKg: 0.35 }
  },
  
  AU: {
    // Australia uses grams, AUD equivalent fees
    smallStandard: { maxLength: 35, maxWidth: 25, maxHeight: 12, maxWeight: 400,
      fees: [{ maxWeight: 100, fee: 3.20 }, { maxWeight: 210, fee: 3.40 }, { maxWeight: 400, fee: 3.80 }]
    },
    largeStandard: { maxWeight: 12000,
      fees: [{ maxWeight: 400, fee: 4.50 }, { maxWeight: 900, fee: 5.00 }, { maxWeight: 1400, fee: 5.80 },
             { maxWeight: 1900, fee: 6.30 }, { maxWeight: 2900, fee: 7.20 }, { maxWeight: 3900, fee: 7.80 },
             { maxWeight: 5900, fee: 8.40 }, { maxWeight: 8900, fee: 9.00 }, { maxWeight: 12000, fee: 10.30 }]
    },
    largeBulky: { baseFee: 12.50, perKg: 0.45 }
  }
};

// ============================================================================
// VAT RATES (2025)
// ============================================================================

const VAT_RATES = {
  US: 0,        // No VAT (sales tax handled by states)
  UK: 0.20,     // 20%
  DE: 0.19,     // 19%
  FR: 0.20,     // 20%
  IT: 0.22,     // 22%
  AU: 0.10      // 10% GST
};

// ============================================================================
// CLOSING FEES (Media categories only)
// ============================================================================

const CLOSING_FEES = {
  US: 1.80,
  UK: 0.50,  // £0.50
  DE: 0.50,  // €0.50
  FR: 0.50,  // €0.50
  IT: 0.50,  // €0.50
  AU: 0.50   // A$0.50
};

const MEDIA_CATEGORIES = ['Books', 'Music', 'DVD', 'Software', 'Video'];

// ============================================================================
// CURRENCY INFO
// ============================================================================

const CURRENCIES = {
  US: 'USD',
  UK: 'GBP',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  AU: 'AUD'
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert weight to the marketplace's unit system
 */
function normalizeWeight(weightKg, marketplace) {
  if (marketplace === 'US') {
    return weightKg * 35.274; // Convert kg to oz
  }
  return weightKg * 1000; // Convert kg to grams
}

/**
 * Convert dimensions to marketplace unit system
 */
function normalizeDimensions(lengthCm, widthCm, heightCm, marketplace) {
  if (marketplace === 'US') {
    // Convert cm to inches
    return {
      length: lengthCm / 2.54,
      width: widthCm / 2.54,
      height: heightCm / 2.54
    };
  }
  return { length: lengthCm, width: widthCm, height: heightCm };
}

/**
 * Determine size tier based on dimensions and weight
 */
function determineSizeTier(marketplace, dims, weight) {
  const tiers = FBA_SIZE_TIERS[marketplace];
  if (!tiers) return 'largeStandard';
  
  // Check for small standard
  if (tiers.smallStandard) {
    const t = tiers.smallStandard;
    if (dims.length <= t.maxLength && 
        dims.width <= t.maxWidth && 
        dims.height <= t.maxHeight &&
        weight <= t.maxWeight) {
      return 'smallStandard';
    }
  }
  
  // Check for large standard
  if (tiers.largeStandard) {
    const t = tiers.largeStandard;
    if (marketplace === 'US') {
      if (dims.length <= t.maxLength &&
          dims.width <= t.maxWidth &&
          dims.height <= t.maxHeight &&
          weight <= t.maxWeight) {
        return 'largeStandard';
      }
    } else {
      if (weight <= t.maxWeight) {
        return 'largeStandard';
      }
    }
  }
  
  // Check for large bulky
  if (tiers.largeBulky && weight <= tiers.largeBulky.maxWeight) {
    return 'largeBulky';
  }
  
  return 'extraLarge';
}

/**
 * Calculate FBA fee based on size tier and weight
 */
function calculateFBAFee(marketplace, sizeTier, weight) {
  const tiers = FBA_SIZE_TIERS[marketplace];
  if (!tiers || !tiers[sizeTier]) {
    // Default fallback
    return 3.50;
  }
  
  const tierConfig = tiers[sizeTier];
  
  // Fixed fee tiers (small/large standard)
  if (tierConfig.fees) {
    for (const feeLevel of tierConfig.fees) {
      if (weight <= feeLevel.maxWeight) {
        return feeLevel.fee;
      }
    }
    // If weight exceeds all tiers, return highest + additional
    const maxFee = tierConfig.fees[tierConfig.fees.length - 1].fee;
    if (tierConfig.additionalPerOz) {
      const maxWeight = tierConfig.fees[tierConfig.fees.length - 1].maxWeight;
      const excessWeight = weight - maxWeight;
      const additionalUnits = Math.ceil(excessWeight / 4); // per 4oz
      return maxFee + (additionalUnits * tierConfig.additionalPerOz);
    }
    return maxFee;
  }
  
  // Variable fee (bulky/extra-large)
  if (tierConfig.baseFee) {
    let fee = tierConfig.baseFee;
    if (tierConfig.perLb && marketplace === 'US') {
      const weightLbs = weight / 16;
      if (weightLbs > 1) {
        fee += (weightLbs - 1) * tierConfig.perLb;
      }
    }
    if (tierConfig.perKg && marketplace !== 'US') {
      const weightKg = weight / 1000;
      if (weightKg > 1) {
        fee += (weightKg - 1) * tierConfig.perKg;
      }
    }
    return fee;
  }
  
  return 3.50; // Default fallback
}

/**
 * Get referral fee rate for a category
 */
function getReferralRate(marketplace, category, sellPrice) {
  const rates = REFERRAL_RATES[marketplace] || REFERRAL_RATES.US;
  
  if (!category) {
    return rates.default || 0.15;
  }
  
  // Check for exact match
  if (rates[category]) {
    const rateConfig = rates[category];
    
    // Handle tiered rates (like Apparel)
    if (typeof rateConfig === 'object' && rateConfig.tiers) {
      for (const tier of rateConfig.tiers) {
        if (sellPrice <= tier.maxPrice) {
          return tier.rate;
        }
      }
      return rateConfig.tiers[rateConfig.tiers.length - 1].rate;
    }
    
    return rateConfig;
  }
  
  // Check for partial match
  const lowerCategory = category.toLowerCase();
  for (const [key, rateConfig] of Object.entries(rates)) {
    if (key !== 'default' && lowerCategory.includes(key.toLowerCase())) {
      if (typeof rateConfig === 'object' && rateConfig.tiers) {
        for (const tier of rateConfig.tiers) {
          if (sellPrice <= tier.maxPrice) {
            return tier.rate;
          }
        }
        return rateConfig.tiers[rateConfig.tiers.length - 1].rate;
      }
      return rateConfig;
    }
  }
  
  return rates.default || 0.15;
}

/**
 * Check if category is media (has closing fee)
 */
function isMediaCategory(category) {
  if (!category) return false;
  return MEDIA_CATEGORIES.some(media => 
    category.toLowerCase().includes(media.toLowerCase())
  );
}

// ============================================================================
// MAIN CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate all fees for a product on a specific marketplace
 * 
 * @param {string} marketplace - 'US', 'UK', or 'DE'
 * @param {number} sellPrice - Listing price (gross, including VAT for EU)
 * @param {string} category - Product category
 * @param {object} dimensions - { lengthCm, widthCm, heightCm, weightKg }
 * @param {object} overrides - Optional fee overrides
 * @returns {object} Fee breakdown and net proceeds
 */
export function calculateFees(marketplace, sellPrice, category, dimensions = {}, overrides = null) {
  marketplace = marketplace.toUpperCase();
  
  // Validate inputs
  if (!sellPrice || sellPrice <= 0) {
    throw new Error('Invalid sell price');
  }
  
  const { 
    lengthCm = 20, 
    widthCm = 15, 
    heightCm = 10, 
    weightKg = 0.5 
  } = dimensions;
  
  // Normalize units for marketplace
  const normalizedWeight = normalizeWeight(weightKg, marketplace);
  const normalizedDims = normalizeDimensions(lengthCm, widthCm, heightCm, marketplace);
  
  // Determine size tier
  const sizeTier = determineSizeTier(marketplace, normalizedDims, normalizedWeight);
  
  // Calculate VAT
  const vatRate = VAT_RATES[marketplace] || 0;
  const vatAmount = marketplace === 'US' ? 0 : sellPrice - (sellPrice / (1 + vatRate));
  const priceExVat = sellPrice - vatAmount;
  
  // Calculate referral fee
  const referralRate = getReferralRate(marketplace, category, sellPrice);
  const referralFee = sellPrice * referralRate;
  
  // Calculate FBA fee
  const fbaFee = calculateFBAFee(marketplace, sizeTier, normalizedWeight);
  
  // Calculate closing fee (media only)
  const closingFee = isMediaCategory(category) ? (CLOSING_FEES[marketplace] || 0) : 0;
  
  // Total Amazon fees
  const totalFees = referralFee + fbaFee + closingFee;
  
  // Net proceeds = Sell Price - VAT - Amazon Fees
  const netProceeds = sellPrice - vatAmount - totalFees;
  
  const result = {
    marketplace,
    currency: CURRENCIES[marketplace] || 'USD',
    sellPrice: Number(sellPrice.toFixed(2)),
    sizeTier,
    breakdown: {
      vat: Number(vatAmount.toFixed(2)),
      vatRate: vatRate * 100,
      referralFee: Number(referralFee.toFixed(2)),
      referralRate: referralRate * 100,
      fbaFee: Number(fbaFee.toFixed(2)),
      closingFee: Number(closingFee.toFixed(2))
    },
    totalFees: Number(totalFees.toFixed(2)),
    netProceeds: Number(netProceeds.toFixed(2)),
    netMarginPercent: Number(((netProceeds / sellPrice) * 100).toFixed(1)),
    feeScheduleVersion: '2025-01' // Current fee schedule version
  };

  // Apply overrides if provided
  if (overrides) {
    return applyFeeOverrides(marketplace, sellPrice, category, result, overrides);
  }

  return result;
}

/**
 * Calculate fees for all three marketplaces
 * 
 * @param {object} pricingData - Pricing data by marketplace
 * @param {string} category - Product category
 * @param {object} dimensions - Product dimensions
 * @param {object} overrides - Optional fee overrides
 */
export function calculateFeesAllMarkets(pricingData, category, dimensions, overrides = null) {
  const results = {};
  
  for (const [market, data] of Object.entries(pricingData)) {
    if (data && data.buyBoxPrice) {
      try {
        // Get marketplace-specific overrides if provided
        const marketOverrides = overrides ? 
          (Array.isArray(overrides) ? overrides.filter(o => o.marketplace?.toUpperCase() === market.toUpperCase()) : 
           (overrides.marketplace?.toUpperCase() === market.toUpperCase() ? overrides : null)) : null;
        
        results[market] = calculateFees(market, data.buyBoxPrice, category, dimensions, marketOverrides);
      } catch (error) {
        console.error(`Error calculating fees for ${market}:`, error.message);
      }
    }
  }
  
  return results;
}

/**
 * Get a quick estimate of fees without full dimensions
 * Uses average small-standard tier
 * 
 * @param {string} marketplace - Marketplace code
 * @param {number} sellPrice - Sell price
 * @param {string} category - Product category
 * @param {object} overrides - Optional fee overrides
 */
export function estimateFees(marketplace, sellPrice, category, overrides = null) {
  return calculateFees(marketplace, sellPrice, category, {
    lengthCm: 20,
    widthCm: 15,
    heightCm: 5,
    weightKg: 0.5
  }, overrides);
}

export default {
  calculateFees,
  calculateFeesAllMarkets,
  estimateFees,
  getReferralRate,
  VAT_RATES,
  CURRENCIES,
  FBA_SIZE_TIERS,
  REFERRAL_RATES
};
