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
    const { items }: CreateTransactionRequest = req.body;
    const userId = req.user!.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items are required and must be a non-empty array'
      });
    }

    for (const item of items) {
      if (!item.bookId || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Each item must have a valid bookId and quantity greater than 0'
        });
      }
    }

    const bookIds = items.map((item: { bookId: string; quantity: number }) => item.bookId);
    const books = await prisma.book.findMany({
      where: {
        id: { in: bookIds },
        deletedAt: null
      }
    });

    if (books.length !== bookIds.length) {
      return res.status(404).json({
        success: false,
        message: 'One or more books not found'
      });
    }

    for (const item of items) {
      const book = books.find((b: any) => b.id === item.bookId);
      if (book && book.stockQuantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for book: ${book.title}`
        });
      }
    }

    const order = await prisma.$transaction(async (tx: any) => {
      const newOrder = await tx.order.create({
        data: {
          userId
        }
      });

      for (const item of items) {
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            bookId: item.bookId,
            quantity: item.quantity
          }
        });

        await tx.book.update({
          where: { id: item.bookId },
          data: {
            stockQuantity: {
              decrement: item.quantity
            }
          }
        });
      }

      return tx.order.findUnique({
        where: { id: newOrder.id },
        include: {
          orderItems: {
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

    return res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: order
    });
  } catch (error) {
    console.error('CreateTransaction error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getAllTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const transactions = await prisma.order.findMany({
      include: {
        orderItems: {
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
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (error) {
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
        orderItems: {
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
      data: transaction
    });
  } catch (error) {
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
        orderItems: {
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
      order.orderItems.forEach((item: any) => {
        const itemTotal = item.book.price.toNumber() * item.quantity;
        totalAmount += itemTotal;

        const genreId = item.book.genreId;
        const genreName = item.book.genre.name;

        if (!genreTransactionCount[genreId]) {
          genreTransactionCount[genreId] = { count: 0, name: genreName };
        }
        genreTransactionCount[genreId].count += 1;
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
  } catch (error) {
    console.error('GetTransactionStatistics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};