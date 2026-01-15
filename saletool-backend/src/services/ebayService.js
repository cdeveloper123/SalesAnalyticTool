/**
 * eBay Service - Browse API & Finding API Integration
 * 
 * Provides:
 * - Product pricing from eBay
 * - Completed/sold item data
 * - Sales volume estimation
 */

import eBayApi from 'ebay-api';
import dotenv from 'dotenv';
import currencyService from './currencyService.js';

dotenv.config();

// Simple in-memory cache to prevent hitting rate limits
const apiCache = new Map();
const CACHE_TTL = 3600 * 1000; // 1 hour caching

// ============================================================================
// CONFIGURATION
// ============================================================================

const eBay = new eBayApi({
  appId: process.env.EBAY_APP_ID,
  certId: process.env.EBAY_CERT_ID,
  devId: process.env.EBAY_DEV_ID,
  sandbox: false, // Use production
  siteId: eBayApi.SiteId.EBAY_US // Default to US
});

// Marketplace to eBay Site ID mapping
const MARKETPLACE_SITE_IDS = {
  US: eBayApi.SiteId.EBAY_US,
  UK: eBayApi.SiteId.EBAY_GB,
  DE: eBayApi.SiteId.EBAY_DE,
  FR: eBayApi.SiteId.EBAY_FR,
  IT: eBayApi.SiteId.EBAY_IT,
  ES: eBayApi.SiteId.EBAY_ES,
  CA: eBayApi.SiteId.EBAY_ENCA,
  AU: eBayApi.SiteId.EBAY_AU
};

// eBay fee structure (2025 rates - effective Feb 14, 2025)
// Payment processing is now INCLUDED in Final Value Fee
const EBAY_FEES = {
  US: {
    insertionFee: 0, // Free for most categories
    finalValueFee: 0.1325, // 13.25% (includes payment processing as of 2025)
    perOrderFee: 0.30 // $0.30 per order
  },
  UK: {
    insertionFee: 0,
    finalValueFee: 0.1325, // 13.25%
    perOrderFee: 0.30 // £0.30 per order
  },
  DE: {
    insertionFee: 0,
    finalValueFee: 0.1325, // 13.25%
    perOrderFee: 0.30 // €0.30 per order
  },
  FR: {
    insertionFee: 0,
    finalValueFee: 0.1325, // 13.25%
    perOrderFee: 0.30 // €0.30 per order
  },
  IT: {
    insertionFee: 0,
    finalValueFee: 0.1325, // 13.25%
    perOrderFee: 0.30 // €0.30 per order
  },
  AU: {
    insertionFee: 0,
    finalValueFee: 0.1325, // 13.25%
    perOrderFee: 0.30 // A$0.30 per order
  }
};

// ============================================================================
// AUTHENTICATION
// ============================================================================

let authToken = null;
let tokenExpiry = null;

/**
 * Get OAuth2 application access token (Client Credentials flow)
 */
async function getAuthToken() {
  // Check if we have a valid cached token
  if (authToken && tokenExpiry && Date.now() < tokenExpiry) {
    return authToken;
  }

  try {
    // Get application access token using client credentials
    const token = await eBay.oauth2.getApplicationToken('PRODUCTION');

    authToken = token;
    // eBay application tokens typically last 2 hours
    tokenExpiry = Date.now() + (7200 * 1000); // 2 hours

    console.log('[eBayService] OAuth token obtained successfully');
    return authToken;
  } catch (error) {
    console.error('[eBayService] OAuth error:', error.message);
    throw new Error('Failed to authenticate with eBay API: ' + error.message);
  }
}

// ============================================================================
// BROWSE API - Current Listings
// ============================================================================

/**
 * Search for active listings by EAN/UPC/GTIN
 */
export async function searchByEAN(ean, marketplace = 'US') {
  const cacheKey = `search_${marketplace}_${ean}`;
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const siteId = MARKETPLACE_SITE_IDS[marketplace] || eBayApi.SiteId.EBAY_US;

    // eBay accepts EAN-13, UPC-12, ISBN
    const results = await eBay.buy.browse.search({
      gtin: ean, // Use GTIN filter for barcode search
      limit: 50,
      filter: 'buyingOptions:{FIXED_PRICE}'
    });

    if (!results || !results.itemSummaries) {
      return [];
    }

    const mappedResults = results.itemSummaries.map(item => ({
      title: item.title,
      price: Number(item.price?.value) || 0,  // Convert string to number
      currency: item.price?.currency || 'USD',
      itemId: item.itemId,
      categoryName: item.categories?.[0]?.categoryName || 'Unknown',
      condition: item.condition,
      seller: {
        username: item.seller?.username,
        feedbackPercentage: item.seller?.feedbackPercentage
      },
      shippingCost: Number(item.shippingOptions?.[0]?.shippingCost?.value) || 0,
      itemWebUrl: item.itemWebUrl,
      ean: ean
    }));

    apiCache.set(cacheKey, { data: mappedResults, timestamp: Date.now() });
    return mappedResults;
  } catch (error) {
    console.error('[eBayService] Browse API (EAN) error:', error.message);
    return [];
  }
}

