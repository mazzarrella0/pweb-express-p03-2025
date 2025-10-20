// File: src/infrastructures/middlewares/auth.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import prisma from '../config/prisma';
import { Role } from '@prisma/client'; // Import Role dari Prisma

// Memperluas Express Request untuk menyimpan user (sesuai dokumentasi repo)
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
      };
    }
  }
}

// Middleware untuk memverifikasi JWT dan attach user ke request
export const protect = async (req: Request, res: Response, next: NextFunction) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Ambil token dari header 'Bearer TOKEN'
            token = req.headers.authorization.split(' ')[1];

            // Verifikasi token
            const decoded = verifyToken(token);
            if (!decoded) {
                return res.status(401).json({ status: 'fail', message: 'Not authorized, token failed' });
            }
            
            // Type assertion untuk decoded token
            const decodedToken = decoded as { id: string; role: Role };

            // Cari user dan attach ke request
            const user = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: { id: true, role: true }
            });

            if (!user) {
                return res.status(401).json({ status: 'fail', message: 'User belonging to this token no longer exists' });
            }

            req.user = user;
            next();

        } catch (error) {
            // Error handling token kadaluwarsa atau salah format
            return res.status(401).json({ status: 'fail', message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ status: 'fail', message: 'Not authorized, no token' });
    }
};

// Middleware untuk Otorisasi Role (ADMIN)
export const restrictTo = (role: Role) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (req.user?.role !== role) {
            return res.status(403).json({ 
                status: 'fail', 
                message: `Forbidden: Only ${role} can perform this action` 
            });
        }
        next();
    };
};