import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest, CreateTransactionRequest } from '../types';

interface GenreTransactionData {
  count: number;
  name: string;
}

interface GenreStat {
  genreId: string;
  genreName: string;
  transactionCount: number;
}

export const createTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const { user_id, items }: CreateTransactionRequest = req.body;
    const userId = user_id;

    console.log('=== CREATE TRANSACTION DEBUG ===');
    console.log('Received user_id:', userId);
    console.log('Received items:', JSON.stringify(items, null, 2));

    // Validasi user_id
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required in request body'
      });
    }

    // Validasi items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items are required and must be a non-empty array'
      });
    }

    // Validasi setiap item
    for (const item of items) {
      if (!item.book_id || !item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Each item must have a valid book_id and quantity greater than 0'
        });
      }

      if (!Number.isInteger(item.quantity)) {
        return res.status(400).json({
          success: false,
          message: 'Quantity must be an integer'
        });
      }
    }

    // Cek duplikasi book_id
    const book_ids = items.map((item: { book_id: string; quantity: number }) => item.book_id);
    const uniquebook_ids = new Set(book_ids);
    if (uniquebook_ids.size !== book_ids.length) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate books in transaction items'
      });
    }

    console.log('Book IDs to find:', book_ids);

    // Validasi user existence
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('User found:', user.id);

    // Test: Coba query tanpa WHERE clause dulu
    const testAllBooks = await prisma.book.findMany({
      take: 5
    });
    console.log('Sample books in DB:', testAllBooks.map(b => ({ id: b.id, title: b.title })));

    // Cek books - PERBAIKAN: Pastikan query yang benar
    const books = await prisma.book.findMany({
      where: {
        id: { in: book_ids },
        deleted_at: null
      },
      include: {
        genre: true
      }
    });

    console.log('Books found:', books.length);
    console.log('Books details:', books.map(b => ({ 
      id: b.id, 
      title: b.title, 
      stock: b.stock_quantity,
      deleted_at: b.deleted_at 
    })));

    if (books.length !== book_ids.length) {
      const foundBookIds = books.map(b => b.id);
      const missingBookIds = book_ids.filter(id => !foundBookIds.includes(id));
      
      console.log('Missing book IDs:', missingBookIds);
      
      return res.status(404).json({
        success: false,
        message: 'One or more books not found',
        debug: {
          requestedIds: book_ids,
          foundIds: foundBookIds,
          missingIds: missingBookIds
        }
      });
    }

    // Validasi stock
    for (const item of items) {
      const book = books.find((b: any) => b.id === item.book_id);
      if (!book) {
        return res.status(404).json({
          success: false,
          message: `Book not found: ${item.book_id}`
        });
      }
      
      if (book.stock_quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for book: ${book.title}. Available: ${book.stock_quantity}, Requested: ${item.quantity}`
        });
      }
    }

    console.log('All validations passed. Creating transaction...');

    // Create transaction
    const order = await prisma.$transaction(async (tx: any) => {
      let totalPrice = 0;

      const newOrder = await tx.order.create({
        data: {
          user_id: userId,
          total_price: 0
        }
      });

      console.log('Order created:', newOrder.id);

      for (const item of items) {
        const book = books.find((b: any) => b.id === item.book_id);
        
        if (!book) {
          throw new Error(`Book not found: ${item.book_id}`);
        }
        
        const itemPrice = book.price.toNumber() * item.quantity;
        totalPrice += itemPrice;

        await tx.orderItem.create({
          data: {
            order_id: newOrder.id,
            book_id: item.book_id,
            quantity: item.quantity,
            price: book.price
          }
        });

        await tx.book.update({
          where: { id: item.book_id },
          data: {
            stock_quantity: {
              decrement: item.quantity
            }
          }
        });

        console.log(`Added item: ${book.title} x${item.quantity}`);
      }

      await tx.order.update({
        where: { id: newOrder.id },
        data: { total_price: totalPrice }
      });

      console.log('Total price updated:', totalPrice);

      return tx.order.findUnique({
        where: { id: newOrder.id },
        include: {
          order_items: {
            include: {
              book: {
                include: {
                  genre: true
                }
              }
            }
          },
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        }
      });
    });

    console.log('Transaction completed successfully!');
    console.log('=================================\n');

    return res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: order
    });
  } catch (error: any) {
    console.error('CreateTransaction error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getAllTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '10'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid page number'
      });
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid limit (must be 1-100)'
      });
    }

    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      prisma.order.findMany({
        include: {
          order_items: {
            include: {
              book: {
                include: {
                  genre: true
                }
              }
            }
          },
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        },
        skip,
        take: limitNum,
        orderBy: {
          created_at: 'desc'
        }
      }),
      prisma.order.count()
    ]);

    return res.status(200).json({
      success: true,
      message: 'Transactions retrieved successfully',
      data: transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error('GetAllTransactions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getTransactionDetail = async (req: AuthRequest, res: Response) => {
  try {
    const { transaction_id } = req.params;

    const transaction = await prisma.order.findUnique({
      where: { id: transaction_id },
      include: {
        order_items: {
          include: {
            book: {
              include: {
                genre: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Transaction retrieved successfully',
      data: transaction
    });
  } catch (error: any) {
    console.error('GetTransactionDetail error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getTransactionStatistics = async (req: AuthRequest, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        order_items: {
          include: {
            book: {
              include: {
                genre: true
              }
            }
          }
        }
      }
    });

    const totalTransactions = orders.length;

    let totalAmount = 0;
    const genreTransactionCount: Record<string, GenreTransactionData> = {};

    orders.forEach((order: any) => {
      const genresInOrder = new Set<string>();
      
      order.order_items.forEach((item: any) => {
        const itemTotal = item.book.price.toNumber() * item.quantity;
        totalAmount += itemTotal;

        const genreId = item.book.genre_id;
        genresInOrder.add(genreId);
      });
      
      genresInOrder.forEach((genreId) => {
        const orderItem = order.order_items.find((item: any) => item.book.genre_id === genreId);
        
        if (orderItem && orderItem.book && orderItem.book.genre) {
          const genreName = orderItem.book.genre.name;
          
          if (!genreTransactionCount[genreId]) {
            genreTransactionCount[genreId] = { count: 0, name: genreName };
          }
          genreTransactionCount[genreId].count += 1;
        }
      });
    });

    const averageTransactionAmount = totalTransactions > 0 ? totalAmount / totalTransactions : 0;

    const genreStats: GenreStat[] = Object.entries(genreTransactionCount).map(([id, data]: [string, GenreTransactionData]) => ({
      genreId: id,
      genreName: data.name,
      transactionCount: data.count
    }));

    genreStats.sort((a: GenreStat, b: GenreStat) => b.transactionCount - a.transactionCount);

    const mostTransactedGenre = genreStats.length > 0 ? genreStats[0] : null;
    const leastTransactedGenre = genreStats.length > 0 ? genreStats[genreStats.length - 1] : null;

    return res.status(200).json({
      success: true,
      message: 'Transaction statistics retrieved successfully',
      data: {
        totalTransactions,
        averageTransactionAmount: parseFloat(averageTransactionAmount.toFixed(2)),
        mostTransactedGenre: mostTransactedGenre ? {
          genreId: mostTransactedGenre.genreId,
          genreName: mostTransactedGenre.genreName,
          transactionCount: mostTransactedGenre.transactionCount
        } : null,
        leastTransactedGenre: leastTransactedGenre ? {
          genreId: leastTransactedGenre.genreId,
          genreName: leastTransactedGenre.genreName,
          transactionCount: leastTransactedGenre.transactionCount
        } : null
      }
    });
  } catch (error: any) {
    console.error('GetTransactionStatistics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};