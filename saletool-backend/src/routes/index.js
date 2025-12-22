import express from 'express';
import productRoutes from './productRoutes.js';

const router = express.Router();

// Mount route modules
router.use('/products', productRoutes);

export default router;

