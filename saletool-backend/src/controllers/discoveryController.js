/**
 * Discovery Analysis Controller
 * 
 * Discovery Mode: Product name OR EAN only → highest price regions, largest volume regions, demand & price figures
 * No margin/score/decision calculation
 */

import { getAmazonProductData, searchByKeyword } from '../services/amazonService.js';
import ebayService from '../services/ebayService.js';
import currencyService from '../services/currencyService.js';
import { getPrisma } from '../config/database.js';
import PerformanceLogger from '../utils/performanceLogger.js';

/**
 * POST /api/v1/discovery/analyze
 * 
 * Analyze a product for discovery (market research) without deal evaluation
 * 
 * Input:
 * {
 *   "ean": "0045496395230" (optional if productName provided),
 *   "productName": "Nintendo Switch" (optional if ean provided)
 * }
 */
export const analyzeDiscovery = async (req, res) => {
    const perfLogger = new PerformanceLogger();

    try {
        const {
            ean,
            productName,
            searchType,  // 'ean' or 'keyword' - explicit from frontend
            dataSourceMode = 'live'
        } = req.body;

        // Validation: At least one of ean or productName required
        if (!ean && !productName) {
            return res.status(400).json({
                success: false,
                message: 'Either EAN or product name is required'
            });
        }

        console.log(`[Discovery] Analyzing: EAN=${ean || 'N/A'}, Name=${productName || 'N/A'}, SearchType=${searchType || 'auto'}`);

        // Fetch prices from all markets
        const amazonMarkets = ['US', 'UK', 'DE', 'FR', 'IT', 'AU'];
        const ebayMarkets = ['US', 'UK', 'DE', 'FR', 'IT', 'AU'];

        const priceByRegion = {};
        const volumeByRegion = {};
        let productData = null;
        let productFoundInAnyMarket = false;
        let lookupIdentifier = null;  // Either EAN or ASIN from keyword search

        // Determine search method based on searchType or available data
        const useKeywordSearch = searchType === 'keyword' || (!ean && productName);

        if (useKeywordSearch && productName) {
            // ========================================================================
            // KEYWORD SEARCH MODE: Find product by name first
            // ========================================================================
            console.log(`[Discovery] Using KEYWORD search for: "${productName}"`);

            const keywordResult = await perfLogger.trackAPI(
                'Amazon',
                'searchByKeyword-US',
                () => searchByKeyword(productName, 'US', dataSourceMode),
                { keyword: productName }
            );

            if (!keywordResult.success || !keywordResult.product) {
                return res.status(404).json({
                    success: false,
                    message: `No products found for "${productName}"`,
                    data: { productName }
                });
            }

            // Extract product info from search result
            const product = keywordResult.product;
            productData = {
                title: product.title,
                asin: product.asin || keywordResult.asin,
                category: product.categories?.[0]?.name || product.main_category?.name || 'Unknown',
                brand: product.brand,
                searchTerm: productName
            };

            productFoundInAnyMarket = true;
            lookupIdentifier = product.asin || keywordResult.asin;

            // Get US price from the search result
            const usPrice = product.buybox_winner?.price?.value || product.price?.value || 0;
            const usCurrency = product.buybox_winner?.price?.currency || product.price?.currency || 'USD';

            if (usPrice > 0) {
                priceByRegion['Amazon-US'] = {
                    price: usPrice,
                    currency: usCurrency,
                    channel: 'Amazon',
                    marketplace: 'US',
                    dataSource: keywordResult.dataSource || dataSourceMode
                };
            }

            // Get sales rank from product
            let salesRank = 999999;
            if (product.bestsellers_rank && product.bestsellers_rank.length > 0) {
                salesRank = product.bestsellers_rank[0].rank || 999999;
            }

            volumeByRegion['Amazon-US'] = {
                salesRank,
                recentSales: product.recent_sales || null,
                ratingsTotal: product.ratings_total || 0,
                channel: 'Amazon',
                marketplace: 'US',
                dataSource: keywordResult.dataSource || dataSourceMode
            };

            console.log(`[Discovery] Found product: "${productData.title}" ASIN: ${lookupIdentifier}`);

            // Now fetch from other Amazon markets using ASIN
            for (const market of amazonMarkets.filter(m => m !== 'US')) {
                try {
                    const amazonResult = await perfLogger.trackAPI(
                        'Amazon',
                        `getProductData-${market}`,
                        () => getAmazonProductData(lookupIdentifier, market, dataSourceMode),
                        { market, asin: lookupIdentifier }
                    );

                    if (amazonResult.success && amazonResult.product) {
                        const mktProduct = amazonResult.product;
                        const price = mktProduct.buybox_winner?.price?.value || 0;
                        const currency = mktProduct.buybox_winner?.price?.currency || 'USD';

                        let mktSalesRank = 999999;
                        if (mktProduct.bestsellers_rank && mktProduct.bestsellers_rank.length > 0) {
                            mktSalesRank = mktProduct.bestsellers_rank[0].rank || 999999;
                        }

                        priceByRegion[`Amazon-${market}`] = {
                            price,
                            currency,
                            channel: 'Amazon',
                            marketplace: market,
                            dataSource: amazonResult.dataSource || dataSourceMode
                        };

                        volumeByRegion[`Amazon-${market}`] = {
                            salesRank: mktSalesRank,
                            recentSales: mktProduct.recent_sales || null,
                            ratingsTotal: mktProduct.ratings_total || 0,
                            channel: 'Amazon',
                            marketplace: market,
                            dataSource: amazonResult.dataSource || dataSourceMode
                        };

                        console.log(`[Discovery Amazon ${market}] Price: ${currency} ${price}, Rank: ${mktSalesRank}`);
                    }
                } catch (error) {
                    console.error(`[Discovery Amazon ${market}] Error:`, error.message);
                }
            }

            // eBay keyword search for each market
            for (const market of ebayMarkets) {
                try {
                    // Use product title for eBay keyword search
                    const ebayResult = await perfLogger.trackAPI(
                        'eBay',
                        `keywordSearch-${market}`,
                        () => ebayService.getProductPricingByKeyword(productData.title, market),
                        { market, keyword: productData.title }
                    );

                    if (ebayResult && ebayResult.buyBoxPrice > 0) {
                        priceByRegion[`eBay-${market}`] = {
                            price: ebayResult.buyBoxPrice,
                            currency: ebayResult.currency || 'USD',
                            channel: 'eBay',
                            marketplace: market,
                            // Prices are confirmed live from Browse/Finding API results
                            dataSource: 'live'
                        };

                        volumeByRegion[`eBay-${market}`] = {
                            estimatedMonthlySales: ebayResult.estimatedMonthlySales || 0,
                            activeListings: ebayResult.activeListings || 0,
                            confidence: ebayResult.confidence || 'LOW',
                            channel: 'eBay',
                            marketplace: market,
                            dataSource: ebayResult.dataSource || dataSourceMode
                        };

                        console.log(`[Discovery eBay ${market}] Price: ${ebayResult.currency} ${ebayResult.buyBoxPrice}`);
                    }
                } catch (error) {
                    console.error(`[Discovery eBay ${market}] Error:`, error.message);
                }
            }

        } else if (ean) {
            // ========================================================================
            // EAN LOOKUP MODE (Original flow)
            // ========================================================================
            lookupIdentifier = ean;

            // Amazon price & volume data
            for (const market of amazonMarkets) {
                try {
                    if (market !== 'US' && !productFoundInAnyMarket && amazonMarkets.indexOf(market) > 0) {
                        console.log(`[Discovery Amazon ${market}] Skipping - product not found in US`);
                        continue;
                    }

                    const amazonResult = await perfLogger.trackAPI(
                        'Amazon',
                        `getProductData-${market}`,
                        () => getAmazonProductData(ean, market, dataSourceMode),
                        { market, ean }
                    );

                    if (amazonResult.success && amazonResult.product) {
                        productFoundInAnyMarket = true;
                        const product = amazonResult.product;

                        if (!productData) {
                            productData = {
                                title: product.title,
                                asin: product.asin,
                                category: product.categories?.[0]?.name || product.main_category?.name || 'Unknown',
                                brand: product.brand,
                                ean
                            };
                        }

                        const price = product.buybox_winner?.price?.value || 0;
                        const currency = product.buybox_winner?.price?.currency || 'USD';

                        // Parse sales rank for volume indication
                        let salesRank = 999999;
                        if (product.bestsellers_rank && product.bestsellers_rank.length > 0) {
                            salesRank = product.bestsellers_rank[0].rank || 999999;
                        } else if (product.specifications_flat) {
                            const rankMatch = product.specifications_flat.match(/Best Sellers Rank:.*?#([\d,]+)/i);
                            if (rankMatch) {
                                salesRank = parseInt(rankMatch[1].replace(/,/g, ''), 10);
                            }
                        }

                        priceByRegion[`Amazon-${market}`] = {
                            price,
                            currency,
                            channel: 'Amazon',
                            marketplace: market,
                            dataSource: amazonResult.dataSource || dataSourceMode
                        };

                        // Lower sales rank = higher volume
                        volumeByRegion[`Amazon-${market}`] = {
                            salesRank,
                            recentSales: product.recent_sales || null,
                            ratingsTotal: product.ratings_total || 0,
                            channel: 'Amazon',
                            marketplace: market,
                            dataSource: amazonResult.dataSource || dataSourceMode
                        };

                        console.log(`[Discovery Amazon ${market}] Price: ${currency} ${price}, Rank: ${salesRank}`);
                    }
                } catch (error) {
                    console.error(`[Discovery Amazon ${market}] Error:`, error.message);
                }
            }

            // eBay price & volume data
            if (productFoundInAnyMarket) {
                for (const market of ebayMarkets) {
                    try {
                        const ebayResult = await perfLogger.trackAPI(
                            'eBay',
                            `getProductPricingByEAN-${market}`,
                            () => ebayService.getProductPricingByEAN(ean, market),
                            { market, ean }
                        );

                        if (ebayResult && ebayResult.buyBoxPrice > 0) {
                            priceByRegion[`eBay-${market}`] = {
                                price: ebayResult.buyBoxPrice,
                                currency: ebayResult.currency || 'USD',
                                channel: 'eBay',
                                marketplace: market,
                                // Prices are confirmed live from Browse API results
                                dataSource: 'live'
                            };

                            volumeByRegion[`eBay-${market}`] = {
                                estimatedMonthlySales: ebayResult.estimatedMonthlySales || 0,
                                activeListings: ebayResult.activeListings || 0,
                                confidence: ebayResult.confidence || 'LOW',
                                channel: 'eBay',
                                marketplace: market,
                                soldLast90Days: ebayResult.soldLast90Days || 0,
                                // Volume is only LIVE if we have actual sold data
                                dataSource: (ebayResult.soldLast90Days > 0) ? 'live' : 'estimated'
                            };

                            console.log(`[Discovery eBay ${market}] Price: ${ebayResult.currency} ${ebayResult.buyBoxPrice}`);
                        }
                    } catch (error) {
                        console.error(`[Discovery eBay ${market}] Error:`, error.message);
                    }
                }
            }
        }


        if (Object.keys(priceByRegion).length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Product not found on Amazon or eBay',
                data: { ean, productName }
            });
        }

        // Calculate highest price regions (top 3)
        const sortedByPrice = Object.entries(priceByRegion)
            .sort((a, b) => b[1].price - a[1].price)
            .slice(0, 5);
        const highestPriceRegions = sortedByPrice.map(([key, data]) => ({
            region: key,
            ...data
        }));

        // Calculate largest volume regions (by sales rank - lower is better)
        const amazonVolumes = Object.entries(volumeByRegion)
            .filter(([key]) => key.startsWith('Amazon'))
            .sort((a, b) => (a[1].salesRank || 999999) - (b[1].salesRank || 999999))
            .slice(0, 3);

        const ebayVolumes = Object.entries(volumeByRegion)
            .filter(([key, data]) => key.startsWith('eBay') && (data.estimatedMonthlySales || 0) > 0)
            .sort((a, b) => (b[1].estimatedMonthlySales || 0) - (a[1].estimatedMonthlySales || 0))
            .slice(0, 3);

        const largestVolumeRegions = [
            ...amazonVolumes.map(([key, data]) => ({ region: key, ...data })),
            ...ebayVolumes.map(([key, data]) => ({
                region: key,
                ...data,
                // Map eBay specific field to the field expected by the UI (with formatting)
                recentSales: data.estimatedMonthlySales ? `${data.estimatedMonthlySales}+ sales / mo` : null
            }))
        ].slice(0, 5);

        // Generate demand signals
        const demandSignals = {
            level: calculateDemandLevel(volumeByRegion),
            signals: generateDemandSignals(volumeByRegion, priceByRegion, dataSourceMode)
        };

        // Capture FX rates snapshot at analysis time
        const fxCacheStatus = currencyService.getCacheStatus();
        const fxRatesSnapshot = {
            rates: fxCacheStatus.rates || {},
            baseCurrency: fxCacheStatus.baseCurrency || 'USD',
            fetchedAt: fxCacheStatus.lastUpdated,
            source: fxCacheStatus.hasCache ? (fxCacheStatus.isExpired ? 'cache_expired' : 'live') : 'fallback'
        };

        // Prepare response
        // Note: ean field stores the original EAN if provided, null for keyword searches
        // The lookupIdentifier (ASIN) is stored in product.asin for keyword searches
        const responseData = {
            ean: ean || null,  // Only store actual EAN, not ASIN from keyword search
            asin: productData?.asin || lookupIdentifier,  // Store ASIN separately
            productName: productData?.title || productName,
            analysisMode: 'discovery',
            dataSourceMode,  // Track if mock or live data was used
            product: productData,
            priceByRegion,
            highestPriceRegions,
            largestVolumeRegions,
            demandSignals,
            marketsAnalyzed: {
                amazon: Object.keys(priceByRegion).filter(k => k.startsWith('Amazon')).length,
                ebay: Object.keys(priceByRegion).filter(k => k.startsWith('eBay')).length
            },
            fxRates: fxRatesSnapshot,
            analyzedAt: new Date().toISOString()
        };

        // Save to database
        try {
            const prisma = getPrisma();
            if (prisma && prisma.deal) {
                const savedDeal = await perfLogger.trackDB(
                    'deal.create',
                    () => prisma.deal.create({
                        data: {
                            ean: lookupIdentifier || null,
                            productName: productData?.title || productName || `Discovery ${lookupIdentifier || 'Unknown'}`,
                            analysisMode: 'DISCOVERY',
                            dataSourceMode,  // Track if mock or live data was used
                            // Discovery specific fields
                            priceByRegion,
                            highestPriceRegions,
                            largestVolumeRegions,
                            demandSignals,
                            // Store full data
                            productData: productData || null,
                            marketData: { priceByRegion, volumeByRegion, fxRates: fxRatesSnapshot }
                        }
                    }),
                    { ean: lookupIdentifier }
                );

                responseData.id = savedDeal.id;
            }
        } catch (dbError) {
            console.error('[Discovery] Error saving to database:', dbError);
        }

        // Log performance
        const perfSummary = perfLogger.getSummary();
        console.log(`[PERF Discovery] ${lookupIdentifier || productName} - Total: ${perfSummary.total}ms`);

        res.status(200).json({
            success: true,
            message: 'Discovery analysis completed',
            data: responseData
        });

    } catch (error) {
        console.error('[Discovery] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error performing discovery analysis',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/v1/discovery
 * 
 * Get all discovery mode products
 */
export const getDiscoveryProducts = async (req, res) => {
    try {
        const prisma = getPrisma();
        if (!prisma || !prisma.deal) {
            return res.status(503).json({
                success: false,
                message: 'Database not available'
            });
        }

        const { limit = 100, offset = 0 } = req.query;

        const totalCount = await prisma.deal.count({
            where: { analysisMode: 'DISCOVERY' }
        });

        const deals = await prisma.deal.findMany({
            where: { analysisMode: 'DISCOVERY' },
            take: parseInt(limit),
            skip: parseInt(offset),
            orderBy: { analyzedAt: 'desc' }
        });

        const dealsWithMetadata = deals.map(deal => {
            const priceByRegion = (deal.priceByRegion || {});
            const marketData = (deal.marketData || {});
            return {
                ...deal,
                marketsAnalyzed: {
                    amazon: Object.keys(priceByRegion).filter(k => k.startsWith('Amazon')).length,
                    ebay: Object.keys(priceByRegion).filter(k => k.startsWith('eBay')).length
                },
                fxRates: marketData.fxRates || null
            };
        });

        res.status(200).json({
            success: true,
            data: dealsWithMetadata,
            count: dealsWithMetadata.length,
            total: totalCount,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error('[Discovery] Error fetching products:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching discovery products'
        });
    }
};

/**
 * DELETE /api/v1/discovery/:id
 */
export const deleteDiscoveryProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const prisma = getPrisma();

        if (!prisma || !prisma.deal) {
            return res.status(503).json({
                success: false,
                message: 'Database not available'
            });
        }

        const deal = await prisma.deal.findUnique({ where: { id } });

        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Discovery product not found'
            });
        }

        if (deal.analysisMode !== 'DISCOVERY') {
            return res.status(400).json({
                success: false,
                message: 'Product is not a discovery analysis'
            });
        }

        await prisma.deal.delete({ where: { id } });

        res.status(200).json({
            success: true,
            message: 'Discovery product deleted',
            data: { id }
        });

    } catch (error) {
        console.error('[Discovery] Error deleting:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting discovery product'
        });
    }
};

