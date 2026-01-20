/**
 * Quick Lookup Controller
 * 
 * Quick Lookup Mode: EAN only → price, demand, risk snapshot
 * Now covers all markets like Deal mode (Amazon, eBay, Walmart, Target)
 */

import { getAmazonProductData } from '../services/amazonService.js';
import ebayService from '../services/ebayService.js';
import retailerService from '../services/retailerService.js';
import { getPrisma } from '../config/database.js';
import PerformanceLogger from '../utils/performanceLogger.js';

/**
 * POST /api/v1/quicklookup/analyze
 * 
 * Quick snapshot of a product by EAN across all marketplaces
 * 
 * Input:
 * {
 *   "ean": "0045496395230",
 *   "dataSourceMode": "live" | "mock"
 * }
 */
export const analyzeQuickLookup = async (req, res) => {
    const perfLogger = new PerformanceLogger();

    try {
        const {
            ean,
            dataSourceMode = 'live'
        } = req.body;

        // Validation
        if (!ean) {
            return res.status(400).json({
                success: false,
                message: 'EAN is required for Quick Lookup'
            });
        }

        console.log(`[Quick Lookup] Analyzing: EAN=${ean}, Mode=${dataSourceMode}`);

        // All markets (same as Deal mode)
        const allMarkets = ['US', 'UK', 'DE', 'FR', 'IT', 'AU'];

        let productData = null;
        let productFoundInAnyMarket = false;
        let pricesByChannel = {};  // Store best price per channel
        let demandIndicators = {};
        let riskFlags = [];

        // ========================================================================
        // STEP 1: AMAZON LOOKUP (all markets, with early exit optimization)
        // ========================================================================
        for (const market of allMarkets) {
            try {
                // Early exit optimization: If US not found, skip other markets
                if (market !== 'US' && !productFoundInAnyMarket && allMarkets.indexOf(market) > 0) {
                    console.log(`[Quick Lookup Amazon ${market}] Skipping - product not found in US`);
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

                    // Extract product data (only once)
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

                    // Store Amazon price for this market
                    if (price > 0) {
                        const marketKey = `Amazon-${market}`;
                        if (!pricesByChannel[marketKey] || price > pricesByChannel[marketKey].price) {
                            pricesByChannel[marketKey] = {
                                price,
                                currency,
                                market: marketKey,
                                channel: 'Amazon',
                                marketplace: market,
                                dataSource: amazonResult.dataSource || dataSourceMode
                            };
                        }
                    }

                    // Demand indicators from sales rank
                    let salesRank = 999999;
                    let salesRankCategory = 'Unknown';

                    if (product.bestsellers_rank && product.bestsellers_rank.length > 0) {
                        salesRank = product.bestsellers_rank[0].rank || 999999;
                        salesRankCategory = product.bestsellers_rank[0].category || 'Unknown';
                    } else if (product.specifications_flat) {
                        const rankMatch = product.specifications_flat.match(/Best Sellers Rank:.*?#([\d,]+)\s+in\s+([^.]+)/i);
                        if (rankMatch) {
                            salesRank = parseInt(rankMatch[1].replace(/,/g, ''), 10);
                            salesRankCategory = rankMatch[2].trim();
                        }
                    }

                    demandIndicators[market] = {
                        salesRank,
                        salesRankCategory,
                        recentSales: product.recent_sales || null,
                        ratingsTotal: product.ratings_total || 0,
                        rating: product.rating || 0,
                        dataSource: amazonResult.dataSource || dataSourceMode
                    };

                    // Risk flags
                    if (!product.buybox_winner?.is_prime) {
                        riskFlags.push(`No FBA offer in Amazon-${market}`);
                    }
                    if (salesRank > 100000) {
                        riskFlags.push(`Low sales rank in Amazon-${market} (#${salesRank.toLocaleString()})`);
                    }
                    if (product.ratings_total && product.ratings_total < 50) {
                        riskFlags.push(`Low review count in Amazon-${market} (${product.ratings_total})`);
                    }

                    console.log(`[Quick Lookup Amazon ${market}] Price: ${currency} ${price}, Rank: ${salesRank}`);
                } else if (market === 'US') {
                    console.log(`[Quick Lookup Amazon US] Product not found - likely invalid EAN`);
                }
            } catch (error) {
                console.error(`[Quick Lookup Amazon ${market}] Error:`, error.message);
            }
        }

        // If product not found in any Amazon market, return 404
        if (!productData) {
            return res.status(404).json({
                success: false,
                message: 'Product not found on Amazon',
                data: { ean }
            });
        }

        // ========================================================================
        // STEP 2: EBAY LOOKUP (all markets, only if product found on Amazon)
        // ========================================================================
        for (const market of allMarkets) {
            try {
                const ebayResult = await perfLogger.trackAPI(
                    'eBay',
                    `getProductPricingByEAN-${market}`,
                    () => ebayService.getProductPricingByEAN(ean, market),
                    { market, ean }
                );

                if (ebayResult && ebayResult.buyBoxPrice > 0) {
                    const marketKey = `eBay-${market}`;

                    pricesByChannel[marketKey] = {
                        price: ebayResult.buyBoxPrice,
                        currency: ebayResult.currency || 'USD',
                        market: marketKey,
                        channel: 'eBay',
                        marketplace: market,
                        dataSource: ebayResult.dataSource || 'live'
                    };

                    demandIndicators[marketKey] = {
                        estimatedMonthlySales: ebayResult.estimatedMonthlySales || 0,
                        activeListings: ebayResult.activeListings || 0,
                        confidence: ebayResult.confidence || 'Low',
                        soldLast90Days: ebayResult.soldLast90Days || 0,
                        dataSource: ebayResult.dataSource || 'live'
                    };

                    console.log(`[Quick Lookup eBay ${market}] Price: ${ebayResult.currency} ${ebayResult.buyBoxPrice}`);
                }
            } catch (error) {
                console.error(`[Quick Lookup eBay ${market}] Error:`, error.message);
            }
        }

        // ========================================================================
        // STEP 3: RETAILERS (Walmart, Target - derived from Amazon US price)
        // ========================================================================
        const amazonUSPrice = pricesByChannel['Amazon-US']?.price || 0;
        if (amazonUSPrice > 0) {
            try {
                const retailerChannels = retailerService.getRetailerPricing(
                    productData,
                    amazonUSPrice,
                    productData.category
                );

                for (const retailer of retailerChannels) {
                    const marketKey = `${retailer.retailer}-${retailer.marketplace}`;

                    pricesByChannel[marketKey] = {
                        price: retailer.sellPrice,
                        currency: retailer.currency,
                        market: marketKey,
                        channel: 'Retailer',
                        retailer: retailer.retailer,
                        marketplace: retailer.marketplace,
                        dataSource: 'mock'  // Retailers are always mocked
                    };

                    demandIndicators[marketKey] = {
                        estimatedMonthlySales: retailer.demand?.estimatedMonthlySales?.mid || 0,
                        confidence: retailer.demand?.confidence || 'Low',
                        dataSource: 'mock'
                    };

                    console.log(`[Quick Lookup ${retailer.retailer}] Price: ${retailer.currency} ${retailer.sellPrice}`);
                }
            } catch (error) {
                console.error('[Quick Lookup Retailers] Error:', error.message);
            }
        }

        // ========================================================================
        // STEP 4: CALCULATE BEST PRICE, DEMAND LEVEL, RISK LEVEL
        // ========================================================================

        // Find best (highest) price across all channels
        let bestPrice = null;
        for (const [key, priceData] of Object.entries(pricesByChannel)) {
            if (!bestPrice || priceData.price > bestPrice.price) {
                bestPrice = priceData;
            }
        }

        // Calculate overall demand level (now returns object with more data)
        const demandResult = calculateDemandLevel(demandIndicators);

        // Calculate risk level
        const riskLevel = calculateRiskLevel(riskFlags, demandIndicators);

        // ========================================================================
        // STEP 5: PREPARE RESPONSE & SAVE
        // ========================================================================
        const responseData = {
            ean,
            productName: productData?.title,
            analysisMode: 'quickLookup',
            dataSourceMode,
            product: productData,
            currentPrice: bestPrice,
            pricesByChannel,  // All prices from all channels
            demand: {
                level: demandResult.level,
                compositeScore: demandResult.compositeScore,
                sources: demandResult.sources,  // Each source has .best with best region
                marketsAnalyzed: demandResult.marketsAnalyzed,
                confidence: demandResult.level === 'UNKNOWN' ? 'NONE' : (demandResult.level === 'HIGH' ? 'HIGH' : 'MEDIUM'),
                indicators: demandIndicators
            },
            riskSnapshot: {
                level: riskLevel,
                flags: [...new Set(riskFlags)]  // De-duplicate
            },
            marketData: {
                amazonMarketsFound: Object.keys(pricesByChannel).filter(k => k.startsWith('Amazon-')).length,
                ebayMarketsFound: Object.keys(pricesByChannel).filter(k => k.startsWith('eBay-')).length,
                retailersFound: Object.keys(pricesByChannel).filter(k =>
                    k.startsWith('Walmart-') || k.startsWith('Target-')
                ).length
            },
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
                            ean,
                            productName: productData?.title || `Quick Lookup ${ean}`,
                            analysisMode: 'QUICK_LOOKUP',
                            dataSourceMode,
                            currentPrice: bestPrice,
                            priceByRegion: pricesByChannel,  // Save all market prices
                            demandSignals: responseData.demand,
                            riskSnapshot: responseData.riskSnapshot,
                            productData: productData || null,
                            marketData: responseData.marketData
                        }
                    }),
                    { ean }
                );

                responseData.id = savedDeal.id;
            }
        } catch (dbError) {
            console.error('[Quick Lookup] Error saving to database:', dbError);
        }

        // Log performance
        const perfSummary = perfLogger.getSummary();
        console.log(`[PERF Quick Lookup] ${ean} - Total: ${perfSummary.total}ms | API: ${perfSummary.api?.total || 0}ms | DB: ${perfSummary.db?.total || 0}ms`);

        res.status(200).json({
            success: true,
            message: 'Quick Lookup completed',
            data: responseData
        });

    } catch (error) {
        console.error('[Quick Lookup] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error performing quick lookup',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/v1/quicklookup
 * 
 * Get all quick lookup products
 */
export const getQuickLookupProducts = async (req, res) => {
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
            where: { analysisMode: 'QUICK_LOOKUP' }
        });

        const deals = await prisma.deal.findMany({
            where: { analysisMode: 'QUICK_LOOKUP' },
            take: parseInt(limit),
            skip: parseInt(offset),
            orderBy: { analyzedAt: 'desc' }
        });

        res.status(200).json({
            success: true,
            data: deals,
            count: deals.length,
            total: totalCount,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error('[Quick Lookup] Error fetching products:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching quick lookup products'
        });
    }
};

