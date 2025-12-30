import express from 'express';
import { analyzeDeal, getDeals, deleteDeal } from '../controllers/dealController.js';

const router = express.Router();

router.get('/', getDeals);

router.post('/analyze', analyzeDeal);

router.delete('/:id', deleteDeal);

export default router;
