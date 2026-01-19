/**
 * Quick Lookup Controller
 * 
 * Quick Lookup Mode: EAN only → price, demand, risk snapshot
 * Lightweight analysis - no allocation or negotiation analysis
 */

import { getAmazonProductData } from '../services/amazonService.js';
import ebayService from '../services/ebayService.js';
import { getPrisma } from '../config/database.js';
import PerformanceLogger from '../utils/performanceLogger.js';

/**
 * POST /api/v1/quicklookup/analyze
 * 
 * Quick snapshot of a product by EAN
 * 
 * Input:
 * {
 *   "ean": "0045496395230"
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

        console.log(`[Quick Lookup] Analyzing: EAN=${ean}`);

        // Fetch from primary markets only (US and UK for speed)
        const primaryMarkets = ['US', 'UK'];
        let productData = null;
        let bestPrice = null;
        let demandIndicators = {};
        let riskFlags = [];

        // Amazon lookup (primary source)
        for (const market of primaryMarkets) {
            try {
                const amazonResult = await perfLogger.trackAPI(
                    'Amazon',
                    `getProductData-${market}`,
                    () => getAmazonProductData(ean, market, dataSourceMode),
                    { market, ean }
                );

                if (amazonResult.success && amazonResult.product) {
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

                    if (!bestPrice || price > bestPrice.price) {
                        bestPrice = {
                            price,
                            currency,
                            market: `Amazon-${market}`,
                            channel: 'Amazon',
                            marketplace: market,
                            dataSource: amazonResult.dataSource || dataSourceMode
                        };
                    }

                    // Demand indicators from sales rank
                    let salesRank = 999999;
                    if (product.bestsellers_rank && product.bestsellers_rank.length > 0) {
                        salesRank = product.bestsellers_rank[0].rank || 999999;
                    } else if (product.specifications_flat) {
                        const rankMatch = product.specifications_flat.match(/Best Sellers Rank:.*?#([\d,]+)/i);
                        if (rankMatch) {
                            salesRank = parseInt(rankMatch[1].replace(/,/g, ''), 10);
                        }
                    }

                    demandIndicators[market] = {
                        salesRank,
                        recentSales: product.recent_sales || null,
                        ratingsTotal: product.ratings_total || 0,
                        rating: product.rating || 0,
                        dataSource: amazonResult.dataSource || dataSourceMode
                    };

                    // Risk flags
                    if (!product.buybox_winner?.is_prime) {
                        riskFlags.push(`No FBA offer in ${market}`);
                    }
                    if (salesRank > 100000) {
                        riskFlags.push(`Low sales rank in ${market} (${salesRank})`);
                    }
                    if (product.ratingsTotal && product.ratingsTotal < 50) {
                        riskFlags.push(`Low review count in ${market} (${product.ratingsTotal})`);
                    }

                    console.log(`[Quick Lookup Amazon ${market}] Price: ${currency} ${price}, Rank: ${salesRank}`);
                    break; // Found in one market, proceed to eBay
                }
            } catch (error) {
                console.error(`[Quick Lookup Amazon ${market}] Error:`, error.message);
            }
        }

        if (!productData) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
                data: { ean }
            });
        }

        // Quick eBay check (just first available market)
        for (const market of primaryMarkets) {
            try {
                const ebayResult = await perfLogger.trackAPI(
                    'eBay',
                    `getProductPricingByEAN-${market}`,
                    () => ebayService.getProductPricingByEAN(ean, market),
                    { market, ean }
                );

                if (ebayResult && ebayResult.buyBoxPrice > 0) {
                    if (!bestPrice || ebayResult.buyBoxPrice > bestPrice.price) {
                        bestPrice = {
                            price: ebayResult.buyBoxPrice,
                            currency: ebayResult.currency || 'USD',
                            market: `eBay-${market}`,
                            channel: 'eBay',
                            marketplace: market,
                            dataSource: ebayResult.dataSource || dataSourceMode
                        };
                    }

                    demandIndicators[`eBay-${market}`] = {
                        estimatedMonthlySales: ebayResult.estimatedMonthlySales || 0,
                        activeListings: ebayResult.activeListings || 0,
                        confidence: ebayResult.confidence || 'LOW',
                        dataSource: ebayResult.dataSource || 'live'
                    };

                    break; // Got eBay data
                }
            } catch (error) {
                console.error(`[Quick Lookup eBay ${market}] Error:`, error.message);
            }
        }

        // Calculate demand level
        const demandLevel = calculateDemandLevel(demandIndicators);

        // Calculate risk level
        const riskLevel = calculateRiskLevel(riskFlags, demandIndicators);

        // Prepare response
        const responseData = {
            ean,
            productName: productData?.title,
            analysisMode: 'quickLookup',
            dataSourceMode,  // Track if mock or live data was used
            product: productData,
            currentPrice: bestPrice,
            demand: {
                level: demandLevel,
                confidence: demandLevel === 'UNKNOWN' ? 'NONE' : (demandLevel === 'HIGH' ? 'HIGH' : 'MEDIUM'),
                indicators: demandIndicators
            },
            riskSnapshot: {
                level: riskLevel,
                flags: [...new Set(riskFlags)] // De-duplicate flags
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
                            dataSourceMode,  // Track if mock or live data was used
                            // Quick Lookup specific fields
                            currentPrice: bestPrice,
                            demandSignals: responseData.demand,
                            riskSnapshot: responseData.riskSnapshot,
                            // Store product data
                            productData: productData || null
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
        console.log(`[PERF Quick Lookup] ${ean} - Total: ${perfSummary.total}ms`);

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

// Helper: Calculate demand level from indicators
function calculateDemandLevel(indicators) {
    const amazonIndicators = Object.entries(indicators)
        .filter(([k]) => k === 'US' || k === 'UK');

    if (amazonIndicators.length === 0) return 'UNKNOWN';

    // Use best (lowest) sales rank
    const bestRank = Math.min(
        ...amazonIndicators.map(([, data]) => data.salesRank || 999999)
    );

    if (bestRank < 5000) return 'HIGH';
    if (bestRank < 25000) return 'MEDIUM';
    if (bestRank < 100000) return 'LOW';
    return 'VERY_LOW';
}

// Helper: Calculate risk level from flags
function calculateRiskLevel(flags, indicators) {
    const uniqueFlags = [...new Set(flags)];

    // High risk conditions
    if (uniqueFlags.length >= 3) return 'HIGH';

    // Check if no demand data
    const hasGoodDemand = Object.entries(indicators)
        .some(([, data]) => (data.salesRank && data.salesRank < 50000) || (data.estimatedMonthlySales && data.estimatedMonthlySales > 10));

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
