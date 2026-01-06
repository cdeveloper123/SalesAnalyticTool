/**
 * Currency Conversion Service with Live API
 * 
 * Uses freecurrencyapi.com for real-time exchange rates.
 * Includes caching to minimize API calls.
 * 
 * API: https://freecurrencyapi.com/
 */

import Freecurrencyapi from '@everapi/freecurrencyapi-js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_KEY = 'fca_live_Kd1sPCPR1qn1yQpet7hhkOdSTv5L7bcBZAy91LGN';
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour cache

// Initialize the API client
const currencyApi = new Freecurrencyapi(API_KEY);

// ============================================================================
// RATE CACHE
// ============================================================================

let ratesCache = {
  rates: null,
  lastUpdated: null,
  baseCurrency: 'USD'
};

// Fallback rates (used if API fails)
const FALLBACK_RATES = {
  USD: 1.00,
  EUR: 0.96,
  GBP: 0.80,
  CAD: 1.36,
  AUD: 1.53,
  JPY: 149.50,
  AED: 3.67,
  SAR: 3.75,
  SGD: 1.34,
  HKD: 7.82,
  INR: 83.50,
  BRL: 4.97,
  MXN: 17.15,
  CNY: 7.24
};

// ============================================================================
// CURRENCY METADATA
// ============================================================================

const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥',
  AED: 'AED',
  SAR: 'SAR',
  SGD: 'S$',
  HKD: 'HK$',
  INR: '₹',
  BRL: 'R$',
  MXN: 'MX$',
  CNY: '¥'
};

const MARKETPLACE_CURRENCIES = {
  US: 'USD',
  UK: 'GBP',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  CA: 'CAD',
  AU: 'AUD',
  JP: 'JPY',
  AE: 'AED',
  SA: 'SAR',
  SG: 'SGD',
  HK: 'HKD',
  IN: 'INR',
  BR: 'BRL',
  MX: 'MXN'
};

// ============================================================================
// RATE FETCHING
// ============================================================================

/**
 * Fetch latest exchange rates from API
 * Uses caching to minimize API calls
 */
async function fetchLatestRates() {
  const now = Date.now();
  
  // Return cached rates if still valid
  if (ratesCache.rates && ratesCache.lastUpdated && 
      (now - ratesCache.lastUpdated) < CACHE_DURATION_MS) {
    return ratesCache.rates;
  }
  
  try {
    console.log('[CurrencyService] Fetching latest exchange rates...');
    
    // Try API call without currencies parameter first (gets all available currencies)
    // This avoids validation errors with currency list format
    let response;
    try {
      response = await currencyApi.latest({
        base_currency: 'USD'
        // Don't specify currencies - API will return all available currencies
      });
    } catch (apiError) {
      console.error('[CurrencyService] API call failed:', apiError.message);
      throw apiError; // Re-throw to be caught by outer catch
    }
    
    // Check for error response (API returns error objects, not exceptions)
    // Error responses have 'errors' or 'message' field
    if (response && (response.errors || (response.message && !response.data))) {
      console.error('[CurrencyService] API returned error:', {
        message: response.message,
        errors: response.errors,
        info: response.info
      });
      // Don't update cache, will return fallback rates
      return FALLBACK_RATES;
    }
    
    // Check for successful response with data
    if (response && response.data && typeof response.data === 'object') {
      // API returns rates relative to base (USD)
      // e.g., { EUR: 0.92, GBP: 0.79, ... }
      const newRates = { USD: 1, ...response.data };
      ratesCache.rates = newRates;
      ratesCache.lastUpdated = now;
      ratesCache.baseCurrency = 'USD';
      
      // Verify cache was set correctly
      console.log('[CurrencyService] Rates updated successfully. Cache has', Object.keys(ratesCache.rates).length, 'currencies');
      console.log('[CurrencyService] Cache timestamp:', new Date(ratesCache.lastUpdated).toISOString());
      console.log('[CurrencyService] Cache verification:', { 
        hasRates: !!ratesCache.rates, 
        lastUpdated: ratesCache.lastUpdated,
        sampleRates: Object.keys(newRates).slice(0, 3)
      });
      return ratesCache.rates;
    } else {
      console.warn('[CurrencyService] API response invalid - no data:', response);
    }
  } catch (error) {
    console.error('[CurrencyService] API error, using fallback rates:', error.message);
  }
  
  // Return fallback rates if API fails
  return FALLBACK_RATES;
}

/**
 * Get current exchange rates (sync version using cache)
 * Triggers background refresh if cache is expired
 */
function getRatesSync() {
  // If cache exists and is still valid, use it
  if (ratesCache.rates && ratesCache.lastUpdated) {
    const now = Date.now();
    const isExpired = (now - ratesCache.lastUpdated) >= CACHE_DURATION_MS;
    
    if (!isExpired) {
      return ratesCache.rates;
    }
    
    // Cache expired - trigger background refresh (fire and forget)
    // Don't await - just trigger it so next call gets fresh rates
    fetchLatestRates().catch(err => {
      console.warn('[CurrencyService] Background refresh failed:', err.message);
    });
    
    // Return expired cache for now (better than fallback)
    return ratesCache.rates;
  }
  
  // No cache - try to fetch synchronously if possible, otherwise use fallback
  // Since we initialize on startup, this should rarely happen
  return FALLBACK_RATES;
}

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

/**
 * Convert amount from one currency to another (async - fetches live rates)
 */
