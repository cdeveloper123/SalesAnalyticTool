/**
 * Compliance Service
 * 
 * Detects selling restrictions and compliance requirements for products.
 * 
 * Checks for:
 * - Brand gating (restricted brands requiring approval)
 * - Transparency program requirements
 * - Category restrictions
 * - Hazmat/dangerous goods flags
 */

// ============================================================================
// GATED BRANDS DATABASE
// ============================================================================

/**
 * List of commonly gated brands on Amazon
 * These require approval or invoices from authorized distributors
 * 
 * Note: This is not exhaustive - Amazon adds/removes brands regularly
 */
const GATED_BRANDS = {
  // Gaming & Electronics
  'nintendo': { severity: 'high', requiresInvoice: true, category: 'Video Games' },
  'sony': { severity: 'high', requiresInvoice: true, category: 'Electronics' },
  'playstation': { severity: 'high', requiresInvoice: true, category: 'Video Games' },
  'xbox': { severity: 'medium', requiresInvoice: true, category: 'Video Games' },
  'microsoft': { severity: 'medium', requiresInvoice: true, category: 'Electronics' },
  'apple': { severity: 'high', requiresInvoice: true, category: 'Electronics' },
  'samsung': { severity: 'medium', requiresInvoice: true, category: 'Electronics' },
  'bose': { severity: 'high', requiresInvoice: true, category: 'Electronics' },
  'beats': { severity: 'high', requiresInvoice: true, category: 'Electronics' },
  'gopro': { severity: 'high', requiresInvoice: true, category: 'Electronics' },
  
  // Toys & Games
  'lego': { severity: 'high', requiresInvoice: true, category: 'Toys' },
  'hasbro': { severity: 'medium', requiresInvoice: true, category: 'Toys' },
  'mattel': { severity: 'medium', requiresInvoice: true, category: 'Toys' },
  'barbie': { severity: 'medium', requiresInvoice: true, category: 'Toys' },
  'hot wheels': { severity: 'medium', requiresInvoice: true, category: 'Toys' },
  'nerf': { severity: 'medium', requiresInvoice: true, category: 'Toys' },
  'pokemon': { severity: 'high', requiresInvoice: true, category: 'Toys' },
  'funko': { severity: 'medium', requiresInvoice: true, category: 'Toys' },
  
  // Fashion & Apparel
  'nike': { severity: 'high', requiresInvoice: true, category: 'Apparel' },
  'adidas': { severity: 'high', requiresInvoice: true, category: 'Apparel' },
  'under armour': { severity: 'high', requiresInvoice: true, category: 'Apparel' },
  'puma': { severity: 'medium', requiresInvoice: true, category: 'Apparel' },
  'new balance': { severity: 'medium', requiresInvoice: true, category: 'Apparel' },
  'reebok': { severity: 'medium', requiresInvoice: true, category: 'Apparel' },
  'north face': { severity: 'high', requiresInvoice: true, category: 'Apparel' },
  'patagonia': { severity: 'high', requiresInvoice: true, category: 'Apparel' },
  
  // Beauty & Personal Care
  'loreal': { severity: 'medium', requiresInvoice: true, category: 'Beauty' },
  'maybelline': { severity: 'medium', requiresInvoice: true, category: 'Beauty' },
  'olay': { severity: 'medium', requiresInvoice: true, category: 'Beauty' },
  'neutrogena': { severity: 'medium', requiresInvoice: true, category: 'Beauty' },
  'dove': { severity: 'low', requiresInvoice: true, category: 'Beauty' },
  
  // Home & Kitchen
  'dyson': { severity: 'high', requiresInvoice: true, category: 'Home' },
  'kitchenaid': { severity: 'medium', requiresInvoice: true, category: 'Home' },
  'instant pot': { severity: 'medium', requiresInvoice: true, category: 'Home' },
  'vitamix': { severity: 'high', requiresInvoice: true, category: 'Home' },
  'yeti': { severity: 'high', requiresInvoice: true, category: 'Home' },
  
  // Sports & Outdoors
  'callaway': { severity: 'medium', requiresInvoice: true, category: 'Sports' },
  'titleist': { severity: 'medium', requiresInvoice: true, category: 'Sports' },
  'taylormade': { severity: 'medium', requiresInvoice: true, category: 'Sports' },
  'wilson': { severity: 'low', requiresInvoice: true, category: 'Sports' },
  
  // Health & Supplements
  'ensure': { severity: 'medium', requiresInvoice: true, category: 'Health' },
  'centrum': { severity: 'medium', requiresInvoice: true, category: 'Health' },
  'nature made': { severity: 'low', requiresInvoice: true, category: 'Health' }
};

