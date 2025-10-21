import { Router } from 'express';
import {
  createTransaction,
  getAllTransactions,
  getTransactionDetail,
  getTransactionStatistics
} from '../controllers/transaction.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/', authenticateToken, createTransaction);
router.get('/', authenticateToken, getAllTransactions);
router.get('/statistics', authenticateToken, getTransactionStatistics);
router.get('/:transaction_id', authenticateToken, getTransactionDetail);

export default router;