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
    
    // Step 1: Fetch Amazon data for multiple markets
    const amazonMarkets = ['US', 'UK', 'DE', 'FR', 'IT', 'AU'];
    const amazonPricing = {};
    let productData = null;
    
    for (const market of amazonMarkets) {
      try {
        const amazonResult = await getAmazonProductData(ean, market);
        
        if (amazonResult.success && amazonResult.product) {
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
          amazonPricing[market] = {
            buyBoxPrice: product.buybox_winner?.price?.value || 0,
            salesRank: product.bestsellers_rank?.[0]?.rank || 999999,
            salesRankCategory: product.bestsellers_rank?.[0]?.category || 'Unknown',
            fbaOffers: product.buybox_winner?.is_prime ? 1 : 0,
            priceHistory30d: {
              min: product.buybox_winner?.price?.value || 0,
              max: product.buybox_winner?.price?.value || 0,
              avg: product.buybox_winner?.price?.value || 0,
              trend: 'stable'
            }
          };
          
          console.log(`[Amazon ${market}] Found product: ${product.title?.substring(0, 50)}...`);
        }
      } catch (error) {
        console.error(`[Amazon ${market}] Error:`, error.message);
      }
    }
    
    // Step 2: Fetch eBay data for multiple markets
    const ebayMarkets = ['US', 'UK', 'DE', 'FR', 'IT', 'AU'];
    const ebayPricing = {};
    
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
    
    // Check if we have any data
    if (Object.keys(amazonPricing).length === 0 && Object.keys(ebayPricing).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found on Amazon or eBay',
        data: { ean }
      });
    }
    
    // Step 3: Run multi-channel evaluation
    const evaluation = evaluateMultiChannel(
      { ean, quantity, buyPrice, currency, supplierRegion },
      productData,
      amazonPricing,
      ebayPricing
    );
    
    // Step 4: Return results
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
          // Negotiation support for Renegotiate decisions
          negotiationSupport: evaluation.negotiationSupport || null,
          // Sourcing suggestions for Source Elsewhere decisions
          sourcingSuggestions: evaluation.sourcingSuggestions || null
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
