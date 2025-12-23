import express from 'express';
import dealRoutes from './dealRoutes.js';

const router = express.Router();

// Mount route modules
router.use('/deals', dealRoutes);

export default router;
