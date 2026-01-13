/**
 * Product Controller
 * 
 * Handles product lookup and HS code suggestion endpoints
 * Uses Amazon as primary source, eBay as free fallback
 */

import { getAmazonProductData } from '../services/amazonService.js';
import ebayService from '../services/ebayService.js';
import { lookupHSCode, getHSCodeInfo } from '../services/hsCodeService.js';


/**
 * Lookup product info by EAN
 * GET /api/v1/products/lookup/:ean
 * 
 * Returns product name and category from Amazon/eBay APIs
 */
export const lookupProduct = async (req, res) => {
    try {
        const { ean } = req.params;

        if (!ean) {
            return res.status(400).json({
                success: false,
                message: 'EAN is required'
            });
        }

        // Try to get product info from Amazon first
        let productData = null;
        let source = 'unknown';

        try {
            // Fetch from Amazon API (or mock)
            const amazonResult = await getAmazonProductData(ean, 'US', 'live');
            if (amazonResult && amazonResult.success && amazonResult.product) {
                const product = amazonResult.product;
                productData = {
                    productName: product.title,
                    category: product.categories?.[0]?.name || product.main_category?.name || 'default',
                    brand: product.brand || null,
                    asin: product.asin || null
                };
                source = amazonResult.dataSource || 'amazon';
            }
        } catch (amazonError) {
            console.error('[Product Controller] Amazon lookup failed:', amazonError.message);
        }

        // Fallback to eBay if Amazon didn't return data
        if (!productData) {
            try {
                console.log('[Product Controller] Trying eBay fallback for EAN:', ean);
                const ebayResults = await ebayService.searchByEAN(ean, 'US');
                if (ebayResults && ebayResults.length > 0) {
                    const firstItem = ebayResults[0];
                    console.log('[Product Controller] First eBay item:', firstItem.title?.substring(0, 50), 'ID:', firstItem.itemId);

                    // Fallback data from search result
                    productData = {
                        productName: firstItem.title,
                        category: firstItem.categoryName || 'default',
                        brand: null,
                        asin: null
                    };
                    source = 'ebay';

                    // Try to get more details (brand, full category path) but don't fail if it fails
                    try {
                        const itemDetails = await ebayService.getItemDetails(firstItem.itemId);
                        if (itemDetails) {
                            productData = {
                                productName: itemDetails.title,
                                category: itemDetails.categoryPath?.split(' > ').pop() || itemDetails.categoryPath || productData.category,
                                brand: itemDetails.brand || null,
                                asin: null
                            };
                        }
                    } catch (detailError) {
                        console.warn('[Product Controller] eBay getItemDetails failed, using search data:', detailError.message);
                    }
                }
            } catch (ebayError) {
                console.error('[Product Controller] eBay fallback failed:', ebayError.message);
            }
        }

        if (!productData) {
            return res.status(404).json({
                success: false,
                message: 'Product not found for this EAN'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                ean,
                productName: productData.productName,
                category: productData.category,
                brand: productData.brand,
                asin: productData.asin,
                source
            }
        });
    } catch (error) {
        console.error('[Product Controller] Error looking up product:', error);
        res.status(500).json({
            success: false,
            message: 'Error looking up product',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Suggest HS code for a product by EAN
 * GET /api/v1/products/suggest-hs/:ean
 * 
 * Combines product lookup + HS code inference
 * Priority: Amazon Live API → eBay (free) → Amazon Mock Data
 */
export const suggestHsCodeForEan = async (req, res) => {
    try {
        const { ean } = req.params;

        if (!ean) {
            return res.status(400).json({
                success: false,
                message: 'EAN is required'
            });
        }

        let productData = null;
        let source = 'unknown';

        // Step 1: Try Amazon Live API first (if API key exists)
        try {
            const amazonResult = await getAmazonProductData(ean, 'US', 'live');
            // Only use if it's from live API, not mock fallback
            if (amazonResult && amazonResult.success && amazonResult.product && amazonResult.dataSource === 'live') {
                const product = amazonResult.product;
                productData = {
                    productName: product.title,
                    category: product.categories?.[0]?.name || product.main_category?.name || 'default'
                };
                source = 'amazon-live';
                console.log('[Product Controller] Got product from Amazon Live API:', productData.productName?.substring(0, 50));
            }
        } catch (amazonError) {
            console.error('[Product Controller] Amazon Live API failed:', amazonError.message);
        }

        // Step 2: Try eBay (FREE) if Amazon Live didn't work
        if (!productData) {
            try {
                console.log('[Product Controller] Trying eBay (free) for EAN:', ean);
                const ebayResults = await ebayService.searchByEAN(ean, 'US');
                console.log('[Product Controller] eBay returned', ebayResults?.length || 0, 'results');
                if (ebayResults && ebayResults.length > 0) {
                    const firstItem = ebayResults[0];
                    console.log('[Product Controller] First eBay item:', firstItem.title?.substring(0, 50), 'ID:', firstItem.itemId);

                    // Fallback data from search result
                    productData = {
                        productName: firstItem.title,
                        category: firstItem.categoryName || 'default'
                    };
                    source = 'ebay';

                    // Try to get item details to get full category path, but don't fail if not found
                    try {
                        const itemDetails = await ebayService.getItemDetails(firstItem.itemId);
                        if (itemDetails) {
                            // Extract category from categoryPath
                            const categoryPath = itemDetails.categoryPath || '';
                            const categoryParts = categoryPath.split(' > ');
                            const mainCategory = categoryParts[0] || 'default';

                            productData = {
                                productName: itemDetails.title,
                                category: mainCategory
                            };
                            console.log('[Product Controller] Got detailed product from eBay:', productData.productName?.substring(0, 50), 'Category:', mainCategory);
                        } else {
                            console.log('[Product Controller] Using eBay search data as fallback for category:', productData.category);
                        }
                    } catch (detailError) {
                        console.log('[Product Controller] eBay getItemDetails failed, using search data instead');
                    }
                } else {
                    console.log('[Product Controller] eBay found no listings for this EAN');
                }
            } catch (ebayError) {
                console.error('[Product Controller] eBay lookup failed:', ebayError.message);

            }
        }

        // Step 3: Fall back to Amazon Mock Data as last resort
        if (!productData) {
            try {
                console.log('[Product Controller] Trying Amazon Mock Data as last resort for EAN:', ean);
                const amazonResult = await getAmazonProductData(ean, 'US', 'mock');
                if (amazonResult && amazonResult.success && amazonResult.product) {
                    const product = amazonResult.product;
                    productData = {
                        productName: product.title,
                        category: product.categories?.[0]?.name || product.main_category?.name || 'default'
                    };
                    source = 'amazon-mock';
                    console.log('[Product Controller] Got product from Amazon Mock:', productData.productName?.substring(0, 50));
                }
            } catch (mockError) {
                console.error('[Product Controller] Amazon Mock failed:', mockError.message);
            }
        }

        if (!productData) {
            return res.status(404).json({
                success: false,
                message: 'Product not found on Amazon or eBay. Please enter HS code manually.'
            });
        }

        // Step 4: Infer HS code from product name and category
        const hsResult = lookupHSCode(productData.category, productData.productName);
        const hsInfo = hsResult.hsCode ? getHSCodeInfo(hsResult.hsCode) : null;

        res.status(200).json({
            success: true,
            data: {
                ean,
                productName: productData.productName,
                category: productData.category,
                hsCode: hsResult.hsCode,
                hsSource: hsResult.source,
                hsConfidence: hsResult.confidence,
                chapter: hsInfo?.chapter || null,
                chapterDescription: hsInfo?.chapterDescription || null,
                productSource: source
            }
        });
    } catch (error) {
        console.error('[Product Controller] Error suggesting HS code:', error);
        res.status(500).json({
            success: false,
            message: 'Error suggesting HS code',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    lookupProduct,
    suggestHsCodeForEan
};