/**
 * DELETE /api/v1/quicklookup/:id
 */
export const deleteQuickLookupProduct = async (req, res) => {
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
                message: 'Quick Lookup product not found'
            });
        }

        if (deal.analysisMode !== 'QUICK_LOOKUP') {
            return res.status(400).json({
                success: false,
                message: 'Product is not a quick lookup analysis'
            });
        }

        await prisma.deal.delete({ where: { id } });

        res.status(200).json({
            success: true,
            message: 'Quick Lookup product deleted',
            data: { id }
        });

    } catch (error) {
        console.error('[Quick Lookup] Error deleting:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting quick lookup product'
        });
    }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate overall demand level from ALL indicators (Amazon, eBay, Retailers)
 * Uses composite scoring:
 * - Amazon: Based on average sales rank (0-100 score)
 * - eBay: Based on estimated monthly sales (0-100 score)
 * - Retailers: Based on estimated monthly sales (0-100 score, weighted less due to mocked data)
 * 
 * @returns {Object} { level, compositeScore, highestDemandRegion, sources, marketsAnalyzed }
 */
function calculateDemandLevel(indicators) {
    const sources = {
        amazon: { count: 0, avgRank: null, score: 0, best: null },
        ebay: { count: 0, avgMonthlySales: 0, score: 0, best: null },
        retailers: { count: 0, avgMonthlySales: 0, score: 0, best: null }
    };

    let totalMarkets = 0;

    // Process all indicators
    for (const [market, data] of Object.entries(indicators)) {
        const isAmazon = !market.includes('-');  // Amazon keys are 'US', 'UK', etc.
        const isEbay = market.startsWith('eBay-');
        const isRetailer = market.startsWith('Walmart-') || market.startsWith('Target-');

        if (isAmazon && data.salesRank && data.salesRank < 999999) {
            // Amazon: Convert rank to score (lower rank = higher score)
            // Improved formula: rank 1 = 100, rank 10K = 60, rank 100K = 40, rank 1M = 20
            const rankScore = Math.max(0, 100 - (Math.log10(data.salesRank) * 15));
            sources.amazon.count++;
            sources.amazon.avgRank = sources.amazon.avgRank
                ? (sources.amazon.avgRank + data.salesRank) / 2
                : data.salesRank;
            sources.amazon.score += rankScore;
            totalMarkets++;

            // Track best Amazon market (lowest rank)
            if (!sources.amazon.best || data.salesRank < sources.amazon.best.rank) {
                sources.amazon.best = {
                    market: `Amazon ${market}`,
                    marketCode: market,
                    rank: data.salesRank
                };
            }
        } else if (isEbay && data.estimatedMonthlySales !== undefined) {
            // eBay: Convert monthly sales to score
            const salesScore = Math.min(100, data.estimatedMonthlySales * 1.5);
            sources.ebay.count++;
            sources.ebay.avgMonthlySales += data.estimatedMonthlySales;
            sources.ebay.score += salesScore;
            totalMarkets++;

            // Track best eBay market (highest sales)
            if (!sources.ebay.best || data.estimatedMonthlySales > sources.ebay.best.monthlySales) {
                sources.ebay.best = {
                    market: market,
                    marketCode: market.replace('eBay-', ''),
                    monthlySales: data.estimatedMonthlySales
                };
            }
        } else if (isRetailer && data.estimatedMonthlySales !== undefined) {
            // Retailers: Convert monthly sales to score (weighted less - mocked data)
            const salesScore = Math.min(100, data.estimatedMonthlySales * 1.5) * 0.5; // 50% weight
            sources.retailers.count++;
            sources.retailers.avgMonthlySales += data.estimatedMonthlySales;
            sources.retailers.score += salesScore;
            totalMarkets++;

            // Track best retailer (highest sales)
            if (!sources.retailers.best || data.estimatedMonthlySales > sources.retailers.best.monthlySales) {
                sources.retailers.best = {
                    market: market.replace('-', ' '),
                    marketCode: market,
                    monthlySales: data.estimatedMonthlySales
                };
            }
        }
    }

    // Finalize averages
    if (sources.ebay.count > 0) {
        sources.ebay.avgMonthlySales = Math.round(sources.ebay.avgMonthlySales / sources.ebay.count);
        sources.ebay.score = Math.round(sources.ebay.score / sources.ebay.count);
    }
    if (sources.retailers.count > 0) {
        sources.retailers.avgMonthlySales = Math.round(sources.retailers.avgMonthlySales / sources.retailers.count);
        sources.retailers.score = Math.round(sources.retailers.score / sources.retailers.count);
    }
    if (sources.amazon.count > 0) {
        sources.amazon.avgRank = Math.round(sources.amazon.avgRank);
        sources.amazon.score = Math.round(sources.amazon.score / sources.amazon.count);
    }

    // Calculate composite score (weighted average)
    // Amazon: 50% weight (most reliable)
    // eBay: 35% weight (live data)
    // Retailers: 15% weight (mocked data)
    let compositeScore = 0;
    let totalWeight = 0;

    if (sources.amazon.count > 0) {
        compositeScore += sources.amazon.score * 0.50;
        totalWeight += 0.50;
    }
    if (sources.ebay.count > 0) {
        compositeScore += sources.ebay.score * 0.35;
        totalWeight += 0.35;
    }
    if (sources.retailers.count > 0) {
        compositeScore += sources.retailers.score * 0.15;
        totalWeight += 0.15;
    }

    // Normalize if not all sources present
    if (totalWeight > 0 && totalWeight < 1) {
        compositeScore = compositeScore / totalWeight;
    }

    compositeScore = Math.round(compositeScore);

    // Determine level from composite score
    let level;
    if (compositeScore >= 70) level = 'HIGH';
    else if (compositeScore >= 45) level = 'MEDIUM';
    else if (compositeScore >= 20) level = 'LOW';
    else if (totalMarkets === 0) level = 'UNKNOWN';
    else level = 'VERY_LOW';

    return {
        level,
        compositeScore,
        sources,  // Each source now has .best with best region for that channel
        marketsAnalyzed: totalMarkets
    };
}

/**
 * Calculate risk level from flags and demand data
 */
function calculateRiskLevel(flags, indicators) {
    const uniqueFlags = [...new Set(flags)];

    // High risk: 3+ flags
    if (uniqueFlags.length >= 3) return 'HIGH';

    // Check demand quality
    const hasGoodDemand = Object.entries(indicators).some(([, data]) =>
        (data.salesRank && data.salesRank < 50000) ||
        (data.estimatedMonthlySales && data.estimatedMonthlySales > 50)
    );

    // No good demand + flags = higher risk
    if (!hasGoodDemand && uniqueFlags.length >= 1) return 'HIGH';
    if (uniqueFlags.length >= 2) return 'MEDIUM';
    if (uniqueFlags.length === 1) return 'LOW';

    return 'LOW';
}

export default {
    analyzeQuickLookup,
    getQuickLookupProducts,
    deleteQuickLookupProduct
};
