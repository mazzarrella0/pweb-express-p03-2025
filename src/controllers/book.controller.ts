import { Request, Response } from 'express';
import prisma from '../config/database';
import { CreateBookRequest, UpdateBookRequest } from '../types';

const calculateCondition = (publication_year: number): string => {
  const yearDiff = new Date().getFullYear() - publication_year;
  if (yearDiff <= 1) return 'NEW';
  else if (yearDiff <= 2) return 'LIKE_NEW';
  else if (yearDiff <= 3) return 'VERY_GOOD';
  else if (yearDiff <= 5) return 'GOOD';
  else if (yearDiff <= 8) return 'ACCEPTABLE';
  else return 'POOR';
};

const validatePublicationYear = (year: number): { valid: boolean; message?: string } => {
  const currentYear = new Date().getFullYear();
  
  if (!Number.isInteger(year)) {
    return { valid: false, message: 'Publication year must be an integer' };
  }
  
  if (year < 1000) {
    return { valid: false, message: 'Publication year must be at least 1000' };
  }
  
  if (year > currentYear) {
    return { valid: false, message: `Publication year cannot be greater than ${currentYear}` };
  }
  
  return { valid: true };
};

const validatePrice = (price: number): { valid: boolean; message?: string } => {
  if (typeof price !== 'number' || isNaN(price)) {
    return { valid: false, message: 'Price must be a valid number' };
  }
  
  if (price < 0) {
    return { valid: false, message: 'Price cannot be negative' };
  }
  
  if (price === 0) {
    return { valid: false, message: 'Price must be greater than 0' };
  }
  
  if (price > 999999999) {
    return { valid: false, message: 'Price is too high' };
  }
  
  return { valid: true };
};

const validateStockQuantity = (quantity: number): { valid: boolean; message?: string } => {
  if (typeof quantity !== 'number' || isNaN(quantity)) {
    return { valid: false, message: 'Stock quantity must be a valid number' };
  }
  
  if (!Number.isInteger(quantity)) {
    return { valid: false, message: 'Stock quantity must be an integer' };
  }
  
  if (quantity < 0) {
    return { valid: false, message: 'Stock quantity cannot be negative' };
  }
  
  if (quantity > 1000000) {
    return { valid: false, message: 'Stock quantity is too high' };
  }
  
  return { valid: true };
};

