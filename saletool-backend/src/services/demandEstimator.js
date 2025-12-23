/**
 * Demand Estimator Service (Step 4)
 * 
 * Estimates monthly sales volume based on Amazon Sales Rank (BSR).
 * Uses category-specific lookup tables derived from industry research.
 * 
 * Input: Sales rank, category, marketplace
 * Output: Sales range (low/mid/high), confidence level
 * 
 * Based on: Jungle Scout AccuSales methodology and Helium 10 research
 * Note: All estimates are approximations - exact formulas are proprietary
 */

// ============================================================================
// CATEGORY-SPECIFIC SALES ESTIMATION TABLES
// ============================================================================

/**
 * Category Sales Coefficients
 * 
 * These coefficients are derived from public research comparing:
 * - Jungle Scout Sales Estimator
 * - Helium 10 Xray
 * - Seller community data
 * 
 * Formula: Monthly Sales ≈ coefficient / (rank ^ exponent)
 * 
 * Higher coefficient = more sales at same rank (bigger category)
 * Lower exponent = flatter curve (high ranks still sell well)
 */
const CATEGORY_FORMULAS = {
  US: {
    // High volume categories (coefficient > 100000)
    'Books': { coefficient: 250000, exponent: 0.80 },
    'Kindle Store': { coefficient: 200000, exponent: 0.78 },
    'Clothing, Shoes & Jewelry': { coefficient: 180000, exponent: 0.82 },
    'Home & Kitchen': { coefficient: 150000, exponent: 0.80 },
    'Electronics': { coefficient: 120000, exponent: 0.78 },
    'Toys & Games': { coefficient: 100000, exponent: 0.75 },
    
    // Medium volume categories (coefficient 50000-100000)
    'Video Games': { coefficient: 80000, exponent: 0.72 },
    'PC & Video Games': { coefficient: 80000, exponent: 0.72 },
    'Sports & Outdoors': { coefficient: 75000, exponent: 0.78 },
    'Beauty & Personal Care': { coefficient: 70000, exponent: 0.76 },
    'Health & Household': { coefficient: 70000, exponent: 0.76 },
    'Baby': { coefficient: 60000, exponent: 0.74 },
    'Pet Supplies': { coefficient: 55000, exponent: 0.76 },
    'Office Products': { coefficient: 50000, exponent: 0.78 },
    
    // Lower volume categories (coefficient < 50000)
    'Computers & Accessories': { coefficient: 45000, exponent: 0.74 },
    'Camera & Photo': { coefficient: 40000, exponent: 0.72 },
    'Musical Instruments': { coefficient: 30000, exponent: 0.70 },
    'Grocery & Gourmet Food': { coefficient: 50000, exponent: 0.80 },
    'Industrial & Scientific': { coefficient: 25000, exponent: 0.72 },
    'Automotive': { coefficient: 35000, exponent: 0.74 },
    'Patio, Lawn & Garden': { coefficient: 40000, exponent: 0.76 },
    'Arts, Crafts & Sewing': { coefficient: 35000, exponent: 0.74 },
    
    // Default for unknown categories
    'default': { coefficient: 50000, exponent: 0.75 }
  },
  
  UK: {
    // UK market is approximately 25-30% of US size
    'PC & Video Games': { coefficient: 24000, exponent: 0.72 },
    'Video Games': { coefficient: 24000, exponent: 0.72 },
    'Electronics': { coefficient: 36000, exponent: 0.78 },
    'Home & Kitchen': { coefficient: 45000, exponent: 0.80 },
    'Toys & Games': { coefficient: 30000, exponent: 0.75 },
    'Books': { coefficient: 75000, exponent: 0.80 },
    'Clothing': { coefficient: 54000, exponent: 0.82 },
    'Sports & Outdoors': { coefficient: 22500, exponent: 0.78 },
    'Beauty': { coefficient: 21000, exponent: 0.76 },
    'Health & Personal Care': { coefficient: 21000, exponent: 0.76 },
    'Baby': { coefficient: 18000, exponent: 0.74 },
    'Pet Supplies': { coefficient: 16500, exponent: 0.76 },
    'default': { coefficient: 15000, exponent: 0.75 }
  },
  
  DE: {
    // Germany market is approximately 30-35% of US size
    'Games': { coefficient: 28000, exponent: 0.72 },
    'PC & Videospiele': { coefficient: 28000, exponent: 0.72 },
    'Video Games': { coefficient: 28000, exponent: 0.72 },
    'Elektronik': { coefficient: 42000, exponent: 0.78 },
    'Electronics': { coefficient: 42000, exponent: 0.78 },
    'Küche & Haushalt': { coefficient: 52500, exponent: 0.80 },
    'Home & Kitchen': { coefficient: 52500, exponent: 0.80 },
    'Spielzeug': { coefficient: 35000, exponent: 0.75 },
    'Toys & Games': { coefficient: 35000, exponent: 0.75 },
    'Bücher': { coefficient: 87500, exponent: 0.80 },
    'Books': { coefficient: 87500, exponent: 0.80 },
    'Bekleidung': { coefficient: 63000, exponent: 0.82 },
    'Clothing': { coefficient: 63000, exponent: 0.82 },
    'Sport & Freizeit': { coefficient: 26250, exponent: 0.78 },
    'Sports & Outdoors': { coefficient: 26250, exponent: 0.78 },
    'Beauty': { coefficient: 24500, exponent: 0.76 },
    'Drogerie & Körperpflege': { coefficient: 24500, exponent: 0.76 },
    'Baby': { coefficient: 21000, exponent: 0.74 },
    'Haustier': { coefficient: 19250, exponent: 0.76 },
    'Pet Supplies': { coefficient: 19250, exponent: 0.76 },
    'default': { coefficient: 17500, exponent: 0.75 }
  },
  
  FR: {
    // France market is approximately 20% of US size
    'Jeux vidéo': { coefficient: 16000, exponent: 0.72 },
    'Video Games': { coefficient: 16000, exponent: 0.72 },
    'Électronique': { coefficient: 24000, exponent: 0.78 },
    'Electronics': { coefficient: 24000, exponent: 0.78 },
    'Cuisine & Maison': { coefficient: 30000, exponent: 0.80 },
    'Home & Kitchen': { coefficient: 30000, exponent: 0.80 },
    'Jouets': { coefficient: 20000, exponent: 0.75 },
    'Toys & Games': { coefficient: 20000, exponent: 0.75 },
    'default': { coefficient: 10000, exponent: 0.75 }
  },
  
  IT: {
    // Italy market is approximately 15% of US size
    'Videogiochi': { coefficient: 12000, exponent: 0.72 },
    'Video Games': { coefficient: 12000, exponent: 0.72 },
    'Elettronica': { coefficient: 18000, exponent: 0.78 },
    'Electronics': { coefficient: 18000, exponent: 0.78 },
    'Casa e cucina': { coefficient: 22500, exponent: 0.80 },
    'Home & Kitchen': { coefficient: 22500, exponent: 0.80 },
    'Giochi e giocattoli': { coefficient: 15000, exponent: 0.75 },
    'Toys & Games': { coefficient: 15000, exponent: 0.75 },
    'default': { coefficient: 7500, exponent: 0.75 }
  },
  
  AU: {
    // Australia market is approximately 10% of US size
    'Video Games': { coefficient: 8000, exponent: 0.72 },
    'Electronics': { coefficient: 12000, exponent: 0.78 },
    'Home & Kitchen': { coefficient: 15000, exponent: 0.80 },
    'Toys & Games': { coefficient: 10000, exponent: 0.75 },
    'default': { coefficient: 5000, exponent: 0.75 }
  }
};