export async function convertAsync(amount, fromCurrency, toCurrency) {
  if (!amount || amount <= 0) return 0;
  
  fromCurrency = fromCurrency.toUpperCase();
  toCurrency = toCurrency.toUpperCase();
  
  if (fromCurrency === toCurrency) return amount;
  
  const rates = await fetchLatestRates();
  
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  
  if (!fromRate || !toRate) {
    console.warn(`Unknown currency: ${fromCurrency} or ${toCurrency}`);
    return amount;
  }
  
  // Convert to USD first, then to target currency
  const amountInUSD = amount / fromRate;
  const amountInTarget = amountInUSD * toRate;
  
  return Number(amountInTarget.toFixed(2));
}

/**
 * Convert amount from one currency to another (sync - uses cached rates)
 */
export function convert(amount, fromCurrency, toCurrency) {
  if (!amount || amount <= 0) return 0;
  
  fromCurrency = fromCurrency.toUpperCase();
  toCurrency = toCurrency.toUpperCase();
  
  if (fromCurrency === toCurrency) return amount;
  
  const rates = getRatesSync();
  
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  
  if (!fromRate || !toRate) {
    console.warn(`Unknown currency: ${fromCurrency} or ${toCurrency}`);
    return amount;
  }
  
  const amountInUSD = amount / fromRate;
  const amountInTarget = amountInUSD * toRate;
  
  return Number(amountInTarget.toFixed(2));
}

/**
 * Convert to USD
 */
export function toUSD(amount, fromCurrency) {
  return convert(amount, fromCurrency, 'USD');
}

/**
 * Convert from USD to target currency
 */
export function fromUSD(amountUSD, toCurrency) {
  return convert(amountUSD, 'USD', toCurrency);
}

/**
 * Get currency for a marketplace
 */
export function getCurrencyForMarketplace(marketplace) {
  return MARKETPLACE_CURRENCIES[marketplace.toUpperCase()] || 'USD';
}

/**
 * Get exchange rate between two currencies
 */
export function getRate(fromCurrency, toCurrency) {
  fromCurrency = fromCurrency.toUpperCase();
  toCurrency = toCurrency.toUpperCase();
  
  if (fromCurrency === toCurrency) return 1;
  
  const rates = getRatesSync();
  const fromRate = rates[fromCurrency] || 1;
  const toRate = rates[toCurrency] || 1;
  
  return Number((toRate / fromRate).toFixed(4));
}

/**
 * Format amount with currency symbol
 */
export function format(amount, currency) {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] || currency;
  return `${symbol}${amount.toFixed(2)}`;
}

/**
 * Initialize rates (call on server startup)
 */
/**
 * Initialize rates (call on server startup)
 * Forces a fresh fetch from API, ignoring cache
 */
export async function initializeRates() {
  // Clear cache to force fresh API fetch
  const previousCache = ratesCache.rates;
  ratesCache.rates = null;
  ratesCache.lastUpdated = null;
  
  try {
    console.log('[CurrencyService] Initializing currency rates from API...');
    const rates = await fetchLatestRates();
    console.log('[CurrencyService] Rates:', rates);
    // Check if we got live rates (cache was updated) or fallback
    // If API succeeded, ratesCache will be updated with fresh data
    // If API failed, ratesCache remains null and fetchLatestRates returns FALLBACK_RATES
    if (ratesCache.rates && ratesCache.lastUpdated) {
      // Verify we didn't just get cached rates back
      const cacheAge = Date.now() - ratesCache.lastUpdated;
      if (cacheAge < 5000) { // Cache updated within last 5 seconds = fresh API fetch
        console.log('[CurrencyService] Initialized with live rates from API');
        return true;
      }
    }
    
    // API failed or returned fallback - restore previous cache if it existed
    if (previousCache) {
      ratesCache.rates = previousCache;
      console.warn('[CurrencyService] API fetch failed, restored previous cache');
    } else {
      console.warn('[CurrencyService] API failed during initialization, will use fallback rates');
    }
    return false;
  } catch (error) {
    // Restore previous cache if it existed
    if (previousCache) {
      ratesCache.rates = previousCache;
    }
    console.error('[CurrencyService] Failed to initialize, using fallback rates:', error.message);
    return false;
  }
}

/**
 * Refresh rates manually
 */
export async function refreshRates() {
  ratesCache.lastUpdated = null; // Force refresh
  return await fetchLatestRates();
}

/**
 * Get current rates (for debugging)
 */
export function getRates() {
  return getRatesSync();
}

/**
 * Get cache status
 */
export function getCacheStatus() {
  const hasCache = !!ratesCache.rates;
  const lastUpdated = ratesCache.lastUpdated ? new Date(ratesCache.lastUpdated).toISOString() : null;
  const cacheAgeMs = ratesCache.lastUpdated ? (Date.now() - ratesCache.lastUpdated) : null;
  const cacheAge = cacheAgeMs !== null ? Math.floor(cacheAgeMs / 1000) + 's' : null;
  const isExpired = ratesCache.lastUpdated ? cacheAgeMs >= CACHE_DURATION_MS : true;
  
  // Debug logging - only log if there's an issue
  if (!hasCache || isExpired) {
    console.log('[CurrencyService] Cache status check:', {
      hasCache,
      lastUpdated,
      cacheAge,
      isExpired,
      ratesCacheState: {
        ratesExists: !!ratesCache.rates,
        lastUpdatedRaw: ratesCache.lastUpdated,
        baseCurrency: ratesCache.baseCurrency,
        sampleKeys: ratesCache.rates ? Object.keys(ratesCache.rates).slice(0, 3) : null
      }
    });
  }
  
  return {
    hasCache,
    lastUpdated,
    cacheAge,
    isExpired
  };
}

export default {
  convert,
  convertAsync,
  toUSD,
  fromUSD,
  getRate,
  format,
  getCurrencyForMarketplace,
  initializeRates,
  refreshRates,
  getRates,
  getCacheStatus,
  CURRENCY_SYMBOLS,
  MARKETPLACE_CURRENCIES
};