// ============================================================================
// TRANSPARENCY PROGRAM BRANDS
// ============================================================================

/**
 * Brands enrolled in Amazon Transparency program
 * Each unit requires a unique Transparency code
 */
const TRANSPARENCY_BRANDS = [
  'bose',
  'beats',
  'gopro',
  'anker',
  'otterbox',
  'spigen',
  'belkin',
  'logitech',
  'razer',
  'corsair'
];

// ============================================================================
// RESTRICTED CATEGORIES
// ============================================================================

/**
 * Categories requiring approval to sell
 */
const RESTRICTED_CATEGORIES = {
  'Grocery & Gourmet Food': { 
    requiresApproval: true, 
    difficulty: 'medium',
    notes: 'Requires FDA compliance for food items'
  },
  'Health & Personal Care': { 
    requiresApproval: true, 
    difficulty: 'medium',
    notes: 'May require FDA registration'
  },
  'Beauty': { 
    requiresApproval: true, 
    difficulty: 'low',
    notes: 'Some subcategories restricted'
  },
  'Jewelry': { 
    requiresApproval: true, 
    difficulty: 'high',
    notes: 'Requires professional seller account'
  },
  'Watches': { 
    requiresApproval: true, 
    difficulty: 'high',
    notes: 'High-value items require approval'
  },
  'Fine Art': { 
    requiresApproval: true, 
    difficulty: 'high',
    notes: 'By invitation only'
  },
  'Collectible Coins': { 
    requiresApproval: true, 
    difficulty: 'high',
    notes: 'Strict authentication requirements'
  }
};

// ============================================================================
// HAZMAT KEYWORDS
// ============================================================================

/**
 * Keywords that indicate potential hazmat classification
 */
const HAZMAT_KEYWORDS = [
  'battery',
  'lithium',
  'aerosol',
  'spray',
  'flammable',
  'pressurized',
  'alcohol',
  'nail polish',
  'perfume',
  'cologne',
  'sanitizer',
  'bleach',
  'ammonia',
  'lighter',
  'matches'
];

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Check brand gating status
 */
export function checkBrandGating(brand) {
  if (!brand) return null;
  
  const normalizedBrand = brand.toLowerCase().trim();
  
  // Check exact match
  if (GATED_BRANDS[normalizedBrand]) {
    return {
      isGated: true,
      ...GATED_BRANDS[normalizedBrand],
      brand: brand
    };
  }
  
  // Check partial match (brand might be part of longer name)
  for (const [gatedBrand, info] of Object.entries(GATED_BRANDS)) {
    if (normalizedBrand.includes(gatedBrand) || gatedBrand.includes(normalizedBrand)) {
      return {
        isGated: true,
        ...info,
        brand: brand,
        matchedBrand: gatedBrand
      };
    }
  }
  
  return {
    isGated: false,
    brand: brand
  };
}

/**
 * Check if brand requires Transparency codes
 */
export function checkTransparencyRequirement(brand) {
  if (!brand) return false;
  
  const normalizedBrand = brand.toLowerCase().trim();
  
  for (const tBrand of TRANSPARENCY_BRANDS) {
    if (normalizedBrand.includes(tBrand) || tBrand.includes(normalizedBrand)) {
      return {
        requiresTransparency: true,
        brand: brand,
        notes: 'Each unit requires a unique Transparency code from the brand owner'
      };
    }
  }
  
  return {
    requiresTransparency: false,
    brand: brand
  };
}

/**
 * Check category restrictions
 */
export function checkCategoryRestrictions(category) {
  if (!category) return null;
  
  // Check exact match
  if (RESTRICTED_CATEGORIES[category]) {
    return {
      isRestricted: true,
      ...RESTRICTED_CATEGORIES[category],
      category: category
    };
  }
  
  // Check partial match
  for (const [restrictedCat, info] of Object.entries(RESTRICTED_CATEGORIES)) {
    if (category.toLowerCase().includes(restrictedCat.toLowerCase())) {
      return {
        isRestricted: true,
        ...info,
        category: category,
        matchedCategory: restrictedCat
      };
    }
  }
  
  return {
    isRestricted: false,
    category: category
  };
}

