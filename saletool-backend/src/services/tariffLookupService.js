/**
 * Tariff Lookup Service
 * 
 * Provides duty rate lookup from official government APIs:
 * - US: USITC HTS REST API (free, unlimited)
 * - UK: UK Trade Tariff API (free, unlimited)
 * - EU (DE/FR/IT): TARIC database (free)
 * - AU: Fallback rates from Australian Border Force
 * 
 * Features:
 * - Real-time API lookups
 * - Response caching (24hr TTL)
 * - Fallback to hardcoded rates if API fails
 */

// Note: Using native fetch (Node.js 18+)

// Simple in-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get cached value or null if expired
 */
function getFromCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

/**
 * Set cache value with TTL
 */
function setCache(key, value) {
  cache.set(key, {
    value,
    expiry: Date.now() + CACHE_TTL
  });
}

/**
 * Fallback duty rates by destination and HS code prefix
 * Uses 4-digit subchapter for more accuracy, falls back to 2-digit chapter
 * Updated with 2025 rates from official sources
 * 
 * Sources:
 * - US: https://hts.usitc.gov
 * - UK: https://trade-tariff.service.gov.uk
 * - EU: https://ec.europa.eu/taxation_customs/dds2/taric
 * - AU: https://abf.gov.au/importing-exporting-and-manufacturing/tariff-classification
 */
const FALLBACK_DUTY_RATES = {
  US: {
    // 4-digit specific rates (priority)
    '8517': 0.00,    // Telephones, mobile phones
    '8471': 0.00,    // Computers
    '9504': 0.00,    // Video game consoles - FREE
    '9503': 0.00,    // Toys - generally FREE
    // 2-digit chapter rates
    '85': 0.00,      // Electronics
    '95': 0.00,      // Toys & Games
    '61': 0.12,      // Knitted clothing
    '62': 0.12,      // Non-knitted clothing
    '64': 0.20,      // Footwear
    '71': 0.065,     // Jewelry
    '84': 0.00,      // Machinery
    '49': 0.00,      // Books, printed matter
    default: 0.05
  },
  UK: {
    // 4-digit specific rates
    '8517': 0.00,    // Telephones
    '8471': 0.00,    // Computers
    '9504': 0.00,    // Video game consoles - 0% MFN
    '9503': 0.047,   // Toys - 4.7%
    // 2-digit chapter rates  
    '85': 0.00,      // Electronics
    '95': 0.047,     // Default toys (4.7%)
    '61': 0.12,      // Knitted clothing
    '62': 0.12,      // Non-knitted clothing
    '64': 0.08,      // Footwear
    '71': 0.025,     // Jewelry
    '84': 0.00,      // Machinery
    '49': 0.00,      // Books
    default: 0.04
  },
  // EU countries use Common External Tariff (same rates)
  DE: {
    '8517': 0.00,    // Telephones
    '8471': 0.00,    // Computers
    '9504': 0.00,    // Video game consoles - 0% MFN (confirmed)
    '9503': 0.047,   // Toys
    '85': 0.00,
    '95': 0.047,
    '61': 0.12,
    '62': 0.12,
    '64': 0.08,
    '71': 0.025,
    '84': 0.00,
    '49': 0.00,
    default: 0.04
  },
  FR: {
    '8517': 0.00, '8471': 0.00, '9504': 0.00, '9503': 0.047,
    '85': 0.00, '95': 0.047, '61': 0.12, '62': 0.12,
    '64': 0.08, '71': 0.025, '84': 0.00, '49': 0.00,
    default: 0.04
  },
  IT: {
    '8517': 0.00, '8471': 0.00, '9504': 0.00, '9503': 0.047,
    '85': 0.00, '95': 0.047, '61': 0.12, '62': 0.12,
    '64': 0.08, '71': 0.025, '84': 0.00, '49': 0.00,
    default: 0.04
  },
  AU: {
    // Australia Free Trade Agreement rates
    '8517': 0.00, '8471': 0.00, '9504': 0.00, '9503': 0.00,
    '85': 0.00,
    '95': 0.00,
    '61': 0.05,
    '62': 0.05,
    '64': 0.05,
    '71': 0.05,
    '84': 0.00,
    '49': 0.00,
    default: 0.05
  }
};

/**
 * Get fallback duty rate from hardcoded table
 * Priority: 4-digit subchapter > 2-digit chapter > default
 */
function getFallbackRate(hsCode, destination) {
  const subchapter = hsCode.substring(0, 4); // 4-digit (e.g., 9504)
  const chapter = hsCode.substring(0, 2);    // 2-digit (e.g., 95)
  const destRates = FALLBACK_DUTY_RATES[destination] || FALLBACK_DUTY_RATES.US;
  
  // Try 4-digit subchapter first for more accuracy
  if (destRates[subchapter] !== undefined) {
    return destRates[subchapter];
  }
  // Fall back to 2-digit chapter
  if (destRates[chapter] !== undefined) {
    return destRates[chapter];
  }
  return destRates.default;
}

