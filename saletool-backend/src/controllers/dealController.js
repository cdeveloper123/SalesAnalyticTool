/**
 * Deal Analysis Controller
 * 
 * Main endpoint for multi-channel deal evaluation
 */

import { getAmazonProductData } from '../services/amazonService.js';
import ebayService from '../services/ebayService.js';
import { evaluateMultiChannel } from '../services/multiChannelEvaluator.js';
import assumptionVisibilityService from '../services/assumptionVisibilityService.js';
import { getPrisma } from '../config/database.js';
import PerformanceLogger from '../utils/performanceLogger.js';

/**
 * Check if override has actual values (not empty array or empty object)
 */
function hasActualOverrideValues(override) {
  if (!override) return false;
  
  // Handle arrays
  if (Array.isArray(override)) {
    return override.length > 0 && override.some(item => {
      if (!item || typeof item !== 'object') return false;
      // Check if object has any meaningful properties (excluding empty strings, null, undefined)
      return Object.keys(item).some(key => {
        const value = item[key];
        return value !== null && value !== undefined && value !== '';
      });
    });
  }
  
  // Handle objects
  if (typeof override === 'object') {
    const keys = Object.keys(override);
    if (keys.length === 0) return false;
    // Check if object has any meaningful values
    return keys.some(key => {
      const value = override[key];
      return value !== null && value !== undefined && value !== '';
    });
  }
  
  return true;
}

/**
 * POST /api/v1/analyze
 * 
 * Analyze a deal across multiple channels (Amazon + eBay)
 * 
 * Input:
 * {
 *   "ean": "0045496395230",
 *   "quantity": 100,
 *   "buyPrice": 50,
 *   "currency": "EUR",
 *   "supplierRegion": "CN" (optional)
 * }
 */
