import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data source mode is now passed as parameter from frontend

// Load mock data
let mockData = null;
const loadMockData = () => {
  if (mockData) return mockData;
  try {
    const mockDataPath = path.join(__dirname, '../data/amazonMockData.json');
    const fileContent = fs.readFileSync(mockDataPath, 'utf8');
    mockData = JSON.parse(fileContent);
    return mockData;
  } catch (error) {
    console.error('[Amazon Service] Error loading mock data:', error);
    return {};
  }
};

const getAmazonDomain = (country) => {
  const countryMap = {
    'US': 'amazon.com',
    'UK': 'amazon.co.uk',
    'DE': 'amazon.de',
    'FR': 'amazon.fr',
    'IT': 'amazon.it',
    'AU': 'amazon.com.au',
    'BR': 'amazon.com.br',
    'IN': 'amazon.in',
    'CA': 'amazon.ca',
    'JP': 'amazon.co.jp',
  };
  return countryMap[country] || 'amazon.com';
};

const getProductByGTIN = async (apiKey, amazonDomain, gtin) => {
  try {
    const params = {
      api_key: apiKey,
      type: 'product',
      amazon_domain: amazonDomain,
      gtin: gtin,
    };

    const response = await axios.get('https://api.rainforestapi.com/request', { params });

    if (response.data && response.data.product) {
      return {
        success: true,
        data: response.data,
        product: response.data.product,
        dataSource: 'live',
        fetchedAt: new Date().toISOString()
      };
    }

    return { success: false, dataSource: 'live' };
  } catch (error) {
    // If it's a 400 error, likely invalid GTIN format (might be ASIN instead)
    if (error.response && error.response.status === 400) {
      return { success: false, isInvalidFormat: true, dataSource: 'live' };
    }
    throw error;
  }
};

const getProductByASIN = async (apiKey, amazonDomain, asin) => {
  try {
    const params = {
      api_key: apiKey,
      asin: asin,
      type: 'product',
      amazon_domain: amazonDomain,
    };

    const response = await axios.get('https://api.rainforestapi.com/request', { params });

    if (response.data && response.data.product) {
      return {
        success: true,
        data: response.data,
        product: response.data.product,
        dataSource: 'live',
        fetchedAt: new Date().toISOString()
      };
    }

    return { success: false, dataSource: 'live' };
  } catch (error) {
    // Handle API errors gracefully
    if (error.response && error.response.status === 400) {
      return { success: false, dataSource: 'live' };
    }
    throw error;
  }
};

export const getAmazonProductData = async (ean, country = 'US', dataSourceMode = 'live') => {
  try {
    // MOCK MODE: Return mock data
    if (dataSourceMode === 'mock') {
      console.log(`[Amazon Service] Using MOCK data for EAN: ${ean}, Country: ${country}`);
      const mockData = loadMockData();
      const mockResult = mockData[country] || mockData['US'] || null;

      if (mockResult) {
        return {
          ...mockResult,
          dataSource: 'mock',
          ean: ean, // Include the EAN in response
          fetchedAt: new Date().toISOString()
        };
      }

      return {
        source: 'amazon',
        success: false,
        domain: getAmazonDomain(country),
        country: country,
        dataSource: 'mock',
        message: 'Mock data not available for this country',
      };
    }

    // LIVE MODE: Fetch from API
    const apiKey = process.env.RAINFOREST_API_KEY;
    if (!apiKey) {
      // If no API key, fallback to mock data
      console.log('[Amazon Service] No API key, falling back to mock data');
      const mockData = loadMockData();
      const mockResult = mockData[country] || mockData['US'] || null;
      if (mockResult) {
        return {
          ...mockResult,
          dataSource: 'mock-fallback',
          ean: ean,
          fetchedAt: new Date().toISOString()
        };
      }
      return {
        source: 'amazon',
        success: false,
        error: 'API key not configured',
        dataSource: dataSourceMode,
      };
    }

    const amazonDomain = getAmazonDomain(country);

    // Step 1: Try GTIN (EAN) lookup first
    const gtinResult = await getProductByGTIN(apiKey, amazonDomain, ean);
    console.log('GTIN Result------------------------>>>>>', gtinResult);

    if (gtinResult.success) {
      return {
        source: 'amazon',
        success: true,
        domain: amazonDomain,
        country: country,
        lookupMethod: 'gtin',
        data: gtinResult.data,
        product: gtinResult.product,
        dataSource: 'live',
      };
    }

    console.log('ASIN WILL BE CALLED------------------------>>>>>');

    // Step 2: If GTIN lookup failed, try treating the input as ASIN
    const asinResult = await getProductByASIN(apiKey, amazonDomain, ean);

    console.log('ASIN Result------------------------>>>>>', asinResult);
    if (asinResult.success) {
      return {
        source: 'amazon',
        success: true,
        domain: amazonDomain,
        country: country,
        lookupMethod: 'asin',
        data: asinResult.data,
        product: asinResult.product,
        dataSource: 'live',
      };
    }

    return {
      source: 'amazon',
      success: false,
      domain: amazonDomain,
      country: country,
      dataSource: 'live',
      message: 'Product not found',
    };
  } catch (error) {
    console.error(`Rainforest API Error: ${error.message}`);

    // If API fails, try mock data as fallback
    console.log('[Amazon Service] API error, falling back to mock data');
    const mockData = loadMockData();
    const mockResult = mockData[country] || mockData['US'] || null;
    if (mockResult) {
      return {
        ...mockResult,
        dataSource: 'mock-fallback',
        ean: ean,
      };
    }

    return {
      source: 'amazon',
      success: false,
      error: error.message,
      dataSource: dataSourceMode,
    };
  }
};

