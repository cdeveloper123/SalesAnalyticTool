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
    
    const response = await currencyApi.latest({
      base_currency: 'USD',
      currencies: 'EUR,GBP,CAD,AUD,JPY,AED,SAR,SGD,HKD,INR,BRL,MXN,CNY'
    });
    
    if (response && response.data) {
      // API returns rates relative to base (USD)
      // e.g., { EUR: 0.92, GBP: 0.79, ... }
      ratesCache = {
        rates: { USD: 1, ...response.data },
        lastUpdated: now,
        baseCurrency: 'USD'
      };
      
      console.log('[CurrencyService] Rates updated successfully');
      return ratesCache.rates;
    }
  } catch (error) {
    console.error('[CurrencyService] API error, using fallback rates:', error.message);
  }
  
  // Return fallback rates if API fails
  return FALLBACK_RATES;
}

/**
 * Get current exchange rates (sync version using cache)
 */
function getRatesSync() {
  if (ratesCache.rates) {
    return ratesCache.rates;
  }
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
export async function initializeRates() {
  try {
    await fetchLatestRates();
    console.log('[CurrencyService] Initialized with live rates');
    return true;
  } catch (error) {
    console.error('[CurrencyService] Failed to initialize, using fallback rates');
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
  return {
    hasCache: !!ratesCache.rates,
    lastUpdated: ratesCache.lastUpdated ? new Date(ratesCache.lastUpdated).toISOString() : null,
    cacheAge: ratesCache.lastUpdated ? Math.floor((Date.now() - ratesCache.lastUpdated) / 1000) + 's' : null,
    isExpired: ratesCache.lastUpdated ? (Date.now() - ratesCache.lastUpdated) >= CACHE_DURATION_MS : true
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