// Helper: Calculate overall demand level
function calculateDemandLevel(volumeByRegion) {
    const amazonEntries = Object.entries(volumeByRegion).filter(([k]) => k.startsWith('Amazon'));

    if (amazonEntries.length === 0) return 'UNKNOWN';

    // Average sales rank across Amazon markets
    const avgRank = amazonEntries.reduce((sum, [, data]) => sum + (data.salesRank || 999999), 0) / amazonEntries.length;

    if (avgRank < 10000) return 'HIGH';
    if (avgRank < 50000) return 'MEDIUM';
    if (avgRank < 200000) return 'LOW';
    return 'VERY_LOW';
}

// Helper: Generate demand signals
function generateDemandSignals(volumeByRegion, priceByRegion, dataSourceMode = 'live') {
    const isMock = dataSourceMode === 'mock';
    const prefix = isMock ? '[Mock] ' : '';
    const signals = [];

    // Check for high-volume markets
    const highVolumeMarkets = Object.entries(volumeByRegion)
        .filter(([k, v]) => k.startsWith('Amazon') && v.salesRank < 10000);

    if (highVolumeMarkets.length > 0) {
        signals.push(`${prefix}High volume in ${highVolumeMarkets.length} Amazon market(s)`);
    }

    // Check for recent sales data
    const recentSalesMarkets = Object.entries(volumeByRegion)
        .filter(([, v]) => v.recentSales);

    if (recentSalesMarkets.length > 0) {
        const salesLabel = isMock ? 'Mock sales data' : 'Recent sales data';
        signals.push(`${salesLabel} available: ${recentSalesMarkets.map(([k, v]) => `${k}: ${v.recentSales}`).join(', ')}`);
    }

    // Price variance analysis
    const prices = Object.values(priceByRegion).map(p => p.price).filter(p => p > 0);
    if (prices.length >= 2) {
        const maxPrice = Math.max(...prices);
        const minPrice = Math.min(...prices);
        const variance = ((maxPrice - minPrice) / minPrice * 100).toFixed(1);
        signals.push(`Price variance across markets: ${variance}%`);
    }

    // eBay activity
    const ebayListings = Object.entries(volumeByRegion)
        .filter(([k]) => k.startsWith('eBay'))
        .reduce((sum, [, v]) => sum + (v.activeListings || 0), 0);

    if (ebayListings > 0) {
        signals.push(`${ebayListings} active eBay listings`);
    }

    return signals;
}

export default {
    analyzeDiscovery,
    getDiscoveryProducts,
    deleteDiscoveryProduct
};
