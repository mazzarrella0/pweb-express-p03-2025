// File: src/services/auth.service.ts
import prisma from '../infrastructures/config/prisma';
import bcrypt from 'bcryptjs';
import { generateToken } from '../infrastructures/utils/jwt';
import { Role } from '@prisma/client';

interface AuthData {
    email: string;
    password: string;
    name?: string; 
}

// Helper untuk membuat respon token
const createSendToken = (user: { id: string, role: Role }, res: any) => {
    const token = generateToken(user);
    
    // Kirim response
    res.status(200).json({
        status: 'success',
        token,
        data: {
            user: {
                id: user.id,
                role: user.role
            }
        }
    });
};

export const register = async (data: AuthData, res: any) => {
    // Cek duplikasi email
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
        throw new Error('Email already registered');
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Buat User
    const user = await prisma.user.create({
        data: {
            email: data.email,
            password: hashedPassword,
            name: data.name || 'User',
            role: Role.CUSTOMER,
        },
    });

    createSendToken({ id: user.id, role: user.role }, res);
};

export const login = async (data: AuthData, res: any) => {
    const user = await prisma.user.findUnique({ where: { email: data.email } });

    if (!user || !(await bcrypt.compare(data.password, user.password))) {
        throw new Error('Invalid email or password');
    }

    createSendToken({ id: user.id, role: user.role }, res);
};