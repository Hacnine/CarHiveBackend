const { PrismaClient } = require('@prisma/client');
const { vehicleSchema } = require('../utils/validation');

const prisma = new PrismaClient();
const availabilityService = require('../services/availabilityService');
const pricingService = require('../services/pricingService');

/**
 * Get all vehicles with filtering and search
 * GET /api/vehicles
 */
const getVehicles = async (req, res) => {
  try {
    const {
      location,
      type,
      transmission,
      fuelType,
      minPrice,
      maxPrice,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 10,
      sortBy = 'dailyRate',
      sortOrder = 'asc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build filter conditions
    const where = {
      status: 'available'
    };

    if (location) {
      where.location = {
        OR: [
          { code: { contains: location, mode: 'insensitive' } },
          { name: { contains: location, mode: 'insensitive' } },
          { city: { contains: location, mode: 'insensitive' } }
        ]
      };
    }

    if (type) {
      where.type = type;
    }

    if (transmission) {
      where.transmission = transmission;
    }

    if (fuelType) {
      where.fuelType = fuelType;
    }

    if (minPrice || maxPrice) {
      where.dailyRate = {};
      if (minPrice) where.dailyRate.gte = parseFloat(minPrice);
      if (maxPrice) where.dailyRate.lte = parseFloat(maxPrice);
    }

    if (search) {
      where.OR = [
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Check availability for specific dates
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Find vehicles that don't have conflicting bookings
      const bookedVehicleIds = await prisma.booking.findMany({
        where: {
          status: { in: ['confirmed', 'active'] },
          OR: [
            {
              startDate: { lte: end },
              endDate: { gte: start }
            }
          ]
        },
        select: { vehicleId: true }
      });

      const bookedIds = bookedVehicleIds.map(booking => booking.vehicleId);
      
      if (bookedIds.length > 0) {
        where.id = { notIn: bookedIds };
      }
    }

    // Build sort object
    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const [vehicles, totalCount] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        include: {
          location: {
            select: {
              id: true,
              name: true,
              code: true,
              city: true,
              type: true
            }
          },
          reviews: {
            select: {
              rating: true
            }
          },
          _count: {
            select: {
              reviews: true
            }
          }
        },
        orderBy,
        skip,
        take
      }),
      prisma.vehicle.count({ where })
    ]);

    // Calculate average rating for each vehicle
    const vehiclesWithRating = vehicles.map(vehicle => {
      const avgRating = vehicle.reviews.length > 0
        ? vehicle.reviews.reduce((sum, review) => sum + review.rating, 0) / vehicle.reviews.length
        : 0;
      
      const { reviews, ...vehicleData } = vehicle;
      return {
        ...vehicleData,
        averageRating: Math.round(avgRating * 10) / 10,
        reviewCount: vehicle._count.reviews
      };
    });

    const totalPages = Math.ceil(totalCount / take);

    res.json({
      success: true,
      data: {
        vehicles: vehiclesWithRating,
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
    console.error('Get vehicles error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get single vehicle by ID
 * GET /api/vehicles/:id
 */
const getVehicleById = async (req, res) => {
  try {
    const { id } = req.params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        location: true,
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        _count: {
          select: {
            reviews: true
          }
        }
      }
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Calculate average rating
    const avgRating = vehicle.reviews.length > 0
      ? vehicle.reviews.reduce((sum, review) => sum + review.rating, 0) / vehicle.reviews.length
      : 0;

    const vehicleData = {
      ...vehicle,
      averageRating: Math.round(avgRating * 10) / 10,
      reviewCount: vehicle._count.reviews
    };

    res.json({
      success: true,
      data: { vehicle: vehicleData }
    });
  } catch (error) {
    console.error('Get vehicle by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Create new vehicle (Admin only)
 * POST /api/vehicles
 */
const createVehicle = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = vehicleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    // Check if location exists
    const location = await prisma.location.findUnique({
      where: { id: value.locationId }
    });

    if (!location) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location ID'
      });
    }

    const vehicle = await prisma.vehicle.create({
      data: value,
      include: {
        location: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            type: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle created successfully',
      data: { vehicle }
    });
  } catch (error) {
    console.error('Create vehicle error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Update vehicle (Admin only)
 * PUT /api/vehicles/:id
 */
const updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const { error, value } = vehicleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    // Check if vehicle exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id }
    });

    if (!existingVehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Check if location exists (if being updated)
    if (value.locationId) {
      const location = await prisma.location.findUnique({
        where: { id: value.locationId }
      });

      if (!location) {
        return res.status(400).json({
          success: false,
          message: 'Invalid location ID'
        });
      }
    }

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: value,
      include: {
        location: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            type: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Vehicle updated successfully',
      data: { vehicle }
    });
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Delete vehicle (Admin only)
 * DELETE /api/vehicles/:id
 */
const deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if vehicle exists
    const vehicle = await prisma.vehicle.findUnique({
      where: { id }
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Check for active bookings
    const activeBookings = await prisma.booking.count({
      where: {
        vehicleId: id,
        status: { in: ['confirmed', 'active'] }
      }
    });

    if (activeBookings > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete vehicle with active bookings'
      });
    }

    await prisma.vehicle.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Vehicle deleted successfully'
    });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getVehicles,
  // new export
  getAvailableVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle
};

/**
 * Get available vehicles for a date range and optional filters
 * GET /api/vehicles/available
 */
async function getAvailableVehicles(req, res) {
  try {
    const { startDate, endDate, locationCode, category, transmission, maxPrice } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    // Find candidates using availability service (which checks bookings)
    const candidates = await availabilityService.findAvailableVehicles({ startDate, endDate, locationCode, category });

    // Apply simple filters client-side
    let filtered = candidates;
    if (transmission) filtered = filtered.filter(v => String(v.transmission) === String(transmission));
    if (maxPrice) filtered = filtered.filter(v => (v.dailyRate || v.baseDailyRate || 0) <= parseFloat(maxPrice));

    // For each vehicle compute a price estimate
    const estimates = [];
    for (const v of filtered) {
      try {
        const price = await pricingService.calculatePriceForBooking({ vehicleId: v.id, startDate, endDate, addons: [], promoCode: null, userId: req.user ? req.user.id : null });
        estimates.push({ vehicle: v, price });
      } catch (e) {
        estimates.push({ vehicle: v, price: null });
      }
    }

    res.json({ success: true, data: { results: estimates } });
  } catch (error) {
    console.error('Get available vehicles error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}