import axios from 'axios';

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

export const getAmazonProductData = async (ean, country = 'US') => {
  try {
    const apiKey = process.env.RAINFOREST_API_KEY;
    if (!apiKey) {
      return {
        source: 'amazon',
        success: false,
        error: 'API key not configured',
      };
    }

    const amazonDomain = getAmazonDomain(country);

    // Step 1: Try GTIN (EAN) lookup first
    const gtinResult = await getProductByGTIN(apiKey, amazonDomain, ean);
    console.log('GTIN Result------------------------>>>>>:', gtinResult);
    
    if (gtinResult.success) {
      return {
        source: 'amazon',
        success: true,
        domain: amazonDomain,
        country: country,
        lookupMethod: 'gtin',
        data: gtinResult.data,
        product: gtinResult.product,
      };
    }

    console.log('ASIN WILL BE CALLED------------------------>>>>>');

    // Step 2: If GTIN lookup failed, try treating the input as ASIN
    const asinResult = await getProductByASIN(apiKey, amazonDomain, ean);

    console.log('ASIN Result------------------------>>>>>:', asinResult);
    if (asinResult.success) {
      return {
        source: 'amazon',
        success: true,
        domain: amazonDomain,
        country: country,
        lookupMethod: 'asin',
        data: asinResult.data,
        product: asinResult.product,
      };
    }

    return {
      source: 'amazon',
      success: false,
      domain: amazonDomain,
      country: country,
      message: 'Product not found',
    };
  } catch (error) {
    console.error(`Rainforest API Error: ${error.message}`);
    return {
      source: 'amazon',
      success: false,
      error: error.message,
    };
  }
};
