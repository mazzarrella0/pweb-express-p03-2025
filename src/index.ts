import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import bookRoutes from './routes/book.routes';
import genreRoutes from './routes/genre.routes';
import transactionRoutes from './routes/transaction.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to IT Literature Shop API'
  });
});

// Health check endpoint
app.get('/health-check', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/auth', authRoutes);
app.use('/books', bookRoutes);
app.use('/genre', genreRoutes);
app.use('/transactions', transactionRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});