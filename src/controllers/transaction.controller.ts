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
      let totalQuantity = 0;
      const orderItemsData = [];

      for (const item of items) {
        const book = bookMap.get(item.book_id)!;
        const itemPrice = book.price.toNumber() * item.quantity;
        totalPrice += itemPrice;
        totalQuantity += item.quantity;

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

      console.timeEnd('transaction');
      
      return {
        id: newOrder.id,
        totalQuantity,
        totalPrice
      };
    }, {
      maxWait: 10000,
      timeout: 15000,
    });

    console.log('Transaction completed successfully!');
    console.log('=================================\n');

    return res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: {
        transaction_id: order.id,
        total_quantity: order.totalQuantity,
        total_price: order.totalPrice
      }
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
      limit = '10',
      search,
      orderById,
      orderByAmount,
      orderByPrice
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

    const where: any = {};

    if (search) {
      where.OR = [
        { id: { contains: search as string, mode: 'insensitive' } },
        {
          order_items: {
            some: {
              book: {
                title: { contains: search as string, mode: 'insensitive' }
              }
            }
          }
        }
      ];
    }

    const orderBy: any = [];

    // Only apply database-level sorting if NOT sorting by amount (total_quantity)
    const sortByAmount = orderByAmount as string | undefined;

    if (orderById && !sortByAmount) {
      orderBy.push({ id: orderById as string });
    }

    if (orderByPrice && !sortByAmount) {
      orderBy.push({ total_price: orderByPrice as string });
    }

    if (orderBy.length === 0 && !sortByAmount) {
      orderBy.push({ created_at: 'desc' });
    }

    // Fetch all data without pagination if sorting by amount
    const fetchLimit = sortByAmount ? undefined : limitNum;
    const fetchSkip = sortByAmount ? undefined : skip;

    const [transactions, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          order_items: {
            include: {
              book: true
            }
          }
        },
        skip: fetchSkip,
        take: fetchLimit,
        orderBy: orderBy.length > 0 ? orderBy : undefined
      }),
      prisma.order.count({ where })
    ]);

    let formattedTransactions = transactions.map(transaction => {
      const totalQuantity = transaction.order_items.reduce((sum, item) => sum + item.quantity, 0);
      
      return {
        id: transaction.id,
        total_quantity: totalQuantity,
        total_price: transaction.total_price.toNumber(),
        created_at: transaction.created_at
      };
    });

    // Sort by total_quantity in memory if orderByAmount is specified
    if (sortByAmount) {
      formattedTransactions.sort((a, b) => {
        if (sortByAmount === 'asc') {
          return a.total_quantity - b.total_quantity;
        } else {
          return b.total_quantity - a.total_quantity;
        }
      });

      // Apply pagination after sorting
      formattedTransactions = formattedTransactions.slice(skip, skip + limitNum);
    }

    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      success: true,
      message: 'Get all transaction successfully',
      data: formattedTransactions,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: totalPages,
        prev_page: pageNum > 1 ? pageNum - 1 : null,
        next_page: pageNum < totalPages ? pageNum + 1 : null
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
            book: true
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

    const items = transaction.order_items.map(item => ({
      book_id: item.book_id,
      book_title: item.book.title,
      quantity: item.quantity,
      subtotal_price: item.price.toNumber() * item.quantity
    }));

    const totalQuantity = transaction.order_items.reduce((sum, item) => sum + item.quantity, 0);

    return res.status(200).json({
      success: true,
      message: 'Get transaction detail successfully',
      data: {
        id: transaction.id,
        items: items,
        total_quantity: totalQuantity,
        total_price: transaction.total_price.toNumber()
      }
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

    const genreStats: GenreStat[] = Object.entries(genreSalesMap).map(([genreId, data]) => ({
      genreId,
      genreName: data.name,
      bookSalesCount: data.salesCount,
    }));

    genreStats.sort((a, b) => b.bookSalesCount - a.bookSalesCount);

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

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('GetTransactionStatistics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};