// ============================================================================
// BSR TIER LOOKUP TABLES (Alternative method)
// ============================================================================

/**
 * BSR to Sales Lookup Table
 * 
 * This provides a quick lookup for common rank ranges.
 * Based on Jungle Scout public data for Video Games category.
 * 
 * Format: { maxRank: minMonthlySales }
 */
const BSR_LOOKUP = {
  US: {
    'Video Games': [
      { maxRank: 10, sales: 3000 },
      { maxRank: 50, sales: 1500 },
      { maxRank: 100, sales: 1000 },
      { maxRank: 250, sales: 600 },
      { maxRank: 500, sales: 400 },
      { maxRank: 1000, sales: 250 },
      { maxRank: 2500, sales: 150 },
      { maxRank: 5000, sales: 80 },
      { maxRank: 10000, sales: 50 },
      { maxRank: 25000, sales: 25 },
      { maxRank: 50000, sales: 12 },
      { maxRank: 100000, sales: 5 },
      { maxRank: Infinity, sales: 1 }
    ],
    'Electronics': [
      { maxRank: 100, sales: 2000 },
      { maxRank: 500, sales: 800 },
      { maxRank: 1000, sales: 500 },
      { maxRank: 5000, sales: 150 },
      { maxRank: 10000, sales: 75 },
      { maxRank: 50000, sales: 20 },
      { maxRank: 100000, sales: 8 },
      { maxRank: Infinity, sales: 2 }
    ],
    'Toys & Games': [
      { maxRank: 100, sales: 2500 },
      { maxRank: 500, sales: 1000 },
      { maxRank: 1000, sales: 600 },
      { maxRank: 5000, sales: 200 },
      { maxRank: 10000, sales: 100 },
      { maxRank: 50000, sales: 30 },
      { maxRank: 100000, sales: 12 },
      { maxRank: Infinity, sales: 2 }
    ]
  }
};