/**
 * Search for active listings by keyword (fallback)
 */
export async function searchByKeyword(keyword, marketplace = 'US') {
  const cacheKey = `search_kw_${marketplace}_${keyword}`;
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const siteId = MARKETPLACE_SITE_IDS[marketplace] || eBayApi.SiteId.EBAY_US;

    const results = await eBay.buy.browse.search({
      q: keyword,
      limit: 20,
      filter: 'buyingOptions:{FIXED_PRICE}'
    });

    if (!results || !results.itemSummaries) {
      return [];
    }
    const mappedResults = results.itemSummaries.map(item => ({
      title: item.title,
      price: item.price?.value || 0,
      currency: item.price?.currency || 'USD',
      itemId: item.itemId,
      condition: item.condition,
      seller: {
        username: item.seller?.username,
        feedbackPercentage: item.seller?.feedbackPercentage
      },
      shippingCost: item.shippingOptions?.[0]?.shippingCost?.value || 0,
      itemWebUrl: item.itemWebUrl
    }));

    apiCache.set(cacheKey, { data: mappedResults, timestamp: Date.now() });
    return mappedResults;
  } catch (error) {
    console.error('[eBayService] Browse API error:', error.message);
    return [];
  }
}

/**
 * Get item details by item ID (with GTIN extraction)
 */
export async function getItemDetails(itemId) {
  try {
    const item = await eBay.buy.browse.getItem({
      item_id: itemId
    });

    // Extract GTIN - check multiple possible fields
    let gtin = null;
    let gtinType = null;

    // Method 1: Direct gtin field (array format)
    if (item.gtin && Array.isArray(item.gtin) && item.gtin.length > 0) {
      gtin = item.gtin[0].gtinValue || item.gtin[0];
      gtinType = item.gtin[0].gtinType || 'GTIN';
    }
    // Method 2: Single gtin field
    else if (item.gtin && typeof item.gtin === 'string') {
      gtin = item.gtin;
      gtinType = 'GTIN';
    }
    // Method 3: inferredGtin (eBay's guess)
    else if (item.inferredGtin) {
      gtin = item.inferredGtin;
      gtinType = 'Inferred';
    }
    // Method 4: product.epid (eBay Product ID)
    else if (item.product?.epid) {
      gtin = item.product.epid;
      gtinType = 'EPID';
    }

    return {
      itemId,
      title: item.title,
      price: item.price?.value || 0,
      currency: item.price?.currency || 'USD',
      condition: item.condition,
      categoryPath: item.categoryPath,
      seller: item.seller,
      description: item.shortDescription,
      images: item.image?.imageUrl || [],
      gtin,
      gtinType,
      hasGtin: !!gtin,
      brand: item.brand,
      mpn: item.mpn // Manufacturer Part Number
    };
  } catch (error) {
    if (error.message.includes('not found')) {
      console.warn('[eBayService] Item details not found (item may have ended), using search info instead');
    } else {
      console.error('[eBayService] Get item error:', error.message);
    }
    return null;
  }
}

// ============================================================================
// FINDING API - Completed/Sold Items
// ============================================================================

/**
 * Find completed (sold) items to estimate demand
 */
export async function findCompletedItems(keyword, marketplace = 'US', ean = null) {
  const cacheKey = `sold_${marketplace}_${ean || keyword}`;
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const siteId = MARKETPLACE_SITE_IDS[marketplace] || eBayApi.SiteId.EBAY_US;

    // Prepare request parameters
    const params = {
      'itemFilter(0).name': 'SoldItemsOnly',
      'itemFilter(0).value': 'true',
      'sortOrder': 'EndTimeSoonest',
      'paginationInput.entriesPerPage': 100
    };

    // If EAN is provided, use it for precise matching
    if (ean) {
      params.productId = {
        '@type': 'ReferenceID',
        '#text': ean
      };
    } else {
      params.keywords = keyword;
    }

    const results = await eBay.finding.findCompletedItems(params);

    if (!results || !results[0]?.searchResult?.[0]?.item) {
      return { items: [], averagePrice: 0, soldCount: 0 };
    }

    const items = results[0].searchResult[0].item.map(item => ({
      title: item.title?.[0],
      soldPrice: parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0),
      currency: item.sellingStatus?.[0]?.currentPrice?.[0]?.['@currencyId'] || 'USD',
      soldDate: item.listingInfo?.[0]?.endTime?.[0],
      condition: item.condition?.[0]?.conditionDisplayName?.[0]
    }));

    const soldPrices = items.map(i => i.soldPrice).filter(p => p > 0);
    const averagePrice = soldPrices.length > 0
      ? soldPrices.reduce((a, b) => a + b, 0) / soldPrices.length
      : 0;

    return {
      items,
      averagePrice: Number(averagePrice.toFixed(2)),
      soldCount: items.length,
      priceRange: {
        min: Math.min(...soldPrices),
        max: Math.max(...soldPrices)
      }
    };

    apiCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('[eBayService] Finding API error:', error.message);
    return { items: [], averagePrice: 0, soldCount: 0 };
  }
}

