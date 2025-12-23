/**
 * Deal Analysis Controller
 * 
 * Main endpoint for multi-channel deal evaluation
 */

import { getAmazonProductData } from '../services/amazonService.js';
import ebayService from '../services/ebayService.js';
import { evaluateMultiChannel } from '../services/multiChannelEvaluator.js';

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
  try {
    const { ean, quantity, buyPrice, currency = 'USD', supplierRegion = 'Unknown' } = req.body;

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

        const amazonResult = await getAmazonProductData(ean, market);

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
          const ebayResult = await ebayService.getProductPricingByEAN(ean, market);

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

    const evaluation = evaluateMultiChannel(
      { ean, quantity, buyPrice, currency, supplierRegion },
      productData,
      amazonPricing,
      ebayPricing
    );

    res.status(200).json({
      success: true,
      message: 'Deal analyzed successfully',
      data: {
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
        marketData: {
          amazonMarketsFound: Object.keys(amazonPricing),
          ebayMarketsFound: Object.keys(ebayPricing)
        }
      }
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

export default {
  analyzeDeal
};