/**
 * Search Amazon by keyword/product name
 * Uses Rainforest API type=search to find products by name
 * 
 * @param {string} keyword - Product name or search term
 * @param {string} country - Target country code (US, UK, DE, etc.)
 * @param {string} dataSourceMode - 'live' or 'mock'
 * @returns {Object} - Search result with top product data
 */
export const searchByKeyword = async (keyword, country = 'US', dataSourceMode = 'live') => {
  try {
    // MOCK MODE: Return mock search result
    if (dataSourceMode === 'mock') {
      console.log(`[Amazon Service] Using MOCK keyword search for: ${keyword}, Country: ${country}`);
      const mockData = loadMockData();
      const mockResult = mockData[country] || mockData['US'] || null;

      if (mockResult) {
        return {
          source: 'amazon',
          success: true,
          domain: getAmazonDomain(country),
          country: country,
          lookupMethod: 'keyword-mock',
          product: mockResult.product,
          searchTerm: keyword,
          dataSource: 'mock',
          fetchedAt: new Date().toISOString()
        };
      }

      return {
        source: 'amazon',
        success: false,
        domain: getAmazonDomain(country),
        country: country,
        dataSource: 'mock',
        message: 'No mock data available for keyword search'
      };
    }

    // LIVE MODE: Search via Rainforest API
    const apiKey = process.env.RAINFOREST_API_KEY;
    if (!apiKey) {
      console.log('[Amazon Service] No API key, falling back to mock for keyword search');
      return searchByKeyword(keyword, country, 'mock');
    }

    const amazonDomain = getAmazonDomain(country);

    console.log(`[Amazon Service] Keyword search: "${keyword}" on ${amazonDomain}`);

    const params = {
      api_key: apiKey,
      type: 'search',
      amazon_domain: amazonDomain,
      search_term: keyword,
      sort_by: 'relevance'
    };

    const response = await axios.get('https://api.rainforestapi.com/request', { params });

    if (response.data && response.data.search_results && response.data.search_results.length > 0) {
      // Get the top result
      const topResult = response.data.search_results[0];

      // If we have an ASIN, fetch full product details
      if (topResult.asin) {
        const productResult = await getProductByASIN(apiKey, amazonDomain, topResult.asin);
        if (productResult.success) {
          return {
            source: 'amazon',
            success: true,
            domain: amazonDomain,
            country: country,
            lookupMethod: 'keyword',
            product: productResult.product,
            asin: topResult.asin,
            searchTerm: keyword,
            searchResultsCount: response.data.search_results.length,
            dataSource: 'live',
            fetchedAt: new Date().toISOString()
          };
        }
      }

      // If no ASIN or product fetch failed, return search result data
      return {
        source: 'amazon',
        success: true,
        domain: amazonDomain,
        country: country,
        lookupMethod: 'keyword',
        product: {
          title: topResult.title,
          asin: topResult.asin,
          price: topResult.price?.value ? {
            value: topResult.price.value,
            currency: topResult.price.currency || 'USD'
          } : null,
          rating: topResult.rating,
          ratings_total: topResult.ratings_total,
          image: topResult.image,
          categories: topResult.categories || []
        },
        asin: topResult.asin,
        searchTerm: keyword,
        searchResultsCount: response.data.search_results.length,
        dataSource: 'live',
        fetchedAt: new Date().toISOString()
      };
    }

    return {
      source: 'amazon',
      success: false,
      domain: amazonDomain,
      country: country,
      searchTerm: keyword,
      dataSource: 'live',
      message: 'No products found for search term'
    };

  } catch (error) {
    console.error(`[Amazon Service] Keyword search error: ${error.message}`);

    // Fallback to mock data
    console.log('[Amazon Service] Keyword search error, falling back to mock data');
    const mockData = loadMockData();
    const mockResult = mockData[country] || mockData['US'] || null;
    if (mockResult) {
      return {
        source: 'amazon',
        success: true,
        domain: getAmazonDomain(country),
        country: country,
        lookupMethod: 'keyword-mock-fallback',
        product: mockResult.product,
        searchTerm: keyword,
        dataSource: 'mock-fallback',
        fetchedAt: new Date().toISOString()
      };
    }

    return {
      source: 'amazon',
      success: false,
      error: error.message,
      searchTerm: keyword,
      dataSource: dataSourceMode
    };
  }
};
