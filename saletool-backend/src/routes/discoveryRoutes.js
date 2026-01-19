import express from 'express';
import { analyzeDiscovery, getDiscoveryProducts, deleteDiscoveryProduct } from '../controllers/discoveryController.js';

const router = express.Router();

// GET /api/v1/discovery - Get all discovery products
router.get('/', getDiscoveryProducts);

// POST /api/v1/discovery/analyze - Analyze product for discovery
router.post('/analyze', analyzeDiscovery);

// DELETE /api/v1/discovery/:id - Delete discovery product
router.delete('/:id', deleteDiscoveryProduct);

export default router;
