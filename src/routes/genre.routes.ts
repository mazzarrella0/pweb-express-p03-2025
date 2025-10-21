import { Router } from 'express';
import {
  createGenre,
  getAllGenres,
  getGenreDetail,
  updateGenre,
  deleteGenre
} from '../controllers/genre.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/', authenticateToken, createGenre);
router.get('/', getAllGenres);
router.get('/:genre_id', getGenreDetail);
router.patch('/:genre_id', authenticateToken, updateGenre);
router.delete('/:genre_id', authenticateToken, deleteGenre);

export default router;