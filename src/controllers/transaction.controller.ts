import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest, CreateTransactionRequest } from '../types';

interface GenreStat {
  genreId: string;
  genreName: string;
  bookSalesCount: number;
}

export const createTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const { user_id, items }: CreateTransactionRequest = req.body;
    const userId = user_id;

    console.log('=== CREATE TRANSACTION DEBUG ===');
    console.log('Received user_id:', userId);
    console.log('Received items:', JSON.stringify(items, null, 2));

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required in request body'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items are required and must be a non-empty array'
      });
    }

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

    const book_ids = items.map((item: { book_id: string; quantity: number }) => item.book_id);
    const uniquebook_ids = new Set(book_ids);
    if (uniquebook_ids.size !== book_ids.length) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate books in transaction items'
      });
    }

    console.log('Book IDs to find:', book_ids);

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

    const bookMap = new Map(books.map(b => [b.id, b]));

    for (const item of items) {
      const book = bookMap.get(item.book_id);
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

    const order = await prisma.$transaction(async (tx) => {
      console.time('transaction');
      
      let totalPrice = 0;
      const orderItemsData = [];

      for (const item of items) {
        const book = bookMap.get(item.book_id)!;
        const itemPrice = book.price.toNumber() * item.quantity;
        totalPrice += itemPrice;

        orderItemsData.push({
          book_id: item.book_id,
          quantity: item.quantity,
          price: book.price
        });
      }

      console.time('create-order');
      const newOrder = await tx.order.create({
        data: {
          user_id: userId,
          total_price: totalPrice,
          order_items: {
            create: orderItemsData
          }
        },
        include: {
          order_items: true
        }
      });
      console.timeEnd('create-order');

      console.log('Order created:', newOrder.id);

      console.time('update-stocks');
      const stockUpdates = items.map(item => {
        return tx.book.update({
          where: { id: item.book_id },
          data: {
            stock_quantity: {
              decrement: item.quantity
            }
          }
        });
      });

      await Promise.all(stockUpdates);
      console.timeEnd('update-stocks');

      console.time('fetch-result');
      const result = await tx.order.findUnique({
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
      console.timeEnd('fetch-result');

      console.timeEnd('transaction');
      return result;
    }, {
      maxWait: 10000,
      timeout: 15000,
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
      return res.status(400).json({
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
    console.log('Fetching transaction statistics...');
    const [orderStats, orderItems, books] = await Promise.all([
      prisma.order.aggregate({
        _count: { id: true },
        _sum: { total_price: true },
      }),
      prisma.orderItem.groupBy({
        by: ['book_id'],
        _sum: { quantity: true },
      }),
      prisma.book.findMany({
        where: {
          deleted_at: null,
        },
        select: {
          id: true,
          genre: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    console.log('Order Stats:', orderStats);
    console.log('Order Items:', orderItems);
    console.log('Books:', books);

    const totalTransactions = orderStats._count.id;
    const totalAmount = orderStats._sum.total_price?.toNumber() || 0;
    const averageTransactionAmount = totalTransactions > 0 ? totalAmount / totalTransactions : 0;

    const bookGenreMap = new Map(
      books.map((book) => [
        book.id,
        book.genre ? { genreId: book.genre.id, genreName: book.genre.name } : null,
      ])
    );

    const genreSalesMap: Record<string, { name: string; salesCount: number }> = {};

    orderItems.forEach((item) => {
      const bookId = item.book_id;
      const salesCount = item._sum.quantity || 0;
      const genre = bookGenreMap.get(bookId);

      if (genre) {
        const { genreId, genreName } = genre;
        if (!genreSalesMap[genreId]) {
          genreSalesMap[genreId] = { name: genreName, salesCount: 0 };
        }
        genreSalesMap[genreId].salesCount += salesCount;
      }
    });

    console.log('Genre Sales Map:', genreSalesMap);

    const genreStats: GenreStat[] = Object.entries(genreSalesMap).map(([genreId, data]) => ({
      genreId,
      genreName: data.name,
      bookSalesCount: data.salesCount,
    }));

    genreStats.sort((a, b) => b.bookSalesCount - a.bookSalesCount);

    console.log('Genre Stats:', genreStats);

    const mostSoldGenre = genreStats.length > 0 ? genreStats[0].genreName : null;
    const fewestSoldGenre = genreStats.length > 1 ? genreStats[genreStats.length - 1].genreName : null;

    const response = {
      success: true,
      message: 'Get transactions statistics successfully',
      data: {
        total_transactions: totalTransactions,
        average_transaction_amount: parseFloat(averageTransactionAmount.toFixed(2)),
        fewest_book_sales_genre: fewestSoldGenre,
        most_book_sales_genre: mostSoldGenre,
      },
    };
    console.log('Statistics Response:', JSON.stringify(response, null, 2));

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('GetTransactionStatistics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};