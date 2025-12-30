import express from 'express';
import { getDataSourceMode, setDataSourceMode } from '../controllers/dataSourceController.js';

const router = express.Router();

router.get('/', getDataSourceMode);
router.post('/', setDataSourceMode);

export default router;

