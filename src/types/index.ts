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
  publication_year: number;
  description?: string;
  price: number;
  stock_quantity: number; 
  genre_id: string;        
}

export interface UpdateBookRequest {
  title?: string;
  writer?: string;
  publisher?: string;
  publication_year?: number;
  description?: string;
  price?: number;
  stock_quantity?: number; 
  genre_id?: string;        
}

export interface CreateGenreRequest {
  name: string;
}

export interface UpdateGenreRequest {
  name?: string;
}

export interface CreateTransactionRequest {
  user_id: string;
  items: {
    book_id: string; 
    quantity: number;
  }[];
}