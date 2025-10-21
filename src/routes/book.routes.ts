import { Router } from 'express';
import {
  createBook,
  getAllBooks,
  getBookDetail,
  getBooksByGenre,
  updateBook,
  deleteBook
} from '../controllers/book.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/', authenticateToken, createBook);
router.get('/', getAllBooks);
router.get('/genre/:genre_id', getBooksByGenre);
router.get('/:book_id', getBookDetail);
router.patch('/:book_id', authenticateToken, updateBook);
router.delete('/:book_id', authenticateToken, deleteBook);

export default router;