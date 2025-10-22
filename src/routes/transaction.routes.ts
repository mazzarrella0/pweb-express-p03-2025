import { Router } from 'express';
import {
  createTransaction,
  getAllTransactions,
  getTransactionDetail,
  getTransactionStatistics
} from '../controllers/transaction.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// IMPORTANT: Specific routes MUST come before dynamic params
// /statistics must be before /:transaction_id to avoid conflicts

router.get('/statistics', authenticateToken, getTransactionStatistics);
router.post('/', authenticateToken, createTransaction);
router.get('/', authenticateToken, getAllTransactions);
router.get('/:transaction_id', authenticateToken, getTransactionDetail);

export default router;