// File: src/delivery/routes/index.ts
import { Router } from 'express';
import authRouter from './auth.route';
import bookRouter from './book.route';
import genreRouter from './genre.route';
import transactionRouter from './transaction.route';

const router = Router();

// Endpoint utama Anda
router.use('/auth', authRouter);
router.use('/books', bookRouter);
router.use('/genres', genreRouter);
router.use('/transactions', transactionRouter);

export default router;