// ============================================================================
// PRICING & DEMAND ESTIMATION
// ============================================================================

/**
 * Get eBay pricing and demand data for a product by EAN
 */
export async function getProductPricingByEAN(ean, marketplace = 'US') {
  try {
    // Search by EAN
    const activeListings = await searchByEAN(ean, marketplace);

    if (activeListings.length === 0) {
      console.warn('[eBayService] No listings found for EAN:', ean);
      return null;
    }

    // Calculate average active price (API returns USD)
    const activePrices = activeListings.map(l => l.price).filter(p => p > 0);

    if (activePrices.length === 0) {
      console.warn('[eBayService] No valid prices found for EAN:', ean);
      return null;
    }

    const avgActivePriceUSD = activePrices.reduce((a, b) => a + b, 0) / activePrices.length;

    // Convert USD price to local marketplace currency
    const targetCurrency = currencyService.getCurrencyForMarketplace(marketplace);
    const avgActivePrice = currencyService.convert(avgActivePriceUSD, 'USD', targetCurrency);
    const minPrice = currencyService.convert(Math.min(...activePrices), 'USD', targetCurrency);
    const maxPrice = currencyService.convert(Math.max(...activePrices), 'USD', targetCurrency);

    // Get completed/sold items to estimate REAL demand
    let soldData = { soldCount: 0, averagePrice: 0 };

    // Prioritize EAN-based sales search, fall back to title if no results or EAN search fails
    try {
      soldData = await findCompletedItems(null, marketplace, ean);

      // If EAN search found nothing, try searching by title
      if (soldData.soldCount === 0 && activeListings[0]?.title) {
        soldData = await findCompletedItems(activeListings[0].title, marketplace);
      }
    } catch (e) {
      console.warn('[eBayService] Sales search error:', e.message);
      if (activeListings[0]?.title) {
        soldData = await findCompletedItems(activeListings[0].title, marketplace);
      }
    }

    // Estimate monthly sales
    let estimatedMonthlySales;

    if (soldData.soldCount > 0) {
      // Method A: Dynamic Data (Preferred)
      // Avg sold count represents recent history (typically 7-90 days depending on volume)
      // We extrapolate to 30 days based on the typical return window of the Finding API (approx 90 days max, but often less for high volume)
      // A conservative estimate is raw sold count * 0.5 (assuming ~60 days data) or just raw count if low volume
      estimatedMonthlySales = Math.round(soldData.soldCount * 0.4);
    } else {
      // Method B: Heuristic Fallback (Original Logic)
      // MARKET SIZE FACTORS (relative to US baseline)
      const marketFactors = {
        US: 1.5,   // Largest market
        UK: 1.0,   // Medium market  
        DE: 1.2,   // Large EU market
        FR: 0.8,   // Medium EU market
        IT: 0.6,   // Smaller EU market
        AU: 0.5    // Smaller market
      };

      // CATEGORY/PRICE TIER MULTIPLIERS (inferred from price)
      let categoryMultiplier = 1.0;
      if (avgActivePrice > 100) {
        categoryMultiplier = 1.5; // High-value items (electronics, gaming)
      } else if (avgActivePrice > 50) {
        categoryMultiplier = 1.2; // Mid-value items
      } else if (avgActivePrice < 10) {
        categoryMultiplier = 0.6; // Low-value items (lower volume)
      }

      // COMPETITION FACTOR (more listings = higher total market demand)
      let competitionFactor = 1.0;
      if (activeListings.length > 20) {
        competitionFactor = 2.0; // High competition = high demand market
      } else if (activeListings.length > 10) {
        competitionFactor = 1.5;
      } else if (activeListings.length > 5) {
        competitionFactor = 1.2;
      } else if (activeListings.length <= 2) {
        competitionFactor = 0.8; // Very few listings = niche/low demand
      }

      // BASE FORMULA: listings × market × category × competition × base multiplier
      const marketFactor = marketFactors[marketplace] || 1.0;
      const baseMultiplier = 12; // Base units per listing
      const rawEstimate = activeListings.length * marketFactor * categoryMultiplier * competitionFactor * baseMultiplier;
      estimatedMonthlySales = Math.round(Math.min(rawEstimate, 800)); // Cap at 800
    }

    return {
      marketplace,
      ean,
      productTitle: activeListings[0]?.title || 'Unknown',
      buyBoxPrice: Number(avgActivePrice.toFixed(2)),
      activePriceRange: {
        min: Number(minPrice.toFixed(2)),
        max: Number(maxPrice.toFixed(2)),
        avg: Number(avgActivePrice.toFixed(2))
      },
      activeListings: activeListings.length,
      estimatedMonthlySales,
      confidence: soldData.soldCount > 0
        ? (soldData.soldCount > 20 ? 'High' : 'Medium')
        : (activeListings.length > 20 ? 'Medium' : 'Low'), // Higher confidence if we have real sold data
      currency: targetCurrency,
      soldLast90Days: soldData.soldCount, // Add this for transparency
      dataSource: 'live'
    };

  } catch (error) {
    console.error('[eBayService] Get pricing by EAN error:', error.message);
    return null;
  }
}