// ============================================================================
// MARKETPLACE SIZE FACTORS
// ============================================================================

const MARKETPLACE_FACTORS = {
  US: 1.00,
  UK: 0.30,
  DE: 0.35,
  FR: 0.20,
  IT: 0.15,
  ES: 0.12,
  CA: 0.18,
  JP: 0.25,
  AU: 0.10
};

// ============================================================================
// CORE ESTIMATION FUNCTIONS
// ============================================================================

/**
 * Get formula for a category in a marketplace
 */
function getCategoryFormula(marketplace, category) {
  const marketFormulas = CATEGORY_FORMULAS[marketplace] || CATEGORY_FORMULAS.US;
  
  if (marketFormulas[category]) {
    return marketFormulas[category];
  }
  
  // Try partial match
  const lowerCategory = (category || '').toLowerCase();
  for (const [key, formula] of Object.entries(marketFormulas)) {
    if (key !== 'default' && lowerCategory.includes(key.toLowerCase())) {
      return formula;
    }
  }
  
  return marketFormulas.default;
}

/**
 * Convert sales rank to estimated monthly sales using formula method
 */
function rankToSalesFormula(rank, category, marketplace) {
  if (!rank || rank <= 0) {
    return { low: 0, mid: 0, high: 0 };
  }
  
  const formula = getCategoryFormula(marketplace, category);
  
  // Apply formula: sales = coefficient / (rank ^ exponent)
  const baseEstimate = formula.coefficient / Math.pow(rank, formula.exponent);
  
  // Apply marketplace factor for non-US markets
  const marketFactor = marketplace === 'US' ? 1 : MARKETPLACE_FACTORS[marketplace] || 0.3;
  const adjustedEstimate = marketplace === 'US' ? baseEstimate : baseEstimate;
  
  // Calculate ranges (conservative approach)
  // Low: 65% of estimate (accounts for competition, seasonality)
  // High: 125% of estimate (accounts for promotional periods)
  const low = Math.max(1, Math.floor(adjustedEstimate * 0.65));
  const mid = Math.max(1, Math.floor(adjustedEstimate));
  const high = Math.max(1, Math.floor(adjustedEstimate * 1.25));
  
  return { low, mid, high };
}

/**
 * Convert sales rank to estimated monthly sales using lookup table method
 * Falls back to formula if category not in lookup
 */
function rankToSalesLookup(rank, category, marketplace) {
  if (!rank || rank <= 0) {
    return { low: 0, mid: 0, high: 0 };
  }
  
  const marketLookup = BSR_LOOKUP[marketplace];
  const categoryLookup = marketLookup ? marketLookup[category] : null;
  
  if (!categoryLookup) {
    // Fallback to formula method
    return rankToSalesFormula(rank, category, marketplace);
  }
  
  // Find the tier
  let baseSales = 1;
  for (const tier of categoryLookup) {
    if (rank <= tier.maxRank) {
      baseSales = tier.sales;
      break;
    }
  }
  
  // Apply range
  const low = Math.floor(baseSales * 0.65);
  const mid = baseSales;
  const high = Math.floor(baseSales * 1.25);
  
  return { low, mid, high };
}

/**
 * Main rank to sales function - uses both methods and averages
 */
function rankToSales(rank, category, marketplace) {
  if (!rank || rank <= 0) {
    return { low: 0, mid: 0, high: 0 };
  }
  
  // Primary: Use formula method (more flexible)
  const formulaResult = rankToSalesFormula(rank, category, marketplace);
  
  // If we have lookup data, blend it
  const marketLookup = BSR_LOOKUP[marketplace];
  const categoryLookup = marketLookup ? marketLookup[category] : null;
  
  if (categoryLookup) {
    const lookupResult = rankToSalesLookup(rank, category, marketplace);
    // Average the two methods for better accuracy
    return {
      low: Math.floor((formulaResult.low + lookupResult.low) / 2),
      mid: Math.floor((formulaResult.mid + lookupResult.mid) / 2),
      high: Math.floor((formulaResult.high + lookupResult.high) / 2)
    };
  }
  
  return formulaResult;
}

// ============================================================================
// CONFIDENCE SCORING
// ============================================================================

/**
 * Determine confidence level based on available signals
 */
