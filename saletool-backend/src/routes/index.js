import express from 'express';
import dealRoutes from './dealRoutes.js';
import assumptionRoutes from './assumptionRoutes.js';
import dataSourceRoutes from './dataSourceRoutes.js';

const router = express.Router();

// Mount route modules
router.use('/deals', dealRoutes);
router.use('/assumptions', assumptionRoutes);
router.use('/data-source', dataSourceRoutes);

export default router;
