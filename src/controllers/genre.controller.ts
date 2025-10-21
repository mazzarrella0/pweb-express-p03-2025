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

    const existingGenre = await prisma.genre.findUnique({
      where: { name }
    });

    if (existingGenre && !existingGenre.deletedAt) {
      return res.status(400).json({
        success: false,
        message: 'Genre with this name already exists'
      });
    }

    const genre = await prisma.genre.create({
      data: { name }
    });

    return res.status(201).json({
      success: true,
      message: 'Genre created successfully',
      data: genre
    });
  } catch (error) {
    console.error('CreateGenre error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getAllGenres = async (req: Request, res: Response) => {
  try {
    const genres = await prisma.genre.findMany({
      where: {
        deletedAt: null
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.status(200).json({
      success: true,
      data: genres
    });
  } catch (error) {
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
        deletedAt: null
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
      data: genre
    });
  } catch (error) {
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

    const genre = await prisma.genre.findFirst({
      where: {
        id: genre_id,
        deletedAt: null
      }
    });

    if (!genre) {
      return res.status(404).json({
        success: false,
        message: 'Genre not found'
      });
    }

    if (name && name !== genre.name) {
      const existingGenre = await prisma.genre.findUnique({
        where: { name }
      });

      if (existingGenre && !existingGenre.deletedAt) {
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
      data: updatedGenre
    });
  } catch (error) {
    console.error('UpdateGenre error:', error);
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
        deletedAt: null
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
        deletedAt: new Date()
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Genre deleted successfully'
    });
  } catch (error) {
    console.error('DeleteGenre error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};