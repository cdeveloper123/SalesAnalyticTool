import express from 'express';
import {
  createOverride,
  getOverride,
  getAssumptions,
  createPreset,
  listPresets,
  applyPreset,
  deletePreset,
  getHistory
} from '../controllers/assumptionController.js';

const router = express.Router();

/**
 * POST /api/v1/assumptions/overrides
 * Create or update assumption overrides
 */
router.post('/overrides', createOverride);

/**
 * GET /api/v1/assumptions/overrides/:id
 * Get assumption overrides by ID, dealId, or sessionId
 */
router.get('/overrides/:id?', getOverride);

/**
 * POST /api/v1/assumptions/presets
 * Create assumption preset
 */
router.post('/presets', createPreset);

/**
 * GET /api/v1/assumptions/presets
 * List all assumption presets
 * NOTE: Must come before /:dealId route to avoid route conflict
 */
router.get('/presets', listPresets);

/**
 * POST /api/v1/assumptions/presets/:id/apply
 * Apply preset to current deal
 */
router.post('/presets/:id/apply', applyPreset);

/**
 * DELETE /api/v1/assumptions/presets/:id
 * Delete assumption preset
 */
router.delete('/presets/:id', deletePreset);

/**
 * GET /api/v1/assumptions/history/:dealId
 * Get assumption change history for a deal
 * NOTE: Must come before /:dealId route to avoid route conflict
 */
router.get('/history/:dealId', getHistory);

/**
 * GET /api/v1/assumptions/:dealId
 * Get all assumptions used in a calculation
 * NOTE: Must come AFTER /presets and /history routes to avoid route conflict
 */
router.get('/:dealId', getAssumptions);

export default router;

