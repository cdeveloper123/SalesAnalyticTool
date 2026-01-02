/**
 * HS Code Service
 * 
 * Provides HS (Harmonized System) code lookup and mapping:
 * - Category → HS Code mapping for common product categories
 * - Product-specific HS code lookup
 * - HS code validation
 * 
 * HS codes are internationally standardized 6-10 digit codes used for:
 * - Customs classification
 * - Import duty calculation
 * - Trade statistics
 */

// Category to HS Code mapping
// HS codes are 6-digit minimum (international), can be 8-10 for country-specific
// Source: WCO HS Nomenclature 2022, US HTS, EU TARIC
const CATEGORY_TO_HS_CODE = {
  // Electronics (Chapter 85)
  'Electronics': '8543709099',           // Other electrical machines/apparatus
  'electronics': '8543709099',
  'Computers & Accessories': '8471300000', // Portable automatic data processing machines
  'computers': '8471300000',
  'Headphones': '8518300000',             // Headphones and earphones
  'headphones': '8518300000',
  'Speakers': '8518210000',               // Single loudspeakers
  'speakers': '8518210000',
  'Smart Home': '8543709099',             // Other electrical apparatus
  'smart_home': '8543709099',
  'Cameras': '8525890000',                // Television cameras, digital cameras
  'cameras': '8525890000',
  
  // Video Games (Chapter 95)
  'Video Games': '9504500000',            // Video game consoles and machines
  'video_games': '9504500000',
  'Gaming Accessories': '9504500000',
  'gaming': '9504500000',
  
  // Toys & Games (Chapter 95)
  'Toys & Games': '9503009900',           // Other toys
  'toys_games': '9503009900',
  'Toys': '9503009900',
  'Board Games': '9504909000',            // Other games
  'Puzzles': '9503006000',                // Puzzles
  
  // Clothing & Apparel (Chapter 61-62)
  'Clothing, Shoes & Jewelry': '6109100010', // T-shirts, singlets (cotton)
  'Clothing': '6109100010',
  'clothing_apparel': '6109100010',
  'T-Shirts': '6109100010',
  'Jackets': '6201930000',                // Men's anoraks, windbreakers
  'Dresses': '6204440000',                // Women's dresses
  
  // Footwear (Chapter 64)
  'Shoes': '6404199000',                  // Other footwear with textile uppers
  'footwear': '6404199000',
  'Sneakers': '6404110000',               // Sports footwear
  'Boots': '6403990000',                  // Other footwear with leather uppers
  
  // Home & Kitchen (Chapter 39, 69, 73, 82, 94)
  'Home & Kitchen': '8215990000',         // Kitchen/tableware articles
  'kitchen': '8215990000',
  'Cookware': '7323930000',               // Table, kitchen articles of stainless steel
  'Storage': '3924100000',                // Plastic tableware/kitchenware
  'Bedding': '6302100000',                // Bed linen, knitted
  
  // Garden & Outdoor (Chapter 82, 94)
  'Garden & Outdoor': '8201600000',       // Hedge shears, pruning shears
  'home_garden': '8201600000',
  'Furniture': '9403600000',              // Other wooden furniture
  'furniture': '9403600000',
  'Outdoor Furniture': '9401710000',      // Upholstered seats with metal frames
  
  // Sports & Outdoors (Chapter 42, 95)
  'Sports & Outdoors': '9506990000',      // Other articles for sports
  'sports_outdoors': '9506990000',
  'Fitness Equipment': '9506911000',       // Fitness articles
  'Camping': '6306220000',                // Tents
  
  // Health & Beauty (Chapter 33)
  'Health & Beauty': '3304990000',        // Other beauty/makeup preparations
  'health_beauty': '3304990000',
  'Skincare': '3304990000',
  'Haircare': '3305900000',               // Other hair preparations
  
  // Pet Supplies (Chapter 42, 94)
  'Pet Supplies': '4201000000',           // Saddlery and harness (includes collars, leashes)
  'pet_supplies': '4201000000',
  
  // Automotive (Chapter 87)
  'Automotive': '8708999700',             // Other parts/accessories of motor vehicles
  'automotive': '8708999700',
  
  // Jewelry & Watches (Chapter 71)
  'Jewelry': '7117190000',                // Other imitation jewelry
  'jewelry': '7117190000',
  'Watches': '9102110000',                // Wrist watches, electrically operated
  'watches': '9102110000',
  
  // Books & Media (Chapter 49)
  'Books': '4901990000',                  // Other printed books
  'books_media': '4901990000',
  
  // Musical Instruments (Chapter 92)
  'Musical Instruments': '9207900000',    // Other musical instruments
  'musical_instruments': '9207900000',
  
  // Mobile Phones (Chapter 85)
  'Cell Phones & Accessories': '8517120090', // Telephones for cellular networks
  'mobile_phones': '8517120090',
  'Phone Cases': '4202320000',            // Cases with plastic/textile outer
};

