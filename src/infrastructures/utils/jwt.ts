// File: src/infrastructures/utils/jwt.ts
import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';
const JWT_EXPIRES_IN = '1d';

export const generateToken = (user: { id: string, role: string }) => {
    return jwt.sign(user, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
    });
};

export const verifyToken = (token: string) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            // Handle specific JWT errors
            throw new Error('Invalid token');
        } else if (error instanceof jwt.TokenExpiredError) {
            throw new Error('Token expired');
        } else {
            throw new Error('Token verification failed');
        }
    }
};