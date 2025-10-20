// File: src/infrastructures/config/prisma.ts
import { PrismaClient } from "@prisma/client";

// Export instance tunggal dari Prisma Client
const prisma = new PrismaClient();

export default prisma;