/**
 * Check for potential hazmat classification
 */
export function checkHazmatRisk(productTitle, category) {
  if (!productTitle) return { isHazmat: false };
  
  const lowerTitle = productTitle.toLowerCase();
  const lowerCategory = (category || '').toLowerCase();
  
  const matchedKeywords = [];
  
  for (const keyword of HAZMAT_KEYWORDS) {
    if (lowerTitle.includes(keyword) || lowerCategory.includes(keyword)) {
      matchedKeywords.push(keyword);
    }
  }
  
  if (matchedKeywords.length > 0) {
    return {
      isHazmat: true,
      riskLevel: matchedKeywords.length >= 2 ? 'high' : 'medium',
      matchedKeywords,
      notes: 'Product may require hazmat classification. Higher FBA fees and storage restrictions may apply.'
    };
  }
  
  return {
    isHazmat: false
  };
}

/**
 * Get complete compliance check for a product
 */
export function getComplianceFlags(productData) {
  const { title, brand, category } = productData || {};
  
  const brandGating = checkBrandGating(brand);
  const transparency = checkTransparencyRequirement(brand);
  const categoryRestriction = checkCategoryRestrictions(category);
  const hazmat = checkHazmatRisk(title, category);
  
  // Compile all flags
  const flags = [];
  
  if (brandGating?.isGated) {
    flags.push({
      type: 'BRAND_GATED',
      severity: brandGating.severity,
      title: 'Brand Gated',
      description: `${brand} is a gated brand on Amazon. Requires approval and invoices from authorized distributors.`,
      action: 'Apply for brand approval or source from authorized distributor'
    });
  }
  
  if (transparency?.requiresTransparency) {
    flags.push({
      type: 'TRANSPARENCY_REQUIRED',
      severity: 'high',
      title: 'Transparency Required',
      description: `${brand} requires Amazon Transparency codes on each unit.`,
      action: 'Contact brand owner for Transparency codes'
    });
  }
  
  if (categoryRestriction?.isRestricted) {
    flags.push({
      type: 'CATEGORY_RESTRICTED',
      severity: categoryRestriction.difficulty === 'high' ? 'high' : 'medium',
      title: 'Category Approval Required',
      description: `${category} requires Amazon approval to sell.`,
      action: 'Apply for category approval in Seller Central',
      notes: categoryRestriction.notes
    });
  }
  
  if (hazmat?.isHazmat) {
    flags.push({
      type: 'HAZMAT_RISK',
      severity: hazmat.riskLevel,
      title: 'Potential Hazmat',
      description: `Product may require hazmat classification.`,
      action: 'Submit for hazmat review before sending to FBA',
      matchedKeywords: hazmat.matchedKeywords
    });
  }
  
  // Calculate overall compliance risk
  const highSeverityCount = flags.filter(f => f.severity === 'high').length;
  const mediumSeverityCount = flags.filter(f => f.severity === 'medium').length;
  
  let overallRisk = 'low';
  if (highSeverityCount >= 1) {
    overallRisk = 'high';
  } else if (mediumSeverityCount >= 2) {
    overallRisk = 'medium';
  } else if (mediumSeverityCount >= 1 || flags.length > 0) {
    overallRisk = 'medium';
  }
  
  return {
    flags,
    flagCount: flags.length,
    overallRisk,
    canSell: highSeverityCount === 0,
    canSellWithApproval: flags.length === 0 || !flags.some(f => f.type === 'TRANSPARENCY_REQUIRED'),
    summary: flags.length === 0 
      ? 'No compliance issues detected'
      : `${flags.length} compliance issue(s) detected - ${overallRisk} risk`
  };
}

export default {
  checkBrandGating,
  checkTransparencyRequirement,
  checkCategoryRestrictions,
  checkHazmatRisk,
  getComplianceFlags,
  GATED_BRANDS,
  TRANSPARENCY_BRANDS,
  RESTRICTED_CATEGORIES
};
