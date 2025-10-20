// File: src/server.ts
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import router from './delivery/routes';

// Konfigurasi Environment
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Global Middleware
app.use(express.json()); 

// Root Endpoint
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    message: 'IT Literature Shop API is Running',
    version: '1.0.0'
  });
});

// Main API Router
app.use('/api/v1', router);

// Global Error Handler (Sangat penting untuk praktikum)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Handle Error Duplikasi Prisma (misal email/title unique)
    if (err.code === 'P2002') {
        statusCode = 409;
        const target = err.meta?.target.join(', ');
        message = `Conflict: Data already exists for fields: ${target}`;
    }
    
    // Handle Error Zod Validation (harus disesuaikan dengan Zod)
    if (err.name === 'ZodError') {
        statusCode = 400;
        message = 'Validation Failed';
        // Tambahkan detail error Zod
    }
    
    res.status(statusCode).json({
        status: 'fail',
        message: message,
        // Tambahkan detail error jika dibutuhkan
    });
});


// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});