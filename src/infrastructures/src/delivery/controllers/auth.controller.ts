// File: src/delivery/controllers/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as authService from '../../services/auth.service';
// import { registerSchema, loginSchema } from '../../infrastructures/utils/validation'; // (Zod validation harus dibuat)
import { Role } from '@prisma/client';

// Utility Function untuk menanganai async/await (di repo aslinya dibuat di file lain)
const catchAsync = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

export const register = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // const validatedData = registerSchema.parse(req.body); // Uncomment jika Zod sudah dibuat
    
    // Service akan menangani pembuatan token dan mengirim respons.
    await authService.register(req.body, res); 
});

export const login = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // const validatedData = loginSchema.parse(req.body); // Uncomment jika Zod sudah dibuat
    
    // Service akan menangani login dan mengirim respons.
    await authService.login(req.body, res); 
});

export const getMe = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // Dapatkan data user dari req.user (sudah di-attach oleh middleware protect)
    if (!req.user) {
        return res.status(401).json({ status: 'fail', message: 'Not logged in' });
    }

    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, name: true, role: true }
    });

    res.status(200).json({
        status: 'success',
        data: user,
    });
});
