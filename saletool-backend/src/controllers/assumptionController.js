/**
 * Assumption Controller
 * 
 * Handles CRUD operations for assumption overrides and presets
 */

import { getPrisma } from '../config/database.js';
import assumptionVisibilityService from '../services/assumptionVisibilityService.js';

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
    if (existingOverride) {
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
    } else {
      // Create new override
      override = await prisma.assumptionOverride.create({
        data: {
          dealId: dealId || null,
          sessionId: sessionId || null,
          shippingOverrides: shippingOverrides || null,
          dutyOverrides: dutyOverrides || null,
          feeOverrides: feeOverrides || null
        }
      });
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

    if (!override) {
      return res.status(404).json({
        success: false,
        message: 'Override not found'
      });
    }

    res.status(200).json({
      success: true,
      data: override
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

    // Format assumptions from deal data
    const assumptions = deal.assumptions 
      ? assumptionVisibilityService.formatAssumptionsForDisplay(deal.assumptions)
      : {
          version: assumptionVisibilityService.getAssumptionVersion(),
          timestamp: deal.analyzedAt.toISOString(),
          summary: {
            shippingRoutes: 0,
            dutyRoutes: 0,
            feeMarketplaces: 0,
            hasOverrides: !!override
          },
          details: {
            shipping: {},
            duty: {},
            fees: {},
            currency: {}
          },
          overrides: override ? {
            shippingOverrides: override.shippingOverrides,
            dutyOverrides: override.dutyOverrides,
            feeOverrides: override.feeOverrides
          } : {}
        };

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

    let override;
    if (existingOverride) {
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

export default {
  createOverride,
  getOverride,
  getAssumptions,
  createPreset,
  listPresets,
  applyPreset,
  deletePreset
};

