import { Request, Response } from 'express';
import prisma from '../config/database';
import { CreateBookRequest, UpdateBookRequest } from '../types';

export const createBook = async (req: Request, res: Response) => {
  try {
    const {
      title,
      writer,
      publisher,
      publication_year,
      description,
      price,
      stock_quantity,
      genre_id
    }: CreateBookRequest = req.body;

    if (!title || !writer || !publisher || !publication_year || !price || stock_quantity === undefined || !genre_id) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    const existingBook = await prisma.book.findUnique({
      where: { title }
    });

    if (existingBook && !existingBook.deleted_at) {
      return res.status(400).json({
        success: false,
        message: 'Book with this title already exists'
      });
    }

    const genre = await prisma.genre.findUnique({
      where: { id: genre_id }
    });

    if (!genre || genre.deleted_at) {
      return res.status(404).json({
        success: false,
        message: 'Genre not found'
      });
    }

    const book = await prisma.book.create({
      data: {
        title,
        writer,
        publisher,
        publication_year,
        description,
        price,
        stock_quantity,
        genre_id
      },
      include: {
        genre: true
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Book created successfully',
      data: book
    });
  } catch (error) {
    console.error('CreateBook error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getAllBooks = async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '10',
      search,
      writer,
      publisher,
      minPrice,
      maxPrice
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      deleted_at: null
    };

    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { writer: { contains: search as string, mode: 'insensitive' } },
        { publisher: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (writer) {
      where.writer = { contains: writer as string, mode: 'insensitive' };
    }

    if (publisher) {
      where.publisher = { contains: publisher as string, mode: 'insensitive' };
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice as string);
      if (maxPrice) where.price.lte = parseFloat(maxPrice as string);
    }

    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where,
        include: {
          genre: true
        },
        skip,
        take: limitNum,
        orderBy: {
          created_at: 'desc'
        }
      }),
      prisma.book.count({ where })
    ]);

    return res.status(200).json({
      success: true,
      data: books,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('GetAllBooks error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getBookDetail = async (req: Request, res: Response) => {
  try {
    const { book_id } = req.params;

    const book = await prisma.book.findFirst({
      where: {
        id: book_id,
        deleted_at: null
      },
      include: {
        genre: true
      }
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: book
    });
  } catch (error) {
    console.error('GetBookDetail error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getBooksByGenre = async (req: Request, res: Response) => {
  try {
    const { genre_id } = req.params;
    const {
      page = '1',
      limit = '10',
      search,
      writer,
      publisher,
      minPrice,
      maxPrice
    } = req.query;

    const genre = await prisma.genre.findFirst({
      where: {
        id: genre_id,
        deleted_at: null
      }
    });

    if (!genre) {
      return res.status(404).json({
        success: false,
        message: 'Genre not found'
      });
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      genre_id: genre_id,
      deleted_at: null
    };

    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { writer: { contains: search as string, mode: 'insensitive' } },
        { publisher: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (writer) {
      where.writer = { contains: writer as string, mode: 'insensitive' };
    }

    if (publisher) {
      where.publisher = { contains: publisher as string, mode: 'insensitive' };
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice as string);
      if (maxPrice) where.price.lte = parseFloat(maxPrice as string);
    }

    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where,
        include: {
          genre: true
        },
        skip,
        take: limitNum,
        orderBy: {
          created_at: 'desc'
        }
      }),
      prisma.book.count({ where })
    ]);

    return res.status(200).json({
      success: true,
      data: books,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('GetBooksByGenre error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const updateBook = async (req: Request, res: Response) => {
  try {
    const { book_id } = req.params;
    const updateData: UpdateBookRequest = req.body;

    const book = await prisma.book.findFirst({
      where: {
        id: book_id,
        deleted_at: null
      }
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    if (updateData.title && updateData.title !== book.title) {
      const existingBook = await prisma.book.findUnique({
        where: { title: updateData.title }
      });

      if (existingBook && !existingBook.deleted_at) {
        return res.status(400).json({
          success: false,
          message: 'Book with this title already exists'
        });
      }
    }

    if (updateData.genre_id) {
      const genre = await prisma.genre.findFirst({
        where: {
          id: updateData.genre_id,
          deleted_at: null
        }
      });

      if (!genre) {
        return res.status(404).json({
          success: false,
          message: 'Genre not found'
        });
      }
    }

    const updatedBook = await prisma.book.update({
      where: { id: book_id },
      data: updateData,
      include: {
        genre: true
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Book updated successfully',
      data: updatedBook
    });
  } catch (error) {
    console.error('UpdateBook error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const deleteBook = async (req: Request, res: Response) => {
  try {
    const { book_id } = req.params;

    const book = await prisma.book.findFirst({
      where: {
        id: book_id,
        deleted_at: null
      }
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    await prisma.book.update({
      where: { id: book_id },
      data: {
        deleted_at: new Date()
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Book deleted successfully'
    });
  } catch (error) {
    console.error('DeleteBook error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};