const validateString = (value: string, fieldName: string, minLength: number = 1, maxLength: number = 255): { valid: boolean; message?: string } => {
  if (typeof value !== 'string') {
    return { valid: false, message: `${fieldName} must be a string` };
  }
  
  const trimmedValue = value.trim();
  
  if (trimmedValue.length < minLength) {
    return { valid: false, message: `${fieldName} must be at least ${minLength} character(s)` };
  }
  
  if (trimmedValue.length > maxLength) {
    return { valid: false, message: `${fieldName} must not exceed ${maxLength} characters` };
  }
  
  return { valid: true };
};

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

    if (!title || !writer || !publisher || !publication_year || price === undefined || stock_quantity === undefined || !genre_id) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    const titleValidation = validateString(title, 'Title', 1, 255);
    if (!titleValidation.valid) {
      return res.status(400).json({
        success: false,
        message: titleValidation.message
      });
    }

    const writerValidation = validateString(writer, 'Writer', 1, 255);
    if (!writerValidation.valid) {
      return res.status(400).json({
        success: false,
        message: writerValidation.message
      });
    }

    const publisherValidation = validateString(publisher, 'Publisher', 1, 255);
    if (!publisherValidation.valid) {
      return res.status(400).json({
        success: false,
        message: publisherValidation.message
      });
    }

    if (description !== undefined && description !== null) {
      const descValidation = validateString(description, 'Description', 0, 2000);
      if (!descValidation.valid) {
        return res.status(400).json({
          success: false,
          message: descValidation.message
        });
      }
    }

    const yearValidation = validatePublicationYear(publication_year);
    if (!yearValidation.valid) {
      return res.status(400).json({
        success: false,
        message: yearValidation.message
      });
    }

    const priceValidation = validatePrice(price);
    if (!priceValidation.valid) {
      return res.status(400).json({
        success: false,
        message: priceValidation.message
      });
    }

    const stockValidation = validateStockQuantity(stock_quantity);
    if (!stockValidation.valid) {
      return res.status(400).json({
        success: false,
        message: stockValidation.message
      });
    }

    if (typeof genre_id !== 'string' || genre_id.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid genre_id format'
      });
    }

    const existingBook = await prisma.book.findUnique({
      where: { title: title.trim() }
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
        title: title.trim(),
        writer: writer.trim(),
        publisher: publisher.trim(),
        publication_year,
        description: description?.trim() || null,
        price,
        stock_quantity,
        genre_id
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Book added successfully',
      data: {
        id: book.id,
        title: book.title,
        created_at: book.created_at
      }
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
      maxPrice,
      orderByTitle,
      orderByPublishDate
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page must be a positive integer'
      });
    }

    if (isNaN(limitNum) || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be a positive integer'
      });
    }

    if (limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Limit cannot exceed 100'
      });
    }

    if (minPrice) {
      const min = parseFloat(minPrice as string);
      if (isNaN(min) || min < 0) {
        return res.status(400).json({
          success: false,
          message: 'minPrice must be a non-negative number'
        });
      }
    }

    if (maxPrice) {
      const max = parseFloat(maxPrice as string);
      if (isNaN(max) || max < 0) {
        return res.status(400).json({
          success: false,
          message: 'maxPrice must be a non-negative number'
        });
      }
    }

    if (minPrice && maxPrice) {
      const min = parseFloat(minPrice as string);
      const max = parseFloat(maxPrice as string);
      if (min > max) {
        return res.status(400).json({
          success: false,
          message: 'minPrice cannot be greater than maxPrice'
        });
      }
    }

    if (orderByTitle && !['asc', 'desc'].includes(orderByTitle as string)) {
      return res.status(400).json({
        success: false,
        message: 'orderByTitle must be either "asc" or "desc"'
      });
    }

    if (orderByPublishDate && !['asc', 'desc'].includes(orderByPublishDate as string)) {
      return res.status(400).json({
        success: false,
        message: 'orderByPublishDate must be either "asc" or "desc"'
      });
    }

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

    const orderBy: any = [];
    
    if (orderByTitle) {
      orderBy.push({ title: orderByTitle as string });
    }
    
    if (orderByPublishDate) {
      orderBy.push({ publication_year: orderByPublishDate as string });
    }
    
    if (orderBy.length === 0) {
      orderBy.push({ created_at: 'desc' });
    }

    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where,
        include: {
          genre: true
        },
        skip,
        take: limitNum,
        orderBy
      }),
      prisma.book.count({ where })
    ]);

    const formattedBooks = books.map(book => ({
      id: book.id,
      title: book.title,
      writer: book.writer,
      publisher: book.publisher,
      description: book.description,
      publication_year: book.publication_year,
      price: book.price,
      stock_quantity: book.stock_quantity,
      genre: book.genre.name,
      condition: calculateCondition(book.publication_year)
    }));

    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      success: true,
      message: 'Get all book successfully',
      data: formattedBooks,
      meta: {
        page: pageNum,
        limit: limitNum,
        total: total,
        total_pages: totalPages,
        prev_page: pageNum > 1 ? pageNum - 1 : null,
        next_page: pageNum < totalPages ? pageNum + 1 : null
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

    if (!book_id || typeof book_id !== 'string' || book_id.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid book_id'
      });
    }

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
      message: 'Get book detail successfully',
      data: {
        id: book.id,
        title: book.title,
        writer: book.writer,
        publisher: book.publisher,
        description: book.description,
        publication_year: book.publication_year,
        price: book.price,
        stock_quantity: book.stock_quantity,
        genre: book.genre.name,
        condition: calculateCondition(book.publication_year)
      }
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
      maxPrice,
      orderByTitle,
      orderByPublishDate,
      condition
    } = req.query;

    if (!genre_id || typeof genre_id !== 'string' || genre_id.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid genre_id'
      });
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page must be a positive integer'
      });
    }

    if (isNaN(limitNum) || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be a positive integer'
      });
    }

    if (limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Limit cannot exceed 100'
      });
    }

    const validConditions = ['NEW', 'LIKE_NEW', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE', 'POOR'];
    if (condition && !validConditions.includes((condition as string).toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid condition. Must be one of: ${validConditions.join(', ')}`
      });
    }

    if (minPrice) {
      const min = parseFloat(minPrice as string);
      if (isNaN(min) || min < 0) {
        return res.status(400).json({
          success: false,
          message: 'minPrice must be a non-negative number'
        });
      }
    }

    if (maxPrice) {
      const max = parseFloat(maxPrice as string);
      if (isNaN(max) || max < 0) {
        return res.status(400).json({
          success: false,
          message: 'maxPrice must be a non-negative number'
        });
      }
    }

    if (minPrice && maxPrice) {
      const min = parseFloat(minPrice as string);
      const max = parseFloat(maxPrice as string);
      if (min > max) {
        return res.status(400).json({
          success: false,
          message: 'minPrice cannot be greater than maxPrice'
        });
      }
    }

    if (orderByTitle && !['asc', 'desc'].includes(orderByTitle as string)) {
      return res.status(400).json({
        success: false,
        message: 'orderByTitle must be either "asc" or "desc"'
      });
    }

    if (orderByPublishDate && !['asc', 'desc'].includes(orderByPublishDate as string)) {
      return res.status(400).json({
        success: false,
        message: 'orderByPublishDate must be either "asc" or "desc"'
      });
    }

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

    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      genre_id: genre_id,
      deleted_at: null
    };

    if (condition) {
      const finalCondition = (condition as string).toUpperCase();
      let minYear: number | undefined;
      let maxYear: number | undefined;
      const currentYear = new Date().getFullYear();

      if (finalCondition === 'NEW') {
        minYear = currentYear - 1;
      } else if (finalCondition === 'LIKE_NEW') {
        minYear = currentYear - 2;
        maxYear = currentYear - 1;
      } else if (finalCondition === 'VERY_GOOD') {
        minYear = currentYear - 3;
        maxYear = currentYear - 2;
      } else if (finalCondition === 'GOOD') {
        minYear = currentYear - 5;
        maxYear = currentYear - 3;
      } else if (finalCondition === 'ACCEPTABLE') {
        minYear = currentYear - 8;
        maxYear = currentYear - 5;
      } else if (finalCondition === 'POOR') {
        maxYear = currentYear - 8;
      }

      where.publication_year = {};
      if (minYear !== undefined) where.publication_year.gte = minYear;
      if (maxYear !== undefined) where.publication_year.lte = maxYear;
    }

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

    const orderBy: any = [];
    
    if (orderByTitle) {
      orderBy.push({ title: orderByTitle as string });
    }
    
    if (orderByPublishDate) {
      orderBy.push({ publication_year: orderByPublishDate as string });
    }
    
    if (orderBy.length === 0) {
      orderBy.push({ created_at: 'desc' });
    }

    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where,
        include: {
          genre: true
        },
        skip,
        take: limitNum,
        orderBy
      }),
      prisma.book.count({ where })
    ]);

    const formattedBooks = books.map(book => ({
      id: book.id,
      title: book.title,
      writer: book.writer,
      publisher: book.publisher,
      description: book.description,
      publication_year: book.publication_year,
      price: book.price,
      stock_quantity: book.stock_quantity,
      genre: book.genre.name,
      condition: calculateCondition(book.publication_year)
    }));

    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      success: true,
      message: 'Get all book by genre successfully',
      data: formattedBooks,
      meta: {
        page: pageNum,
        limit: limitNum,
        total: total,
        total_pages: totalPages,
        prev_page: pageNum > 1 ? pageNum - 1 : null,
        next_page: pageNum < totalPages ? pageNum + 1 : null
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

    if (!book_id || typeof book_id !== 'string' || book_id.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid book_id'
      });
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No data provided for update'
      });
    }

    if (updateData.title !== undefined) {
      const titleValidation = validateString(updateData.title, 'Title', 1, 255);
      if (!titleValidation.valid) {
        return res.status(400).json({
          success: false,
          message: titleValidation.message
        });
      }
    }

    if (updateData.writer !== undefined) {
      const writerValidation = validateString(updateData.writer, 'Writer', 1, 255);
      if (!writerValidation.valid) {
        return res.status(400).json({
          success: false,
          message: writerValidation.message
        });
      }
    }

    if (updateData.publisher !== undefined) {
      const publisherValidation = validateString(updateData.publisher, 'Publisher', 1, 255);
      if (!publisherValidation.valid) {
        return res.status(400).json({
          success: false,
          message: publisherValidation.message
        });
      }
    }

    if (updateData.description !== undefined && updateData.description !== null) {
      const descValidation = validateString(updateData.description, 'Description', 0, 2000);
      if (!descValidation.valid) {
        return res.status(400).json({
          success: false,
          message: descValidation.message
        });
      }
    }

    if (updateData.publication_year !== undefined) {
      const yearValidation = validatePublicationYear(updateData.publication_year);
      if (!yearValidation.valid) {
        return res.status(400).json({
          success: false,
          message: yearValidation.message
        });
      }
    }

    if (updateData.price !== undefined) {
      const priceValidation = validatePrice(updateData.price);
      if (!priceValidation.valid) {
        return res.status(400).json({
          success: false,
          message: priceValidation.message
        });
      }
    }

    if (updateData.stock_quantity !== undefined) {
      const stockValidation = validateStockQuantity(updateData.stock_quantity);
      if (!stockValidation.valid) {
        return res.status(400).json({
          success: false,
          message: stockValidation.message
        });
      }
    }

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

    if (updateData.title && updateData.title.trim() !== book.title) {
      const existingBook = await prisma.book.findUnique({
        where: { title: updateData.title.trim() }
      });

      if (existingBook && !existingBook.deleted_at) {
        return res.status(400).json({
          success: false,
          message: 'Book with this title already exists'
        });
      }
    }

    if (updateData.genre_id) {
      if (typeof updateData.genre_id !== 'string' || updateData.genre_id.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid genre_id format'
        });
      }

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

    const sanitizedData: any = {};
    
    // Only include fields that are actually different from current data
    if (updateData.title !== undefined) {
      const trimmedTitle = updateData.title.trim();
      if (trimmedTitle !== book.title) {
        sanitizedData.title = trimmedTitle;
      }
    }
    
    if (updateData.writer !== undefined) {
      const trimmedWriter = updateData.writer.trim();
      if (trimmedWriter !== book.writer) {
        sanitizedData.writer = trimmedWriter;
      }
    }
    
    if (updateData.publisher !== undefined) {
      const trimmedPublisher = updateData.publisher.trim();
      if (trimmedPublisher !== book.publisher) {
        sanitizedData.publisher = trimmedPublisher;
      }
    }
    
    if (updateData.description !== undefined) {
      const trimmedDescription = updateData.description ? updateData.description.trim() : null;
      if (trimmedDescription !== book.description) {
        sanitizedData.description = trimmedDescription;
      }
    }
    
    if (updateData.publication_year !== undefined && updateData.publication_year !== book.publication_year) {
      sanitizedData.publication_year = updateData.publication_year;
    }
    
    if (updateData.price !== undefined) {
      const currentPrice = typeof book.price === 'object' ? Number(book.price) : book.price;
      if (updateData.price !== currentPrice) {
        sanitizedData.price = updateData.price;
      }
    }
    
    if (updateData.stock_quantity !== undefined && updateData.stock_quantity !== book.stock_quantity) {
      sanitizedData.stock_quantity = updateData.stock_quantity;
    }
    
    if (updateData.genre_id !== undefined && updateData.genre_id !== book.genre_id) {
      sanitizedData.genre_id = updateData.genre_id;
    }

    // If no fields have changed, return error
    if (Object.keys(sanitizedData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No changes detected. All values are the same as current data'
      });
    }

    const updatedBook = await prisma.book.update({
      where: { id: book_id },
      data: sanitizedData
    });

    return res.status(200).json({
      success: true,
      message: 'Book updated successfully',
      data: {
        id: updatedBook.id,
        title: updatedBook.title,
        updated_at: updatedBook.updated_at
      }
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

    if (!book_id || typeof book_id !== 'string' || book_id.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid book_id'
      });
    }

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
      message: 'Book removed successfully'
    });
  } catch (error) {
    console.error('DeleteBook error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};