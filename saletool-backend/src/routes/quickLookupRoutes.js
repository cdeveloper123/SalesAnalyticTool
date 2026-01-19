import express from 'express';
import { analyzeQuickLookup, getQuickLookupProducts, deleteQuickLookupProduct } from '../controllers/quickLookupController.js';

const router = express.Router();

// GET /api/v1/quicklookup - Get all quick lookup products
router.get('/', getQuickLookupProducts);

// POST /api/v1/quicklookup/analyze - Quick lookup by EAN
router.post('/analyze', analyzeQuickLookup);

// DELETE /api/v1/quicklookup/:id - Delete quick lookup product
router.delete('/:id', deleteQuickLookupProduct);

export default router;