/**
 * Get eBay pricing and demand data for a product (legacy - keyword search)
 */
export async function getProductPricing(keyword, marketplace = 'US') {
  try {
    // Get active listings
    const activeListings = await searchByKeyword(keyword, marketplace);

    // Get sold items (last 30 days)
    const soldData = await findCompletedItems(keyword, marketplace);

    // Calculate average active price
    const activePrices = activeListings.map(l => l.price).filter(p => p > 0);
    const avgActivePrice = activePrices.length > 0
      ? activePrices.reduce((a, b) => a + b, 0) / activePrices.length
      : 0;

    // Estimate monthly sales (sold count is typically ~7-30 days)
    const estimatedMonthlySales = soldData.soldCount > 0
      ? Math.round(soldData.soldCount * 1.5) // Approximate 30-day extrapolation
      : 0;

    return {
      marketplace,
      buyBoxPrice: soldData.averagePrice || avgActivePrice || 0,
      activePriceRange: {
        min: Math.min(...activePrices),
        max: Math.max(...activePrices),
        avg: Number(avgActivePrice.toFixed(2))
      },
      soldPriceRange: soldData.priceRange,
      activeListings: activeListings.length,
      soldLast30Days: soldData.soldCount,
      estimatedMonthlySales,
      confidence: soldData.soldCount > 20 ? 'High' : soldData.soldCount > 5 ? 'Medium' : 'Low'
    };
  } catch (error) {
    console.error('[eBayService] Get pricing error:', error.message);
    return null;
  }
}

// ============================================================================
// FEE CALCULATION
// ============================================================================

/**
 * Calculate eBay fees for a sale (2025 rates)
 * Note: eBay EU prices are typically VAT-inclusive (same as Amazon)
 */
export function calculateEbayFees(sellPrice, marketplace = 'US') {
  const fees = EBAY_FEES[marketplace] || EBAY_FEES.US;

  // VAT/GST rates for markets where prices are tax-inclusive
  const VAT_RATES = { UK: 0.20, DE: 0.19, FR: 0.20, IT: 0.22, AU: 0.10 };
  const vatRate = VAT_RATES[marketplace] || 0;
  const vatAmount = vatRate > 0 ? sellPrice - (sellPrice / (1 + vatRate)) : 0;
  const priceExVat = sellPrice - vatAmount;

  const insertionFee = fees.insertionFee;
  const finalValueFee = sellPrice * fees.finalValueFee; // Includes payment processing
  const perOrderFee = fees.perOrderFee;

  const totalFees = insertionFee + finalValueFee + perOrderFee;
  const netProceeds = sellPrice - totalFees;

  return {
    sellPrice: Number(sellPrice.toFixed(2)),
    priceExVat: Number(priceExVat.toFixed(2)),  // Ex-VAT price for VAT-registered sellers
    insertionFee: Number(insertionFee.toFixed(2)),
    finalValueFee: Number(finalValueFee.toFixed(2)),
    perOrderFee: Number(perOrderFee.toFixed(2)),
    totalFees: Number(totalFees.toFixed(2)),
    netProceeds: Number(netProceeds.toFixed(2)),
    vat: Number(vatAmount.toFixed(2)),           // VAT amount for transparency
    vatRate: vatRate * 100,                      // VAT rate as percentage
    currency: ['DE', 'FR', 'IT'].includes(marketplace) ? 'EUR' : marketplace === 'UK' ? 'GBP' : marketplace === 'AU' ? 'AUD' : 'USD',
    marketplace: `eBay-${marketplace}`
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  searchByEAN,
  searchByKeyword,
  getItemDetails,
  findCompletedItems,
  getProductPricing,
  getProductPricingByEAN,
  calculateEbayFees,
  MARKETPLACE_SITE_IDS
};
