import express from 'express';
import { lookupProduct, suggestHsCodeForEan } from '../controllers/productController.js';

const router = express.Router();

/**
 * GET /api/v1/products/lookup/:ean
 * Lookup product info by EAN (fetches from Amazon/eBay to get category and name)
 */
router.get('/lookup/:ean', lookupProduct);

/**
 * GET /api/v1/products/suggest-hs/:ean
 * Suggest HS code for a product by EAN (combines product lookup + HS inference)
 */
router.get('/suggest-hs/:ean', suggestHsCodeForEan);

export default router;
