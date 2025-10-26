const { PrismaClient } = require('@prisma/client');
const { reviewSchema } = require('../utils/validation');

const prisma = new PrismaClient();

/**
 * Create a new review
 * POST /api/reviews
 */
const createReview = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = reviewSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { vehicleId, rating, comment } = value;

    // Check if vehicle exists
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId }
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Check if user has completed a booking for this vehicle
    const completedBooking = await prisma.booking.findFirst({
      where: {
        userId: req.user.id,
        vehicleId,
        status: 'completed'
      }
    });

    if (!completedBooking) {
      return res.status(400).json({
        success: false,
        message: 'You can only review vehicles you have rented'
      });
    }

    // Check if user has already reviewed this vehicle
    const existingReview = await prisma.review.findFirst({
      where: {
        userId: req.user.id,
        vehicleId
      }
    });

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: 'You have already reviewed this vehicle'
      });
    }

    const review = await prisma.review.create({
      data: {
        userId: req.user.id,
        vehicleId,
        rating,
        comment
      },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        },
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            year: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: { review }
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get reviews for a vehicle
 * GET /api/reviews/vehicle/:vehicleId
 */
const getVehicleReviews = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Check if vehicle exists
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId }
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Build sort object
    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const [reviews, totalCount, avgRating] = await Promise.all([
      prisma.review.findMany({
        where: { vehicleId },
        include: {
          user: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy,
        skip,
        take
      }),
      prisma.review.count({ where: { vehicleId } }),
      prisma.review.aggregate({
        where: { vehicleId },
        _avg: {
          rating: true
        }
      })
    ]);

    const totalPages = Math.ceil(totalCount / take);

    res.json({
      success: true,
      data: {
        reviews,
        summary: {
          totalReviews: totalCount,
          averageRating: avgRating._avg.rating ? Math.round(avgRating._avg.rating * 10) / 10 : 0
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get vehicle reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get user's reviews
 * GET /api/reviews/user
 */
const getUserReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [reviews, totalCount] = await Promise.all([
      prisma.review.findMany({
        where: { userId: req.user.id },
        include: {
          vehicle: {
            select: {
              id: true,
              make: true,
              model: true,
              year: true,
              type: true,
              imageUrl: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take
      }),
      prisma.review.count({ where: { userId: req.user.id } })
    ]);

    const totalPages = Math.ceil(totalCount / take);

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Update review
 * PUT /api/reviews/:id
 */
const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    // Validate input
    if (!rating && !comment) {
      return res.status(400).json({
        success: false,
        message: 'At least one field (rating or comment) is required'
      });
    }

    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Check if review exists and belongs to user
    const review = await prisma.review.findUnique({
      where: { id }
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (review.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const updateData = {};
    if (rating) updateData.rating = rating;
    if (comment !== undefined) updateData.comment = comment;

    const updatedReview = await prisma.review.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        },
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            year: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Review updated successfully',
      data: { review: updatedReview }
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Delete review
 * DELETE /api/reviews/:id
 */
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if review exists and belongs to user (or user is admin)
    const review = await prisma.review.findUnique({
      where: { id }
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (review.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await prisma.review.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get all reviews (Admin only)
 * GET /api/reviews/admin/all
 */
const getAllReviews = async (req, res) => {
  try {
    const { vehicleId, userId, rating, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};

    if (vehicleId) {
      where.vehicleId = vehicleId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (rating) {
      where.rating = parseInt(rating);
    }

    const [reviews, totalCount] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          vehicle: {
            select: {
              id: true,
              make: true,
              model: true,
              year: true,
              type: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take
      }),
      prisma.review.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / take);

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get all reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  createReview,
  getVehicleReviews,
  getUserReviews,
  updateReview,
  deleteReview,
  getAllReviews
};