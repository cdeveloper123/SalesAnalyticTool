/**
 * Product Analysis Script
 * 
 * Analyzes a product deal and saves results to JSON file
 * For Testing Purpose ONly
 * npm run analyze <EAN> <quantity> <buyPrice> <currency> <supplierRegion>
 * 
 * Usage: node src/scripts/analyzeProduct.js
 */

import { getAmazonProductData } from '../services/amazonService.js';
import ebayService from '../services/ebayService.js';
import { evaluateMultiChannel } from '../services/multiChannelEvaluator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get command-line arguments or use defaults
const args = process.argv.slice(2);

// Product parameters - can be overridden via command-line arguments
const PRODUCT_CONFIG = {
  ean: args[0] || '027242919419',
  quantity: parseInt(args[1]) || 1200,
  buyPrice: parseFloat(args[2]) || 270,
  currency: args[3] || 'USD',
  supplierRegion: args[4] || 'US'
};

async function analyzeProduct() {
  console.log('='.repeat(60));
  console.log('Product Analysis Script');
  console.log('='.repeat(60));
  console.log(`EAN: ${PRODUCT_CONFIG.ean}`);
  console.log(`Quantity: ${PRODUCT_CONFIG.quantity}`);
  console.log(`Buy Price: ${PRODUCT_CONFIG.currency} ${PRODUCT_CONFIG.buyPrice} per unit`);
  console.log(`Supplier Region: ${PRODUCT_CONFIG.supplierRegion}`);
  console.log('='.repeat(60));
  
  if (args.length === 0) {
    console.log('\n💡 Tip: You can pass arguments:');
    console.log('   npm run analyze <EAN> <quantity> <buyPrice> <currency> <supplierRegion>');
    console.log('   Example: npm run analyze 027242919419 1200 270 USD US\n');
  }
  
  console.log('Starting analysis...\n');

  const startTime = Date.now();

  try {
    const { ean, quantity, buyPrice, currency, supplierRegion } = PRODUCT_CONFIG;

    // Step 1: Fetch Amazon data for multiple markets
    console.log('[Step 1] Fetching Amazon product data...');
    const amazonMarkets = ['US', 'UK', 'DE'];
    const amazonPricing = {};
    let productData = null;

    for (const market of amazonMarkets) {
      try {
        console.log(`  → Checking Amazon ${market}...`);
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
            console.log(`  ✓ Found product: ${product.title?.substring(0, 60)}...`);
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

          console.log(`  ✓ Amazon ${market}: Price ${amazonPricing[market].buyBoxPrice}, Rank ${amazonPricing[market].salesRank}`);
        } else {
          console.log(`  ✗ Amazon ${market}: Product not found`);
        }
      } catch (error) {
        console.error(`  ✗ Amazon ${market} Error:`, error.message);
      }
    }

    // Step 2: Fetch eBay data for multiple markets
    console.log('\n[Step 2] Fetching eBay product data...');
    const ebayMarkets = ['US', 'UK', 'DE'];
    const ebayPricing = {};

    for (const market of ebayMarkets) {
      try {
        console.log(`  → Checking eBay ${market}...`);
        const ebayResult = await ebayService.getProductPricingByEAN(ean, market);

        if (ebayResult) {
          ebayPricing[market] = {
            buyBoxPrice: ebayResult.buyBoxPrice,
            activeListings: ebayResult.activeListings,
            estimatedMonthlySales: ebayResult.estimatedMonthlySales,
            confidence: ebayResult.confidence
          };

          console.log(`  ✓ eBay ${market}: Avg Price ${ebayResult.currency} ${ebayResult.buyBoxPrice}, Sales ${ebayResult.estimatedMonthlySales}/month`);
        } else {
          console.log(`  ✗ eBay ${market}: No data found`);
        }
      } catch (error) {
        console.error(`  ✗ eBay ${market} Error:`, error.message);
      }
    }

    if (Object.keys(amazonPricing).length === 0 && Object.keys(ebayPricing).length === 0) {
      throw new Error('Product not found on Amazon or eBay');
    }

    // Step 3: Run multi-channel evaluation
    console.log('\n[Step 3] Running multi-channel evaluation...');
    const evaluation = evaluateMultiChannel(
      { ean, quantity, buyPrice, currency, supplierRegion },
      productData,
      amazonPricing,
      ebayPricing
    );

    console.log(`  ✓ Deal Score: ${evaluation.dealScore.overall}%`);
    console.log(`  ✓ Decision: ${evaluation.decision}`);
    console.log(`  ✓ Best Channel: ${evaluation.bestChannel.channel}-${evaluation.bestChannel.marketplace} (${evaluation.bestChannel.marginPercent}% margin)`);

    // Step 4: Prepare results
    const results = {
      timestamp: new Date().toISOString(),
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
        ebayMarketsFound: Object.keys(ebayPricing),
        amazonPricing,
        ebayPricing
      },
      metadata: {
        analysisTimeMs: Date.now() - startTime,
        scriptVersion: '1.0.0'
      }
    };

    // Step 5: Save to JSON file
    console.log('\n[Step 4] Saving results to JSON file...');
    const outputDir = path.join(__dirname, '../../output');
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `product_analysis_${ean}_${Date.now()}.json`;
    const filepath = path.join(outputDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(results, null, 2), 'utf8');

    console.log(`  ✓ Results saved to: ${filepath}`);
    console.log(`  ✓ File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Analysis Complete!');
    console.log('='.repeat(60));
    console.log(`Total time: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    console.log(`Deal Score: ${results.evaluation.dealScore}%`);
    console.log(`Decision: ${results.evaluation.decision}`);
    console.log(`Best Channel: ${results.evaluation.bestChannel.channel}-${results.evaluation.bestChannel.marketplace}`);
    console.log(`Best Margin: ${results.evaluation.bestChannel.marginPercent}%`);
    console.log(`Channels Analyzed: ${results.evaluation.channelAnalysis.length}`);
    console.log(`Output File: ${filepath}`);
    console.log('='.repeat(60));

    return results;

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('ERROR: Analysis failed');
    console.error('='.repeat(60));
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the analysis
analyzeProduct()
  .then(() => {
    console.log('\nScript completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed:', error);
    process.exit(1);
  });

