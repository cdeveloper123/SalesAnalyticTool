/**
 * Assumption Controller
 * 
 * Handles CRUD operations for assumption overrides and presets
 */

import { getPrisma } from '../config/database.js';
import assumptionVisibilityService, {
  trackAssumptionChange,
  hasOverrideChanged,
  getAssumptionHistory
} from '../services/assumptionVisibilityService.js';
import { getAmazonProductData } from '../services/amazonService.js';
import ebayService from '../services/ebayService.js';
import { evaluateMultiChannel } from '../services/multiChannelEvaluator.js';
import currencyService from '../services/currencyService.js';

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
 * Create or update assumption overrides
 * POST /api/v1/assumptions/overrides
 */
export const createOverride = async (req, res) => {
  try {
    const { dealId, sessionId, shippingOverrides, dutyOverrides, feeOverrides } = req.body;

    const prisma = getPrisma();

    // Check if override already exists for this deal/session
    let existingOverride = null;
    if (dealId) {
      existingOverride = await prisma.assumptionOverride.findFirst({
        where: { dealId }
      });
    } else if (sessionId) {
      existingOverride = await prisma.assumptionOverride.findFirst({
        where: { sessionId }
      });
    }

    let override;
    const historyEntries = [];
    const effectiveDealId = dealId || existingOverride?.dealId || null;

    if (existingOverride) {
      // Track changes before updating
      if (shippingOverrides && hasOverrideChanged(existingOverride.shippingOverrides, shippingOverrides)) {
        historyEntries.push(
          trackAssumptionChange(effectiveDealId, 'shipping', existingOverride.shippingOverrides, shippingOverrides)
        );
      }
      if (dutyOverrides && hasOverrideChanged(existingOverride.dutyOverrides, dutyOverrides)) {
        historyEntries.push(
          trackAssumptionChange(effectiveDealId, 'duty', existingOverride.dutyOverrides, dutyOverrides)
        );
      }
      if (feeOverrides && hasOverrideChanged(existingOverride.feeOverrides, feeOverrides)) {
        historyEntries.push(
          trackAssumptionChange(effectiveDealId, 'fee', existingOverride.feeOverrides, feeOverrides)
        );
      }

      // Update existing override
      override = await prisma.assumptionOverride.update({
        where: { id: existingOverride.id },
        data: {
          shippingOverrides: shippingOverrides || existingOverride.shippingOverrides,
          dutyOverrides: dutyOverrides || existingOverride.dutyOverrides,
          feeOverrides: feeOverrides || existingOverride.feeOverrides,
          updatedAt: new Date()
        }
      });

      // Wait for all history tracking to complete
      await Promise.all(historyEntries);
    } else {
      // Create new override - don't track history for initial creation
      // History should only track changes AFTER the initial creation
      override = await prisma.assumptionOverride.create({
        data: {
          dealId: dealId || null,
          sessionId: sessionId || null,
          shippingOverrides: shippingOverrides || null,
          dutyOverrides: dutyOverrides || null,
          feeOverrides: feeOverrides || null
        }
      });

      // Don't create history for initial override creation
      // History will be created when the override is modified later
    }

    // If dealId exists and overrides were updated, recalculate the deal
    if (dealId && (existingOverride || override)) {
      try {
        await recalculateDealWithNewOverrides(dealId, {
          shippingOverrides: shippingOverrides || override.shippingOverrides,
          dutyOverrides: dutyOverrides || override.dutyOverrides,
          feeOverrides: feeOverrides || override.feeOverrides
        });
      } catch (recalcError) {
        console.error('[Assumption Controller] Error recalculating deal:', recalcError);
        // Don't fail the request if recalculation fails
      }
    }

    res.status(200).json({
      success: true,
      message: existingOverride ? 'Override updated successfully' : 'Override created successfully',
      data: override
    });
  } catch (error) {
    console.error('[Assumption Controller] Error creating override:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating override',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get assumption overrides
 * GET /api/v1/assumptions/overrides/:id
 */
export const getOverride = async (req, res) => {
  try {
    const { id } = req.params;
    const { dealId, sessionId } = req.query;

    const prisma = getPrisma();
    let override;

    if (id) {
      override = await prisma.assumptionOverride.findUnique({
        where: { id }
      });
    } else if (dealId) {
      override = await prisma.assumptionOverride.findFirst({
        where: { dealId }
      });
    } else if (sessionId) {
      override = await prisma.assumptionOverride.findFirst({
        where: { sessionId }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Must provide id, dealId, or sessionId'
      });
    }

    // Return 200 with null data if no override exists (not an error - just no overrides set yet)
    res.status(200).json({
      success: true,
      data: override || null,
      message: override ? undefined : 'No overrides found'
    });
  } catch (error) {
    console.error('[Assumption Controller] Error getting override:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting override',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all assumptions used in a calculation
 * GET /api/v1/assumptions/:dealId
 */
export const getAssumptions = async (req, res) => {
  try {
    const { dealId } = req.params;

    if (!dealId) {
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

    // Get deal from database
    const deal = await prisma.deal.findUnique({
      where: { id: dealId }
    });

    if (!deal) {
      return res.status(404).json({
        success: false,
        message: 'Deal not found'
      });
    }

    // Get assumption overrides for this deal if they exist
    const override = await prisma.assumptionOverride.findFirst({
      where: { dealId }
    });

    // Get assumption history for this deal
    const history = await prisma.assumptionHistory.findMany({
      where: { dealId },
      orderBy: { createdAt: 'desc' }
    });

    // Get currency cache status for metadata (only for updating currency info if needed)
    const currencyCacheStatus = currencyService.getCacheStatus();

    // Get assumptions from deal - should be fully formatted with all metadata
    let assumptions;
    if (deal.assumptions) {
      // Check if assumptions are fully formatted (have 'details' key and metadata)
      if (deal.assumptions.details && deal.assumptions.dataFreshness && deal.assumptions.sourceConfidence && deal.assumptions.methodology) {
        // Fully formatted assumptions - just return them (no recalculation needed)
        assumptions = { ...deal.assumptions };

        // Only update currency cache status if it exists (dynamic metadata that changes over time)
        if (assumptions.dataFreshness?.currency && currencyCacheStatus) {
          assumptions.dataFreshness.currency = {
            ...assumptions.dataFreshness.currency,
            isExpired: currencyCacheStatus.isExpired,
            cacheAge: currencyCacheStatus.cacheAge
          };

          // Update currency methodology if cache status changed
          if (assumptions.methodology?.currency) {
            const isUsingFallback = !currencyCacheStatus.hasCache ||
              (currencyCacheStatus.isExpired && !currencyCacheStatus.lastUpdated);
            const isExpiredButHasCache = currencyCacheStatus.hasCache && currencyCacheStatus.isExpired;

            let calculationMessage;
            if (isUsingFallback) {
              calculationMessage = `Fallback exchange rates used (hardcoded values). Base currency: USD. Rates converted using: ${deal.currency} to USD, then to target marketplace currency.`;
            } else if (isExpiredButHasCache) {
              calculationMessage = `Exchange rates from freecurrencyapi.com (cache expired, refreshing in background). Base currency: USD. Rates converted using: ${deal.currency} to USD, then to target marketplace currency.`;
            } else {
              calculationMessage = `Exchange rates fetched from freecurrencyapi.com. Base currency: USD. Rates converted using: ${deal.currency} to USD, then to target marketplace currency.`;
            }

            assumptions.methodology.currency = {
              ...assumptions.methodology.currency,
              calculation: calculationMessage,
              cacheStatus: currencyCacheStatus
            };
          }
        }
      } else if (deal.assumptions.details) {
        // Formatted but missing metadata - this shouldn't happen for new deals, but handle legacy data
        // Just use what we have, don't re-extract
        assumptions = { ...deal.assumptions };
        // Ensure metadata objects exist even if empty
        if (!assumptions.dataFreshness) assumptions.dataFreshness = {};
        if (!assumptions.sourceConfidence) assumptions.sourceConfidence = {};
        if (!assumptions.methodology) assumptions.methodology = {};
      } else if (deal.assumptions.shipping || deal.assumptions.duty || deal.assumptions.fees) {
        // Legacy raw format - only re-extract for old deals that weren't stored with full metadata
        // This is a fallback for backward compatibility
        const evaluationData = deal.evaluationData || {};
        const marketData = deal.marketData || {};
        const metadata = {
          analyzedAt: deal.analyzedAt,
          currencyCacheStatus: currencyCacheStatus,
          marketData: marketData
        };

        const enhancedAssumptions = assumptionVisibilityService.getAllAssumptionsUsed(
          evaluationData,
          override ? {
            shippingOverrides: override.shippingOverrides,
            dutyOverrides: override.dutyOverrides,
            feeOverrides: override.feeOverrides
          } : null,
          {
            ean: deal.ean,
            quantity: deal.quantity,
            buyPrice: deal.buyPrice,
            currency: deal.currency,
            supplierRegion: deal.supplierRegion
          },
          metadata
        );

        assumptions = assumptionVisibilityService.formatAssumptionsForDisplay(enhancedAssumptions);
        assumptions.dataFreshness = enhancedAssumptions.dataFreshness || {};
        assumptions.sourceConfidence = enhancedAssumptions.sourceConfidence || {};
        assumptions.methodology = enhancedAssumptions.methodology || {};
      } else {
        // Empty or invalid - return empty structure
        assumptions = {
          details: {},
          dataFreshness: {},
          sourceConfidence: {},
          methodology: {}
        };
      }
    } else {
      // No assumptions stored - return empty structure
      assumptions = {
        details: {},
        dataFreshness: {},
        sourceConfidence: {},
        methodology: {}
      };
    }

    // Add history to response
    assumptions.history = history.map(h => ({
      id: h.id,
      assumptionType: h.assumptionType,
      oldValue: h.oldValue,
      newValue: h.newValue,
      changedBy: h.changedBy,
      timestamp: h.createdAt.toISOString()
    }));

    res.status(200).json({
      success: true,
      data: assumptions
    });
  } catch (error) {
    console.error('[Assumption Controller] Error getting assumptions:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting assumptions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create assumption preset
 * POST /api/v1/assumptions/presets
 */
export const createPreset = async (req, res) => {
  try {
    const { name, description, shippingOverrides, dutyOverrides, feeOverrides } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Preset name is required'
      });
    }

    const prisma = getPrisma();

    const preset = await prisma.assumptionPreset.create({
      data: {
        name,
        description: description || null,
        shippingOverrides: shippingOverrides || null,
        dutyOverrides: dutyOverrides || null,
        feeOverrides: feeOverrides || null
      }
    });

    res.status(201).json({
      success: true,
      message: 'Preset created successfully',
      data: preset
    });
  } catch (error) {
    console.error('[Assumption Controller] Error creating preset:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating preset',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * List all assumption presets
 * GET /api/v1/assumptions/presets
 */
export const listPresets = async (req, res) => {
  try {
    const prisma = getPrisma();

    if (!prisma || !prisma.assumptionPreset) {
      return res.status(503).json({
        success: false,
        message: 'Database not available',
        error: 'Prisma client not initialized'
      });
    }

    const presets = await prisma.assumptionPreset.findMany({
      orderBy: { createdAt: 'desc' }
    });

    console.log(`[Assumption Controller] Found ${presets.length} presets`); // Debug log

    res.status(200).json({
      success: true,
      data: presets
    });
  } catch (error) {
    console.error('[Assumption Controller] Error listing presets:', error);
    res.status(500).json({
      success: false,
      message: 'Error listing presets',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Apply a preset to current deal
 * POST /api/v1/assumptions/presets/:id/apply
 */
export const applyPreset = async (req, res) => {
  try {
    const { id } = req.params;
    const { dealId, sessionId } = req.body;

    const prisma = getPrisma();

    const preset = await prisma.assumptionPreset.findUnique({
      where: { id }
    });

    if (!preset) {
      return res.status(404).json({
        success: false,
        message: 'Preset not found'
      });
    }

    // Create or update override with preset data
    let existingOverride = null;
    if (dealId) {
      existingOverride = await prisma.assumptionOverride.findFirst({
        where: { dealId }
      });
    } else if (sessionId) {
      existingOverride = await prisma.assumptionOverride.findFirst({
        where: { sessionId }
      });
    }

    const effectiveDealId = dealId || existingOverride?.dealId || null;
    const changedByPreset = `preset:${preset.name}`;

    let override;
    if (existingOverride) {
      // Track changes from applying preset
      if (preset.shippingOverrides && hasOverrideChanged(existingOverride.shippingOverrides, preset.shippingOverrides)) {
        await trackAssumptionChange(effectiveDealId, 'shipping', existingOverride.shippingOverrides, preset.shippingOverrides, changedByPreset);
      }
      if (preset.dutyOverrides && hasOverrideChanged(existingOverride.dutyOverrides, preset.dutyOverrides)) {
        await trackAssumptionChange(effectiveDealId, 'duty', existingOverride.dutyOverrides, preset.dutyOverrides, changedByPreset);
      }
      if (preset.feeOverrides && hasOverrideChanged(existingOverride.feeOverrides, preset.feeOverrides)) {
        await trackAssumptionChange(effectiveDealId, 'fee', existingOverride.feeOverrides, preset.feeOverrides, changedByPreset);
      }

      override = await prisma.assumptionOverride.update({
        where: { id: existingOverride.id },
        data: {
          shippingOverrides: preset.shippingOverrides,
          dutyOverrides: preset.dutyOverrides,
          feeOverrides: preset.feeOverrides,
          updatedAt: new Date()
        }
      });
    } else {
      override = await prisma.assumptionOverride.create({
        data: {
          dealId: dealId || null,
          sessionId: sessionId || null,
          shippingOverrides: preset.shippingOverrides,
          dutyOverrides: preset.dutyOverrides,
          feeOverrides: preset.feeOverrides
        }
      });

      // Track initial preset application
      if (preset.shippingOverrides) {
        await trackAssumptionChange(effectiveDealId, 'shipping', null, preset.shippingOverrides, changedByPreset);
      }
      if (preset.dutyOverrides) {
        await trackAssumptionChange(effectiveDealId, 'duty', null, preset.dutyOverrides, changedByPreset);
      }
      if (preset.feeOverrides) {
        await trackAssumptionChange(effectiveDealId, 'fee', null, preset.feeOverrides, changedByPreset);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Preset applied successfully',
      data: override
    });
  } catch (error) {
    console.error('[Assumption Controller] Error applying preset:', error);
    res.status(500).json({
      success: false,
      message: 'Error applying preset',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete an assumption preset
 * DELETE /api/v1/assumptions/presets/:id
 */
export const deletePreset = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Preset ID is required'
      });
    }

    const prisma = getPrisma();
    if (!prisma || !prisma.assumptionPreset) {
      return res.status(503).json({
        success: false,
        message: 'Database not available',
        error: 'Prisma client not initialized'
      });
    }

    // Check if preset exists
    const preset = await prisma.assumptionPreset.findUnique({
      where: { id }
    });

    if (!preset) {
      return res.status(404).json({
        success: false,
        message: 'Preset not found'
      });
    }

    // Delete the preset
    await prisma.assumptionPreset.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Preset deleted successfully',
      data: { id }
    });
  } catch (error) {
    console.error('[Assumption Controller] Error deleting preset:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting preset',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Recalculate deal with new assumption overrides
 * 
 * @param {string} dealId - Deal ID
 * @param {object} assumptionOverrides - New assumption overrides
 */
async function recalculateDealWithNewOverrides(dealId, assumptionOverrides) {
  const prisma = getPrisma();
  if (!prisma || !prisma.deal) {
    throw new Error('Database not available');
  }

  // Get the deal
  const deal = await prisma.deal.findUnique({
    where: { id: dealId }
  });

  if (!deal) {
    throw new Error('Deal not found');
  }

  // Get product data and market data from deal
  const productData = deal.productData;
  const marketData = deal.marketData || {};
  const amazonPricing = {};
  const ebayPricing = {};

  // Reconstruct pricing data from evaluationData (we'll use existing sell prices)
  const evaluationData = deal.evaluationData || {};
  const channelAnalysis = evaluationData.channelAnalysis || [];

  // Extract pricing AND demand data from existing channel analysis
  // This preserves all the market data needed for accurate recalculation
  channelAnalysis.forEach(channel => {
    const marketplace = channel.marketplace || channel.market;
    if (!marketplace || !channel.sellPrice) return;

    // Get demand data from channel if available
    const demand = channel.demand || {};

    if (channel.channel === 'Amazon' || !channel.channel) {
      amazonPricing[marketplace] = {
        buyBoxPrice: channel.sellPrice,
        currency: channel.currency || 'USD',
        // Preserve demand signals for accurate recalculation
        salesRank: demand.salesRank,
        salesRankCategory: demand.salesRankCategory,
        recentSales: demand.actualSalesSource,  // "500+ bought in past month"
        ratingsTotal: demand.ratingsTotal,
        fbaOffers: demand.fbaOffers,
        dataSource: channel.pricingSource || 'recalculated'
      };
    } else if (channel.channel === 'eBay') {
      ebayPricing[marketplace] = {
        buyBoxPrice: channel.sellPrice,
        currency: channel.currency || 'USD',
        // Preserve demand signals for eBay - CRITICAL: estimatedMonthlySales is what processEbayChannelWithLandedCost uses
        estimatedMonthlySales: demand.estimatedMonthlySales?.mid || demand.soldLast90Days || 0,
        soldLast90Days: demand.soldLast90Days || 0,
        activeListings: demand.listingsCount || 0,
        confidence: demand.confidence || 'Low',
        dataSource: channel.pricingSource || 'recalculated'
      };
    }
  });

  // If no pricing found, try to get from marketData
  if (Object.keys(amazonPricing).length === 0 && marketData.amazonMarketsFound) {
    // Fallback: we'd need to fetch fresh data, but for now use existing
    console.warn(`[Recalculate] No Amazon pricing found for deal ${dealId}, using existing evaluation data`);
  }

  // Re-run evaluation with new overrides
  const evaluation = await evaluateMultiChannel(
    {
      ean: deal.ean,
      quantity: deal.quantity,
      buyPrice: deal.buyPrice,
      currency: deal.currency,
      supplierRegion: deal.supplierRegion
    },
    productData,
    amazonPricing,
    ebayPricing,
    assumptionOverrides
  );

  // Get currency cache status for metadata
  const currencyCacheStatus = currencyService.getCacheStatus();
  const metadata = {
    analyzedAt: new Date(),
    currencyCacheStatus: currencyCacheStatus,
    marketData: marketData
  };

  // Extract assumptions used in calculation
  const assumptions = assumptionVisibilityService.getAllAssumptionsUsed(
    evaluation,
    assumptionOverrides,
    {
      ean: deal.ean,
      quantity: deal.quantity,
      buyPrice: deal.buyPrice,
      currency: deal.currency,
      supplierRegion: deal.supplierRegion
    },
    metadata
  );

  // Update deal with new evaluation results
  await prisma.deal.update({
    where: { id: dealId },
    data: {
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
      evaluationData: {
        dealScore: evaluation.dealScore.overall,
        // Match the structure from dealController.js (initial analysis)
        scoreBreakdown: {
          breakdown: evaluation.dealScore.breakdown,
          weighted: evaluation.dealScore.weighted,
          weights: evaluation.dealScore.weights
        },
        decision: evaluation.decision,
        explanation: evaluation.explanation,
        bestChannel: evaluation.bestChannel,
        channelAnalysis: evaluation.channelAnalysis,
        allocation: evaluation.allocationRecommendation,
        negotiationSupport: evaluation.negotiationSupport || null,
        sourcingSuggestions: evaluation.sourcingSuggestions || null,
        compliance: evaluation.compliance || null
      },
      assumptions: assumptions, // Store raw assumptions
      analyzedAt: new Date() // Update analysis timestamp
    }
  });

  console.log(`[Assumption Controller] Deal ${dealId} recalculated with new overrides`);
}

/**
 * Get assumption change history for a deal
 * GET /api/v1/assumptions/history/:dealId
 */
export const getHistory = async (req, res) => {
  try {
    const { dealId } = req.params;
    const { limit } = req.query;

    if (!dealId) {
      return res.status(400).json({
        success: false,
        message: 'Deal ID is required'
      });
    }

    const historyLimit = limit ? parseInt(limit, 10) : 50;
    const history = await getAssumptionHistory(dealId, historyLimit);

    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('[Assumption Controller] Error getting history:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Suggest HS code based on category and product name
 * POST /api/v1/assumptions/suggest-hs-code
 */
export const suggestHsCode = async (req, res) => {
  try {
    const { category, productName } = req.body;

    if (!category && !productName) {
      return res.status(400).json({
        success: false,
        message: 'Category or product name is required'
      });
    }

    // Import HS code service
    const { lookupHSCode, getHSCodeInfo, validateHSCode } = await import('../services/hsCodeService.js');

    // Look up HS code
    const result = lookupHSCode(category, productName);

    // Get additional info about the HS code
    const hsInfo = result.hsCode ? getHSCodeInfo(result.hsCode) : null;

    res.status(200).json({
      success: true,
      data: {
        hsCode: result.hsCode,
        source: result.source,
        confidence: result.confidence,
        chapter: hsInfo?.chapter || null,
        chapterDescription: hsInfo?.chapterDescription || null,
        formattedCode: hsInfo?.fullCode || result.hsCode
      }
    });
  } catch (error) {
    console.error('[Assumption Controller] Error suggesting HS code:', error);
    res.status(500).json({
      success: false,
      message: 'Error suggesting HS code',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export default {
  createOverride,
  getOverride,
  getAssumptions,
  createPreset,
  listPresets,
  applyPreset,
  deletePreset,
  getHistory,
  suggestHsCode
};