/**
 * Lookup duty rate from UK Trade Tariff API
 * @param {string} hsCode - HS code (10 digits for UK)
 * @returns {object} { rate, source, raw }
 */
async function lookupUKTariff(hsCode) {
  const cacheKey = `uk_${hsCode}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;
  
  try {
    // UK requires 10-digit commodity codes
    const paddedCode = hsCode.padEnd(10, '0');
    const url = `https://www.trade-tariff.service.gov.uk/api/v2/commodities/${paddedCode}`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 10000
    });
    
    if (!response.ok) {
      throw new Error(`UK API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract third country duty (MFN rate)
    let dutyRate = 0;
    const measures = data.included?.filter(i => i.type === 'measure') || [];
    
    for (const measure of measures) {
      // Look for third country duty (measure type 103)
      if (measure.attributes?.measure_type_id === '103') {
        const components = data.included?.filter(
          i => i.type === 'duty_expression' && 
          measure.relationships?.duty_expression?.data?.id === i.id
        ) || [];
        
        for (const comp of components) {
          if (comp.attributes?.base) {
            // Parse "4.7%" format
            const match = comp.attributes.base.match(/([\d.]+)%/);
            if (match) {
              dutyRate = parseFloat(match[1]) / 100;
              break;
            }
          }
        }
      }
    }
    
    const result = {
      rate: dutyRate,
      ratePercent: (dutyRate * 100).toFixed(1) + '%',
      source: 'uk_trade_tariff_api',
      commodity: paddedCode,
      description: data.data?.attributes?.description || null,
      timestamp: new Date().toISOString()
    };
    
    setCache(cacheKey, result);
    return result;
    
  } catch (error) {
    console.warn(`[Tariff Lookup] UK API error for ${hsCode}:`, error.message);
    const fallbackRate = getFallbackRate(hsCode, 'UK');
    return {
      rate: fallbackRate,
      ratePercent: (fallbackRate * 100).toFixed(1) + '%',
      source: 'fallback',
      error: error.message
    };
  }
}

/**
 * Lookup duty rate from USITC HTS API
 * @param {string} hsCode - HS code 
 * @returns {object} { rate, source, raw }
 */
async function lookupUSTariff(hsCode) {
  const cacheKey = `us_${hsCode}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;
  
  try {
    // Format HS code for USITC API (needs dots: 9504.50)
    const formattedCode = hsCode.length >= 6 
      ? `${hsCode.substring(0, 4)}.${hsCode.substring(4, 6)}`
      : hsCode;
    
    // USITC reststop API endpoint - returns JSON array
    const url = `https://hts.usitc.gov/reststop/search?keyword=${formattedCode}`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error(`US API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // Parse the HTS response (returns array directly)
    let dutyRate = 0;
    let description = null;
    let htsNumber = null;
    
    if (Array.isArray(data) && data.length > 0) {
      const item = data[0];
      htsNumber = item.htsno || null;
      description = item.description || null;
      
      // Parse general rate (e.g., "Free", "4.5%", "2.5¢/kg + 4.5%")
      const generalRate = item.general;
      if (generalRate) {
        if (generalRate.toLowerCase() === 'free') {
          dutyRate = 0;
        } else {
          const match = generalRate.match(/([\d.]+)%/);
          if (match) {
            dutyRate = parseFloat(match[1]) / 100;
          }
        }
      }
    }
    
    const result = {
      rate: dutyRate,
      ratePercent: (dutyRate * 100).toFixed(1) + '%',
      source: 'usitc_hts_api',
      htsNumber,
      description,
      timestamp: new Date().toISOString()
    };
    
    setCache(cacheKey, result);
    return result;
    
  } catch (error) {
    console.warn(`[Tariff Lookup] US API error for ${hsCode}:`, error.message);
    const fallbackRate = getFallbackRate(hsCode, 'US');
    return {
      rate: fallbackRate,
      ratePercent: (fallbackRate * 100).toFixed(1) + '%',
      source: 'fallback',
      error: error.message
    };
  }
}

/**
 * Lookup duty rate for EU countries (DE, FR, IT)
 * Uses TARIC via zolltarifnummern.de (no API key needed)
 * @param {string} hsCode - HS code
 * @param {string} destination - EU country (DE, FR, IT)
 * @returns {object} { rate, source }
 */
async function lookupEUTariff(hsCode, destination = 'DE') {
  const cacheKey = `eu_${hsCode}`;
  const cached = getFromCache(cacheKey);
  if (cached) return { ...cached, destination };
  
  try {
    // Try zolltarifnummern.de API (free, no key)
    const paddedCode = hsCode.padEnd(10, '0');
    const url = `https://www.zolltarifnummern.de/api/taric?code=${paddedCode}`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 10000
    });
    
    if (!response.ok) {
      throw new Error(`TARIC API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // Parse TARIC response for duty rate
    let dutyRate = 0;
    let description = null;
    
    if (data.duties) {
      // Look for third country (Erga Omnes) duty
      const thirdCountryDuty = data.duties.find(d => 
        d.geographic_area === 'ERGA OMNES' || d.geographic_area === '1011'
      );
      
      if (thirdCountryDuty && thirdCountryDuty.duty_expression) {
        const match = thirdCountryDuty.duty_expression.match(/([\d.]+)%/);
        if (match) {
          dutyRate = parseFloat(match[1]) / 100;
        }
      }
    }
    
    description = data.description || null;
    
    const result = {
      rate: dutyRate,
      ratePercent: (dutyRate * 100).toFixed(1) + '%',
      source: 'taric_api',
      taricCode: paddedCode,
      description,
      destination,
      timestamp: new Date().toISOString()
    };
    
    setCache(cacheKey, result);
    return result;
    
  } catch (error) {
    console.warn(`[Tariff Lookup] EU TARIC API error for ${hsCode}:`, error.message);
    // Try direct EU TARIC as fallback
    return await lookupEUTaricDirect(hsCode, destination);
  }
}

/**
 * Direct EU TARIC consultation fallback
 */
async function lookupEUTaricDirect(hsCode, destination) {
  // If external API fails, use fallback rates
  return {
    rate: getFallbackRate(hsCode, destination),
    ratePercent: (getFallbackRate(hsCode, destination) * 100).toFixed(1) + '%',
    source: 'fallback',
    destination,
    note: 'Using fallback rates - TARIC API unavailable'
  };
}

/**
 * Lookup duty rate for Australia
 * Australia does not have a free public API, using fallback rates
 */
async function lookupAUTariff(hsCode) {
  const cacheKey = `au_${hsCode}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;
  
  // Australia: Use fallback rates from official ABF tariff schedule
  const rate = getFallbackRate(hsCode, 'AU');
  
  const result = {
    rate,
    ratePercent: (rate * 100).toFixed(1) + '%',
    source: 'fallback_abf',
    note: 'Rate from Australian Border Force tariff schedule',
    timestamp: new Date().toISOString()
  };
  
  setCache(cacheKey, result);
  return result;
}

/**
 * Main function: Get duty rate for any destination
 * @param {string} hsCode - HS code
 * @param {string} origin - Origin country code
 * @param {string} destination - Destination country code
 * @returns {object} { rate, source, ... }
 */
export async function getDutyRate(hsCode, origin, destination) {
  if (!hsCode || !destination) {
    return {
      rate: 0.05,
      source: 'default',
      error: 'Missing HS code or destination'
    };
  }
  
  // Normalize codes
  const cleanHS = hsCode.replace(/[\s.\-]/g, '');
  const dest = destination.toUpperCase();
  
  // Same country = no duty
  if (origin?.toUpperCase() === dest) {
    return { rate: 0, source: 'domestic', note: 'Domestic shipment - no import duty' };
  }
  
  // Intra-EU = no duty
  const euCountries = ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PL'];
  if (euCountries.includes(origin?.toUpperCase()) && euCountries.includes(dest)) {
    return { rate: 0, source: 'intra_eu', note: 'Intra-EU trade - no duty' };
  }
  
  // Route to appropriate API
  switch (dest) {
    case 'US':
      return await lookupUSTariff(cleanHS);
    case 'UK':
    case 'GB':
      return await lookupUKTariff(cleanHS);
    case 'DE':
    case 'FR':
    case 'IT':
    case 'ES':
    case 'NL':
    case 'BE':
      return await lookupEUTariff(cleanHS, dest);
    case 'AU':
      return await lookupAUTariff(cleanHS);
    default:
      return {
        rate: 0.05,
        source: 'default',
        note: `No API configured for ${dest}, using default rate`
      };
  }
}

/**
 * Get duty rates for multiple destinations
 * @param {string} hsCode - HS code
 * @param {string} origin - Origin country
 * @param {string[]} destinations - List of destination countries
 */
export async function getDutyRatesMultiple(hsCode, origin, destinations) {
  const results = {};
  
  await Promise.all(
    destinations.map(async (dest) => {
      results[dest] = await getDutyRate(hsCode, origin, dest);
    })
  );
  
  return results;
}

/**
 * Clear cache (useful for testing)
 */
export function clearCache() {
  cache.clear();
}

export default {
  getDutyRate,
  getDutyRatesMultiple,
  lookupUKTariff,
  lookupUSTariff,
  lookupEUTariff,
  lookupAUTariff,
  clearCache,
  FALLBACK_DUTY_RATES
};
