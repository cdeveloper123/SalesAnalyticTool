import { getAmazonProductData } from './amazonService.js';

export const createProduct = async (productData) => {
  let amazonData = null;
  if (productData.ean) {
    try {
      const country = productData.supplier_region;
      const amazonResult = await getAmazonProductData(productData.ean, country);
      console.log('Amazon Result------------------------>>>>>:', amazonResult);
      if (amazonResult.success) {
        amazonData = {
          source: amazonResult.source,
          domain: amazonResult.domain,
          country: amazonResult.country,
          product: amazonResult.product,
          fullData: amazonResult.data,
        };
      } else {
        console.log(`Amazon product not found for EAN: ${productData.ean} in ${country}`);
      }
    } catch (error) {
      console.error('Error calling Amazon Rainforest API:', error.message);
    }
  } else {
    console.warn('No EAN provided, skipping Amazon API call');
  }

  console.log('Amazon Data------------------------>>>>>:', amazonData);
  console.log('Product Data------------------------>>>>>:', productData);

  return {
    ...productData,
    amazonCatalog: amazonData,
    productFound: amazonData !== null,
  };
};