export const analyzeDeal = async (req, res) => {
  // Initialize performance logger
  const perfLogger = new PerformanceLogger();
  
  try {
    const { 
      ean, 
      quantity, 
      buyPrice, 
      currency = 'USD', 
      supplierRegion = 'Unknown',
      assumptionOverrides = null,
      dataSourceMode = 'live' // Frontend sends this: 'live' or 'mock'
    } = req.body;

    // Validation
    if (!ean) {
      return res.status(400).json({
        success: false,
        message: 'EAN is required'
      });
    }

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }

    if (!buyPrice || buyPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid buy price is required'
      });
    }

    console.log(`[Analyze Deal] EAN: ${ean}, Qty: ${quantity}, Buy: ${currency} ${buyPrice}`);


    const amazonMarkets = ['US', 'UK', 'DE', 'FR', 'IT', 'AU'];
    const amazonPricing = {};
    let productData = null;
    let productFoundInAnyMarket = false;

    for (const market of amazonMarkets) {
      try {
        // Early exit optimization: If we tried US and product not found, likely invalid EAN
        if (market !== 'US' && !productFoundInAnyMarket && amazonMarkets.indexOf(market) > 0) {
          console.log(`[Amazon ${market}] Skipping - product not found in US market (likely invalid EAN)`);
          continue;
        }

        // Track Amazon API call
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
              dimensions: {
                weightKg: product.weight_grams ? product.weight_grams / 1000 : 0.5
              }
            };
          }

          // Extract pricing data
          // Parse sales rank - try structured array first, then fallback to specifications_flat
          let salesRank = 999999;
          let salesRankCategory = 'Unknown';
          
          if (product.bestsellers_rank && product.bestsellers_rank.length > 0) {
            // Structured array available (UK, DE)
            salesRank = product.bestsellers_rank[0].rank || 999999;
            salesRankCategory = product.bestsellers_rank[0].category || 'Unknown';
          } else if (product.specifications_flat) {
            // Parse from specifications_flat (US fallback)
            // Pattern: "Best Sellers Rank: #5,945 in Electronics Accessories & Supplies"
            const rankMatch = product.specifications_flat.match(/Best Sellers Rank:.*?#([\d,]+)\s+in\s+([^.]+)/i);
            if (rankMatch) {
              salesRank = parseInt(rankMatch[1].replace(/,/g, ''), 10);
              salesRankCategory = rankMatch[2].trim();
            }
          }
          
          amazonPricing[market] = {
            buyBoxPrice: product.buybox_winner?.price?.value || 0,
            salesRank,
            salesRankCategory,
            fbaOffers: product.buybox_winner?.is_prime ? 1 : 0,
            // Use Amazon's actual sales data when available
            recentSales: product.recent_sales || null, // e.g., "1K+ bought in past month"
            ratingsTotal: product.ratings_total || 0,
            rating: product.rating || 0,
            priceHistory30d: {
              min: product.buybox_winner?.price?.value || 0,
              max: product.buybox_winner?.price?.value || 0,
              avg: product.buybox_winner?.price?.value || 0,
              trend: 'stable'
            }
          };

          // Debug: Log key demand data
          console.log(`[Amazon ${market}] Extracted: rank=${salesRank}, category=${salesRankCategory}, recentSales=${product.recent_sales || 'null'}, ratings=${product.ratings_total || 0}`);
          console.log(`[Amazon ${market}] Found product: ${product.title?.substring(0, 50)}...`);
        } else if (market === 'US') {
          console.log(`[Amazon US] Product not found - likely invalid EAN or not available on Amazon`);
        }
      } catch (error) {
        console.error(`[Amazon ${market}] Error:`, error.message);
      }
    }

    const ebayMarkets = ['US', 'UK', 'DE', 'FR', 'IT', 'AU'];
    const ebayPricing = {};

    if (productFoundInAnyMarket) {
      for (const market of ebayMarkets) {
        try {
          // Track eBay API call
          const ebayResult = await perfLogger.trackAPI(
            'eBay',
            `getProductPricingByEAN-${market}`,
            () => ebayService.getProductPricingByEAN(ean, market),
            { market, ean }
          );

          if (ebayResult) {
            ebayPricing[market] = {
              buyBoxPrice: ebayResult.buyBoxPrice,
              activeListings: ebayResult.activeListings,
              estimatedMonthlySales: ebayResult.estimatedMonthlySales,
              confidence: ebayResult.confidence
            };

            console.log(`[eBay ${market}] Avg Price: ${ebayResult.currency} ${ebayResult.buyBoxPrice}`);
          }
        } catch (error) {
          console.error(`[eBay ${market}] Error:`, error.message);
        }
      }
    } else {
      console.log('[eBay] Skipping eBay lookups - product not found on Amazon');
    }

    if (Object.keys(amazonPricing).length === 0 && Object.keys(ebayPricing).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found on Amazon or eBay',
        data: { ean }
      });
    }

    // Track backend logic: Multi-channel evaluation
    const evaluation = await perfLogger.trackLogic(
      'evaluateMultiChannel',
      () => Promise.resolve(evaluateMultiChannel(
      { ean, quantity, buyPrice, currency, supplierRegion },
      productData,
      amazonPricing,
      ebayPricing,
      assumptionOverrides
      )),
      { ean, channelsCount: Object.keys(amazonPricing).length + Object.keys(ebayPricing).length }
    );

    // Track assumption processing logic
    const assumptions = await perfLogger.trackLogic(
      'getAllAssumptionsUsed',
      () => Promise.resolve(assumptionVisibilityService.getAllAssumptionsUsed(
      evaluation,
      assumptionOverrides,
      { ean, quantity, buyPrice, currency, supplierRegion }
      ))
    );

    // Format for API response (but store raw assumptions in DB)
    const formattedAssumptions = await perfLogger.trackLogic(
      'formatAssumptionsForDisplay',
      () => Promise.resolve(assumptionVisibilityService.formatAssumptionsForDisplay(assumptions))
    );

    // Prepare response data
    const responseData = {
      input: {
        ean,
        quantity,
        buyPrice,
        currency,
        supplierRegion
      },
      product: productData,
      evaluation: {
        dealScore: evaluation.dealScore.overall,
        scoreBreakdown: evaluation.dealScore.breakdown,
        decision: evaluation.decision,
        explanation: evaluation.explanation,
        bestChannel: evaluation.bestChannel,
        channelAnalysis: evaluation.channelAnalysis,
        allocation: evaluation.allocationRecommendation,
        negotiationSupport: evaluation.negotiationSupport || null,
        sourcingSuggestions: evaluation.sourcingSuggestions || null,
        compliance: evaluation.compliance || null
      },
      assumptions: formattedAssumptions,
      marketData: {
        amazonMarketsFound: Object.keys(amazonPricing),
        ebayMarketsFound: Object.keys(ebayPricing)
      }
    };

    // Save deal to database
    try {
      const prisma = getPrisma();
      if (!prisma || !prisma.deal) {
        console.warn('[Deal Controller] Prisma client not available, skipping save');
      } else {
        const savedDeal = await perfLogger.trackDB(
          'deal.create',
          () => prisma.deal.create({
        data: {
          ean,
          productName: productData?.title || `Product ${ean}`,
          quantity,
          buyPrice,
          currency,
          supplierRegion,
          dealScore: evaluation.dealScore.overall,
          netMargin: evaluation.bestChannel?.marginPercent || 0,
          demandConfidence: evaluation.dealScore.breakdown?.demandConfidenceScore || 0,
          volumeRisk: evaluation.dealScore.breakdown?.volumeRiskScore || 0,
          dataReliability: evaluation.dealScore.breakdown?.dataReliabilityScore || 0,
          decision: evaluation.decision,
          explanation: evaluation.explanation || null,
          bestChannel: evaluation.bestChannel?.channel || null,
          bestMarketplace: evaluation.bestChannel?.marketplace || null,
          bestMarginPercent: evaluation.bestChannel?.marginPercent || null,
          bestCurrency: evaluation.bestChannel?.currency || null,
          evaluationData: responseData.evaluation,
          productData: productData || null,
          marketData: responseData.marketData,
          assumptions: assumptions  // Store raw assumptions (not formatted) so we can format on retrieval
        }
          }),
          { ean }
        );

        // Add deal ID to response
        responseData.dealId = savedDeal.id;

        // Save assumption overrides to AssumptionOverride table if provided
        if (assumptionOverrides && (assumptionOverrides.shippingOverrides || assumptionOverrides.dutyOverrides || assumptionOverrides.feeOverrides)) {
          try {
            // Check if override already exists for this deal
            const existingOverride = await perfLogger.trackDB(
              'assumptionOverride.findFirst',
              () => prisma.assumptionOverride.findFirst({
              where: { dealId: savedDeal.id }
              }),
              { dealId: savedDeal.id }
            );

            let oldOverrideValues = null;
            if (existingOverride) {
              oldOverrideValues = {
                shippingOverrides: existingOverride.shippingOverrides,
                dutyOverrides: existingOverride.dutyOverrides,
                feeOverrides: existingOverride.feeOverrides
              };
            }

            if (existingOverride) {
              // Update existing override and track history
              await perfLogger.trackDB(
                'assumptionOverride.update',
                () => prisma.assumptionOverride.update({
                where: { id: existingOverride.id },
                data: {
                  shippingOverrides: assumptionOverrides.shippingOverrides || existingOverride.shippingOverrides,
                  dutyOverrides: assumptionOverrides.dutyOverrides || existingOverride.dutyOverrides,
                  feeOverrides: assumptionOverrides.feeOverrides || existingOverride.feeOverrides,
                  updatedAt: new Date()
                }
                }),
                { overrideId: existingOverride.id }
              );

              // Track assumption changes in history
              if (oldOverrideValues) {
                const changes = [];
                if (JSON.stringify(oldOverrideValues.shippingOverrides) !== JSON.stringify(assumptionOverrides.shippingOverrides)) {
                  changes.push({
                    dealId: savedDeal.id,
                    assumptionType: 'shipping',
                    oldValue: oldOverrideValues.shippingOverrides,
                    newValue: assumptionOverrides.shippingOverrides,
                    changedBy: 'system'
                  });
                }
                if (JSON.stringify(oldOverrideValues.dutyOverrides) !== JSON.stringify(assumptionOverrides.dutyOverrides)) {
                  changes.push({
                    dealId: savedDeal.id,
                    assumptionType: 'duty',
                    oldValue: oldOverrideValues.dutyOverrides,
                    newValue: assumptionOverrides.dutyOverrides,
                    changedBy: 'system'
                  });
                }
                if (JSON.stringify(oldOverrideValues.feeOverrides) !== JSON.stringify(assumptionOverrides.feeOverrides)) {
                  changes.push({
                    dealId: savedDeal.id,
                    assumptionType: 'fee',
                    oldValue: oldOverrideValues.feeOverrides,
                    newValue: assumptionOverrides.feeOverrides,
                    changedBy: 'system'
                  });
                }

                // Save history entries
                for (const change of changes) {
                  await perfLogger.trackDB(
                    'assumptionHistory.create',
                    () => prisma.assumptionHistory.create({
                    data: change
                    }),
                    { assumptionType: change.assumptionType, dealId: change.dealId }
                  );
                }
              }
            } else {
              // Create new override linked to this deal
              await perfLogger.trackDB(
                'assumptionOverride.create',
                () => prisma.assumptionOverride.create({
                data: {
                  dealId: savedDeal.id,
                  shippingOverrides: assumptionOverrides.shippingOverrides || null,
                  dutyOverrides: assumptionOverrides.dutyOverrides || null,
                  feeOverrides: assumptionOverrides.feeOverrides || null
                }
                }),
                { dealId: savedDeal.id }
              );

              // Don't create history for initial override creation on new products
              // History should only track changes AFTER the initial creation
              // This prevents showing history for brand new products
            }
          } catch (overrideError) {
            console.error('[Deal Controller] Error saving assumption overrides:', overrideError);
            // Continue even if override save fails
          }
        }
        
        // Update deal with final performance metrics after all DB operations
        const finalPerformanceMetrics = perfLogger.getMetrics();
        await perfLogger.trackDB(
          'deal.update',
          () => prisma.deal.update({
            where: { id: savedDeal.id },
            data: { performanceMetrics: finalPerformanceMetrics }
          }),
          { dealId: savedDeal.id }
        );
      }
    } catch (dbError) {
      console.error('[Deal Controller] Error saving deal to database:', dbError);
      // Continue even if save fails - don't break the API response
    }

    // Log performance summary
    const perfSummary = perfLogger.getSummary();
    console.log(`[PERF] Product ${ean} - Total: ${perfSummary.total}ms | DB: ${perfSummary.db.total}ms (${perfSummary.db.percentage}%) | API: ${perfSummary.api.total}ms (${perfSummary.api.percentage}%) | Logic: ${perfSummary.logic.total}ms (${perfSummary.logic.percentage}%)`);

    res.status(200).json({
      success: true,
      message: 'Deal analyzed successfully',
      data: responseData
    });

  } catch (error) {
    console.error('[Analyze Deal] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error analyzing deal',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/v1/deals
 * 
 * Get all saved deals/products
 */
export const getDeals = async (req, res) => {
  try {
    const prisma = getPrisma();
    if (!prisma || !prisma.deal) {
      return res.status(503).json({
        success: false,
        message: 'Database not available. Please run Prisma migration first.',
        error: 'Prisma client not initialized'
      });
    }
    const { limit = 100, offset = 0, orderBy = 'analyzedAt', order = 'desc' } = req.query;

    // Get total count of all deals (for pagination)
    const totalCount = await prisma.deal.count();

    const deals = await prisma.deal.findMany({
      take: parseInt(limit),
      skip: parseInt(offset),
      orderBy: {
        [orderBy]: order
      }
    });

    // Fetch assumption history for each deal
    const dealsWithHistory = await Promise.all(
      deals.map(async (deal) => {
        try {
          const history = await prisma.assumptionHistory.findMany({
            where: { dealId: deal.id },
            orderBy: { createdAt: 'desc' },
            take: 50
          });

          // Add history to assumptions
          const assumptions = deal.assumptions || {};
          assumptions.history = history.map(h => ({
            id: h.id,
            dealId: h.dealId,
            assumptionType: h.assumptionType,
            oldValue: h.oldValue,
            newValue: h.newValue,
            changedBy: h.changedBy,
            timestamp: h.createdAt.toISOString()
          }));

          return {
            ...deal,
            assumptions
          };
        } catch (historyError) {
          console.warn(`[Deal Controller] Could not fetch history for deal ${deal.id}:`, historyError.message);
          return deal;
        }
      })
    );

    res.status(200).json({
      success: true,
      data: dealsWithHistory,
      count: dealsWithHistory.length,
      total: totalCount,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('[Deal Controller] Error fetching deals:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching deals',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * DELETE /api/v1/deals/:id
 * 
 * Delete a saved deal/product
 */
export const deleteDeal = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Deal ID is required'
      });
    }

    const prisma = getPrisma();
    if (!prisma || !prisma.deal) {
      return res.status(503).json({
        success: false,
        message: 'Database not available',
        error: 'Prisma client not initialized'
      });
    }

    // Check if deal exists
    const deal = await prisma.deal.findUnique({
      where: { id }
    });

    if (!deal) {
      return res.status(404).json({
        success: false,
        message: 'Deal not found'
      });
    }

    // Delete related assumption overrides
    try {
      await prisma.assumptionOverride.deleteMany({
        where: { dealId: id }
      });
    } catch (overrideError) {
      console.warn(`[Deal Controller] Could not delete overrides for deal ${id}:`, overrideError.message);
      // Continue with deal deletion even if override deletion fails
    }

    // Delete related assumption history
    try {
      await prisma.assumptionHistory.deleteMany({
        where: { dealId: id }
      });
    } catch (historyError) {
      console.warn(`[Deal Controller] Could not delete history for deal ${id}:`, historyError.message);
      // Continue with deal deletion even if history deletion fails
    }

    // Delete the deal
    await prisma.deal.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Deal deleted successfully',
      data: { id }
    });
  } catch (error) {
    console.error('[Deal Controller] Error deleting deal:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting deal',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export default {
  analyzeDeal,
  getDeals,
  deleteDeal
};
