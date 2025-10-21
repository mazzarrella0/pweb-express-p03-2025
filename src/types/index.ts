import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username?: string;
  email: string;
  password: string;
}

export interface CreateBookRequest {
  title: string;
  writer: string;
  publisher: string;
  publicationYear: number;
  description?: string;
  price: number;
  stockQuantity: number;
  genreId: string;
}

export interface UpdateBookRequest {
  title?: string;
  writer?: string;
  publisher?: string;
  publicationYear?: number;
  description?: string;
  price?: number;
  stockQuantity?: number;
  genreId?: string;
}

export interface CreateGenreRequest {
  name: string;
}

export interface UpdateGenreRequest {
  name?: string;
}

export interface CreateTransactionRequest {
  items: {
    bookId: string;
    quantity: number;
  }[];
}