// Product name keywords to HS code mapping (for better matching)
const PRODUCT_KEYWORDS_TO_HS = {
  // Gaming
  'nintendo': '9504500000',
  'playstation': '9504500000',
  'xbox': '9504500000',
  'switch': '9504500000',
  'pokemon': '9504500000',
  'controller': '9504500000',
  
  // Electronics
  'iphone': '8517120090',
  'samsung': '8517120090',
  'airpods': '8518300000',
  'headphone': '8518300000',
  'earbuds': '8518300000',
  'speaker': '8518210000',
  'laptop': '8471300000',
  'macbook': '8471300000',
  'tablet': '8471300000',
  'ipad': '8471300000',
  'camera': '8525890000',
  'gopro': '8525890000',
  'drone': '8806100000',
  
  // Toys
  'lego': '9503003500',
  'barbie': '9503002100',
  'action figure': '9503002900',
  'plush': '9503004100',
  
  // Clothing
  'shirt': '6109100010',
  't-shirt': '6109100010',
  'jacket': '6201930000',
  'dress': '6204440000',
  'jeans': '6203424000',
  'sneaker': '6404110000',
  'boot': '6403990000',
};

/**
 * Get HS code for a product category
 * @param {string} category - Product category
 * @returns {string|null} HS code or null if not found
 */
export function getHSCodeByCategory(category) {
  if (!category) return null;
  
  // Direct lookup
  const hsCode = CATEGORY_TO_HS_CODE[category];
  if (hsCode) return hsCode;
  
  // Try lowercase
  const lowerCategory = category.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return CATEGORY_TO_HS_CODE[lowerCategory] || null;
}

/**
 * Get HS code by product name using keyword matching
 * @param {string} productName - Product name/title
 * @returns {string|null} HS code or null if not matched
 */
export function getHSCodeByProductName(productName) {
  if (!productName) return null;
  
  const lowerName = productName.toLowerCase();
  
  // Check each keyword
  for (const [keyword, hsCode] of Object.entries(PRODUCT_KEYWORDS_TO_HS)) {
    if (lowerName.includes(keyword)) {
      return hsCode;
    }
  }
  
  return null;
}

/**
 * Get HS code with priority: productName > category > default
 * @param {string} category - Product category
 * @param {string} productName - Product name
 * @returns {object} { hsCode, source }
 */
export function lookupHSCode(category, productName) {
  // Priority 1: Product name keyword match
  const productHSCode = getHSCodeByProductName(productName);
  if (productHSCode) {
    return {
      hsCode: productHSCode,
      source: 'product_name',
      confidence: 'high'
    };
  }
  
  // Priority 2: Category mapping
  const categoryHSCode = getHSCodeByCategory(category);
  if (categoryHSCode) {
    return {
      hsCode: categoryHSCode,
      source: 'category',
      confidence: 'medium'
    };
  }
  
  // Priority 3: Default (general merchandise)
  return {
    hsCode: '9999000000',  // Miscellaneous goods
    source: 'default',
    confidence: 'low'
  };
}

/**
 * Validate HS code format
 * @param {string} hsCode - HS code to validate
 * @returns {object} { valid, cleaned, error }
 */
export function validateHSCode(hsCode) {
  if (!hsCode) {
    return { valid: false, error: 'HS code is required' };
  }
  
  // Remove spaces, dots, hyphens
  const cleaned = String(hsCode).replace(/[\s.\-]/g, '');
  
  // Must be 6-10 digits
  if (!/^\d{6,10}$/.test(cleaned)) {
    return { valid: false, error: 'HS code must be 6-10 digits' };
  }
  
  return { valid: true, cleaned };
}

/**
 * Get HS code description (first 4 digits = chapter/heading)
 * @param {string} hsCode - HS code
 * @returns {object} { chapter, heading, description }
 */
export function getHSCodeInfo(hsCode) {
  const validation = validateHSCode(hsCode);
  if (!validation.valid) return null;
  
  const code = validation.cleaned;
  const chapter = code.substring(0, 2);
  const heading = code.substring(0, 4);
  
  // Common chapter descriptions
  const chapters = {
    '33': 'Essential oils and resinoids; perfumery, cosmetic preparations',
    '39': 'Plastics and articles thereof',
    '42': 'Articles of leather; saddlery and harness; travel goods',
    '49': 'Printed books, newspapers, pictures',
    '61': 'Articles of apparel, knitted or crocheted',
    '62': 'Articles of apparel, not knitted or crocheted',
    '64': 'Footwear, gaiters and the like',
    '69': 'Ceramic products',
    '71': 'Natural or cultured pearls, precious stones, jewelry',
    '73': 'Articles of iron or steel',
    '82': 'Tools, implements, cutlery of base metal',
    '84': 'Nuclear reactors, boilers, machinery, mechanical appliances',
    '85': 'Electrical machinery and equipment',
    '87': 'Vehicles other than railway or tramway',
    '91': 'Clocks and watches',
    '92': 'Musical instruments',
    '94': 'Furniture; bedding, mattresses',
    '95': 'Toys, games and sports requisites',
  };
  
  return {
    chapter,
    heading,
    fullCode: code,
    chapterDescription: chapters[chapter] || 'Other goods',
  };
}

export default {
  getHSCodeByCategory,
  getHSCodeByProductName,
  lookupHSCode,
  validateHSCode,
  getHSCodeInfo,
  CATEGORY_TO_HS_CODE,
};
