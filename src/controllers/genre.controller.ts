import { Request, Response } from 'express';
import prisma from '../config/database';
import { CreateGenreRequest, UpdateGenreRequest } from '../types';

export const createGenre = async (req: Request, res: Response) => {
  try {
    const { name }: CreateGenreRequest = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Genre name is required'
      });
    }

    if (name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Genre name cannot be empty'
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Genre name is too long (max 100 characters)'
      });
    }

    const existingGenre = await prisma.genre.findFirst({
      where: { 
        name,
        deleted_at: null
      }
    });

    if (existingGenre) {
      return res.status(400).json({
        success: false,
        message: 'Genre with this name already exists'
      });
    }

    const genre = await prisma.genre.create({
      data: { 
        name
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Genre created successfully',
      data: {
        id: genre.id,
        name: genre.name,
        created_at: genre.created_at
      }
    });
  } catch (error: any) {
    console.error('CreateGenre error:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Genre with this name already exists'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getAllGenres = async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '10',
      search,
      orderByName
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      deleted_at: null
    };

    if (search) {
      where.name = {
        contains: search as string,
        mode: 'insensitive'
      };
    }

    const orderBy: any = [];
    
    if (orderByName) {
      orderBy.push({ name: orderByName as string });
    }
    
    if (orderBy.length === 0) {
      orderBy.push({ created_at: 'desc' });
    }

    const [genres, total] = await Promise.all([
      prisma.genre.findMany({
        where,
        skip,
        take: limitNum,
        orderBy
      }),
      prisma.genre.count({ where })
    ]);

    const formattedGenres = genres.map(genre => ({
      id: genre.id,
      name: genre.name
    }));

    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      success: true,
      message: 'Get all genre successfully',
      data: formattedGenres,
      meta: {
        page: pageNum,
        limit: limitNum,
        prev_page: pageNum > 1 ? pageNum - 1 : null,
        next_page: pageNum < totalPages ? pageNum + 1 : null
      }
    });
  } catch (error: any) {
    console.error('GetAllGenres error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getGenreDetail = async (req: Request, res: Response) => {
  try {
    const { genre_id } = req.params;

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

    return res.status(200).json({
      success: true,
      message: 'Get genre detail successfully',
      data: {
        id: genre.id,
        name: genre.name
      }
    });
  } catch (error: any) {
    console.error('GetGenreDetail error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const updateGenre = async (req: Request, res: Response) => {
  try {
    const { genre_id } = req.params;
    const { name }: UpdateGenreRequest = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Genre name is required'
      });
    }

    if (name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Genre name cannot be empty'
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Genre name is too long (max 100 characters)'
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

    if (name && name !== genre.name) {
      const existingGenre = await prisma.genre.findFirst({
        where: { 
          name,
          deleted_at: null
        }
      });

      if (existingGenre) {
        return res.status(400).json({
          success: false,
          message: 'Genre with this name already exists'
        });
      }
    }

    const updatedGenre = await prisma.genre.update({
      where: { id: genre_id },
      data: { name }
    });

    return res.status(200).json({
      success: true,
      message: 'Genre updated successfully',
      data: {
        id: updatedGenre.id,
        name: updatedGenre.name,
        updated_at: updatedGenre.updated_at
      }
    });
  } catch (error: any) {
    console.error('UpdateGenre error:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Genre with this name already exists'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const deleteGenre = async (req: Request, res: Response) => {
  try {
    const { genre_id } = req.params;

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

    await prisma.genre.update({
      where: { id: genre_id },
      data: {
        deleted_at: new Date()
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Genre removed successfully'
    });
  } catch (error: any) {
    console.error('DeleteGenre error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};