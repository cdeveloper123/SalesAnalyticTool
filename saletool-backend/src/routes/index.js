import express from 'express';
import productRoutes from './productRoutes.js';
import dealRoutes from './dealRoutes.js';

const router = express.Router();

// Mount route modules
router.use('/products', productRoutes);
router.use('/deals', dealRoutes);

export default router;

