import express from 'express';
import { analyzeDeal } from '../controllers/dealController.js';

const router = express.Router();

/**
 * POST /api/v1/deals/analyze
 * 
 * Analyze a product deal across multiple channels
 */
router.post('/analyze', analyzeDeal);

export default router;