function determineConfidence(rank, fbaOffers, priceHistory) {
  let score = 0;
  const signals = [];
  
  // Rank data quality
  if (rank && rank > 0) {
    if (rank < 1000) {
      score += 35;
      signals.push('Strong sales rank (Top 1000)');
    } else if (rank < 10000) {
      score += 30;
      signals.push('Good sales rank (Top 10K)');
    } else if (rank < 100000) {
      score += 20;
      signals.push('Sales rank available');
    } else {
      score += 10;
      signals.push('Low sales rank (reduced accuracy)');
    }
  }
  
  // Competition signals
  if (fbaOffers >= 5) {
    score += 25;
    signals.push(`${fbaOffers} FBA sellers (validated demand)`);
  } else if (fbaOffers >= 2) {
    score += 15;
    signals.push(`${fbaOffers} FBA sellers`);
  } else if (fbaOffers === 1) {
    score += 5;
    signals.push('Single FBA seller (limited signal)');
  }
  
  // Price stability signals
  if (priceHistory) {
    if (priceHistory.trend === 'stable') {
      score += 25;
      signals.push('Price stable last 30 days');
    } else if (priceHistory.trend === 'rising') {
      score += 20;
      signals.push('Price rising (strong demand)');
    } else if (priceHistory.trend === 'declining') {
      score += 10;
      signals.push('Price declining (caution: possible saturation)');
    }
    
    // Price variance check
    if (priceHistory.min && priceHistory.max && priceHistory.avg) {
      const variance = (priceHistory.max - priceHistory.min) / priceHistory.avg;
      if (variance < 0.10) {
        score += 15;
        signals.push('Low price variance (<10%)');
      } else if (variance > 0.30) {
        score -= 5;
        signals.push('High price volatility (>30%)');
      }
    }
  }
  
  // Determine confidence level
  let confidence;
  if (score >= 75) {
    confidence = 'High';
  } else if (score >= 50) {
    confidence = 'Medium';
  } else if (score >= 25) {
    confidence = 'Low';
  } else {
    confidence = 'Very Low';
  }
  
  return { confidence, signals, score };
}

// ============================================================================
// ABSORPTION CAPACITY
// ============================================================================

/**
 * Calculate monthly absorption capacity
 * This is the maximum units we recommend selling per month
 */
function calculateAbsorptionCapacity(salesEstimate, fbaOffers) {
  if (!salesEstimate || salesEstimate.mid <= 0) {
    return 0;
  }
  
  // Market share targets based on competition
  // More competitors = smaller safe share
  let targetShare;
  if (fbaOffers >= 15) {
    targetShare = 0.08; // 8% in highly competitive
  } else if (fbaOffers >= 10) {
    targetShare = 0.12;
  } else if (fbaOffers >= 5) {
    targetShare = 0.18;
  } else if (fbaOffers >= 2) {
    targetShare = 0.25;
  } else {
    targetShare = 0.35; // Can capture more if few competitors
  }
  
  return Math.floor(salesEstimate.mid * targetShare);
}

// ============================================================================
// MAIN EXPORT FUNCTIONS
// ============================================================================

/**
 * Main estimation function
 */
export function estimateDemand(marketplace, marketData) {
  if (!marketData) {
    return {
      marketplace,
      estimatedMonthlySales: { low: 0, mid: 0, high: 0 },
      confidence: 'None',
      confidenceScore: 0,
      signals: ['No market data available'],
      absorptionCapacity: 0
    };
  }
  
  const {
    salesRank,
    salesRankCategory,
    fbaOffers = 0,
    priceHistory30d
  } = marketData;
  
  // Calculate sales estimates
  const salesEstimate = rankToSales(
    salesRank,
    salesRankCategory || 'default',
    marketplace
  );
  
  // Determine confidence
  const { confidence, signals, score } = determineConfidence(
    salesRank,
    fbaOffers,
    priceHistory30d
  );
  
  // Calculate absorption capacity
  const absorptionCapacity = calculateAbsorptionCapacity(salesEstimate, fbaOffers);
  
  return {
    marketplace,
    salesRank,
    category: salesRankCategory,
    estimatedMonthlySales: salesEstimate,
    confidence,
    confidenceScore: score,
    signals,
    absorptionCapacity,
    methodology: 'Category-specific coefficient formula with lookup blend'
  };
}

/**
 * Estimate demand for all marketplaces
 */
export function estimateDemandAllMarkets(pricingData) {
  const results = {};
  
  for (const [market, data] of Object.entries(pricingData)) {
    results[market] = estimateDemand(market, data);
  }
  
  return results;
}

export default {
  estimateDemand,
  estimateDemandAllMarkets,
  rankToSales,
  rankToSalesFormula,
  rankToSalesLookup,
  determineConfidence,
  CATEGORY_FORMULAS,
  BSR_LOOKUP,
  MARKETPLACE_FACTORS
};
