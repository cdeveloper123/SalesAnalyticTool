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
      };
    }
   
    return { success: false };
  } catch (error) {
    // If it's a 400 error, likely invalid GTIN format (might be ASIN instead)
    if (error.response && error.response.status === 400) {
      return { success: false, isInvalidFormat: true };
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
      };
    }
    
    return { success: false };
  } catch (error) {
    // Handle API errors gracefully
    if (error.response && error.response.status === 400) {
      return { success: false };
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
    console.log('GTIN Result------------------------>>>>>:', gtinResult);
    
    if (gtinResult.success) {
      const result = {
        source: 'amazon',
        success: true,
        domain: amazonDomain,
        country: country,
        lookupMethod: 'gtin',
        data: gtinResult.data,
        product: gtinResult.product,
        dataSource: 'live',
      };
      
      // Cache the result if in cached mode
      if (dataSourceMode === 'cached') {
        dataCache.set(cacheKey, result);
      }
      
      return result;
    }

    console.log('ASIN WILL BE CALLED------------------------>>>>>');

    // Step 2: If GTIN lookup failed, try treating the input as ASIN
    const asinResult = await getProductByASIN(apiKey, amazonDomain, ean);

    console.log('ASIN Result------------------------>>>>>:', asinResult);
    if (asinResult.success) {
      const result = {
        source: 'amazon',
        success: true,
        domain: amazonDomain,
        country: country,
        lookupMethod: 'asin',
        data: asinResult.data,
        product: asinResult.product,
        dataSource: 'live',
      };
      
      // Cache the result if in cached mode
      if (dataSourceMode === 'cached') {
        dataCache.set(cacheKey, result);
      }
      
      return result;
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
