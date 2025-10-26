const { PrismaClient } = require('@prisma/client');
const { locationSchema } = require('../utils/validation');

const prisma = new PrismaClient();

/**
 * Get all locations
 * GET /api/locations
 */
const getLocations = async (req, res) => {
  try {
    const { type, city, search, isActive = true } = req.query;

    const where = {
      isActive: isActive === 'true'
    };

    if (type) {
      where.type = type;
    }

    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } }
      ];
    }

    const locations = await prisma.location.findMany({
      where,
      include: {
        _count: {
          select: {
            vehicles: true
          }
        }
      },
      orderBy: [
        { type: 'asc' },
        { name: 'asc' }
      ]
    });

    res.json({
      success: true,
      data: { locations }
    });
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get location by ID
 * GET /api/locations/:id
 */
const getLocationById = async (req, res) => {
  try {
    const { id } = req.params;

    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        vehicles: {
          where: {
            status: 'available'
          },
          select: {
            id: true,
            make: true,
            model: true,
            year: true,
            type: true,
            dailyRate: true,
            imageUrl: true
          }
        },
        _count: {
          select: {
            vehicles: true,
            pickupBookings: true,
            dropoffBookings: true
          }
        }
      }
    });

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    res.json({
      success: true,
      data: { location }
    });
  } catch (error) {
    console.error('Get location by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Create new location (Admin only)
 * POST /api/locations
 */
const createLocation = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = locationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    // Check if location code already exists
    const existingLocation = await prisma.location.findUnique({
      where: { code: value.code }
    });

    if (existingLocation) {
      return res.status(409).json({
        success: false,
        message: 'Location code already exists'
      });
    }

    const location = await prisma.location.create({
      data: value
    });

    res.status(201).json({
      success: true,
      message: 'Location created successfully',
      data: { location }
    });
  } catch (error) {
    console.error('Create location error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Update location (Admin only)
 * PUT /api/locations/:id
 */
const updateLocation = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate request body
    const { error, value } = locationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    // Check if location exists
    const existingLocation = await prisma.location.findUnique({
      where: { id }
    });

    if (!existingLocation) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    // Check if location code is being changed and already exists
    if (value.code !== existingLocation.code) {
      const codeExists = await prisma.location.findUnique({
        where: { code: value.code }
      });

      if (codeExists) {
        return res.status(409).json({
          success: false,
          message: 'Location code already exists'
        });
      }
    }

    const location = await prisma.location.update({
      where: { id },
      data: value
    });

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: { location }
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Delete location (Admin only)
 * DELETE /api/locations/:id
 */
const deleteLocation = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if location exists
    const location = await prisma.location.findUnique({
      where: { id }
    });

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    // Check for associated vehicles
    const vehicleCount = await prisma.vehicle.count({
      where: { locationId: id }
    });

    if (vehicleCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete location with associated vehicles'
      });
    }

    // Check for associated bookings
    const bookingCount = await prisma.booking.count({
      where: {
        OR: [
          { locationPickupId: id },
          { locationDropoffId: id }
        ]
      }
    });

    if (bookingCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete location with associated bookings'
      });
    }

    await prisma.location.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Location deleted successfully'
    });
  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation
};