const { PrismaClient } = require('@prisma/client');
const { bookingSchema } = require('../utils/validation');

const prisma = new PrismaClient();
const pricingService = require('../services/pricingService');
const availabilityService = require('../services/availabilityService');
const { logEvent } = require('../services/auditService');

/**
 * Create a new booking
 * POST /api/bookings
 */
const createBooking = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = bookingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { vehicleId, locationPickupId, locationDropoffId, startDate, endDate, notes } = value;

    // Check if vehicle exists and is available
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        location: true
      }
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    if (vehicle.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'Vehicle is not available'
      });
    }

    // Check if locations exist
    const [pickupLocation, dropoffLocation] = await Promise.all([
      prisma.location.findUnique({ where: { id: locationPickupId } }),
      prisma.location.findUnique({ where: { id: locationDropoffId } })
    ]);

    if (!pickupLocation) {
      return res.status(404).json({
        success: false,
        message: 'Pickup location not found'
      });
    }

    if (!dropoffLocation) {
      return res.status(404).json({
        success: false,
        message: 'Dropoff location not found'
      });
    }

    // Check for booking conflicts
    const start = new Date(startDate);
    const end = new Date(endDate);

    const conflictingBookings = await prisma.booking.findMany({
      where: {
        vehicleId,
        status: { in: ['confirmed', 'active'] },
        OR: [
          {
            startDate: { lte: end },
            endDate: { gte: start }
          }
        ]
      }
    });

    if (conflictingBookings.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Vehicle is not available for the selected dates'
      });
    }

    // Calculate total price (use pricing service)
    let priceBreakdown = { total: vehicle.dailyRate };
    try {
      priceBreakdown = await pricingService.calculatePriceForBooking({ vehicleId, startDate: start, endDate: end, addons: [], promoCode: null, userId: req.user.id });
    } catch (e) {
      console.warn('Pricing calculation failed, falling back to simple price', e);
    }

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        userId: req.user.id,
        vehicleId,
        locationPickupId,
        locationDropoffId,
        startDate: start,
        endDate: end,
        subtotal: priceBreakdown.subtotal || 0,
        taxes: priceBreakdown.taxes || 0,
        fees: (priceBreakdown.fees || 0) + (priceBreakdown.youngDriverFee || 0),
        totalPrice: priceBreakdown.total || 0,
        addons: priceBreakdown.addons || [],
        notes,
        status: 'pending'
      },
      include: {
        vehicle: {
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
        pickupLocation: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
            city: true
          }
        },
        dropoffLocation: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
            city: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: { booking }
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get user's bookings
 * GET /api/bookings
 */
const getUserBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {
      userId: req.user.id
    };

    if (status) {
      where.status = status;
    }

    const [bookings, totalCount] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          vehicle: {
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
          pickupLocation: {
            select: {
              id: true,
              name: true,
              code: true,
              address: true,
              city: true
            }
          },
          dropoffLocation: {
            select: {
              id: true,
              name: true,
              code: true,
              address: true,
              city: true
            }
          },
          payment: {
            select: {
              id: true,
              amount: true,
              method: true,
              status: true,
              createdAt: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take
      }),
      prisma.booking.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / take);

    res.json({
      success: true,
      data: {
        bookings,
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
    console.error('Get user bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get booking by ID
 * GET /api/bookings/:id
 */
const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        vehicle: {
          include: {
            location: true
          }
        },
        pickupLocation: true,
        dropoffLocation: true,
        payment: true
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns the booking or is admin
    if (booking.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { booking }
    });
  } catch (error) {
    console.error('Get booking by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Update booking status (Admin only)
 * PUT /api/bookings/:id/status
 */
const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'active', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const booking = await prisma.booking.findUnique({
      where: { id }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: { status },
      include: {
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            year: true,
            type: true
          }
        },
        pickupLocation: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        dropoffLocation: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Booking status updated successfully',
      data: { booking: updatedBooking }
    });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Cancel booking
 * PUT /api/bookings/:id/cancel
 */
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        payment: true
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns the booking
    if (booking.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if booking can be cancelled
    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel this booking'
      });
    }

    // Check if booking has started
    const now = new Date();
    if (booking.startDate <= now && booking.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel an active booking'
      });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: { status: 'cancelled' }
    });

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: { booking: updatedBooking }
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get all bookings (Admin only)
 * GET /api/bookings/admin/all
 */
const getAllBookings = async (req, res) => {
  try {
    const { status, userId, vehicleId, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    if (vehicleId) {
      where.vehicleId = vehicleId;
    }

    const [bookings, totalCount] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          vehicle: {
            select: {
              id: true,
              make: true,
              model: true,
              year: true,
              type: true,
              dailyRate: true
            }
          },
          pickupLocation: {
            select: {
              id: true,
              name: true,
              code: true,
              city: true
            }
          },
          dropoffLocation: {
            select: {
              id: true,
              name: true,
              code: true,
              city: true
            }
          },
          payment: {
            select: {
              id: true,
              amount: true,
              method: true,
              status: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take
      }),
      prisma.booking.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / take);

    res.json({
      success: true,
      data: {
        bookings,
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
    console.error('Get all bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Exports will be defined after all handlers to ensure functions are initialized

/**
 * Create a booking hold (reserve vehicle for short time)
 * POST /api/bookings/hold
 */
const holdBooking = async (req, res) => {
  try {
    const { error, value } = bookingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map(d => d.message) });
    }

    const { vehicleId, locationPickupId, locationDropoffId, startDate, endDate, addons = [], promoCode } = value;

    // Check availability
    const available = await availabilityService.isVehicleAvailable(vehicleId, startDate, endDate);
    if (!available) {
      return res.status(409).json({ success: false, message: 'Vehicle not available for selected dates' });
    }

    // Calculate price
    const price = await pricingService.calculatePriceForBooking({ vehicleId, startDate, endDate, addons, promoCode, userId: req.user.id });

    // Create booking with pending_hold and holdExpiresAt (e.g., 15 minutes)
    const holdDurationMinutes = parseInt(process.env.HOLD_MINUTES || '15');
    const holdExpiresAt = new Date(Date.now() + holdDurationMinutes * 60 * 1000);

    const booking = await prisma.booking.create({
      data: {
        userId: req.user.id,
        vehicleId,
        locationPickupId,
        locationDropoffId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        subtotal: price.subtotal,
        taxes: price.taxes,
        fees: price.fees + price.youngDriverFee,
        totalPrice: price.total,
        addons: price.addons,
        promoCode: promoCode || null,
        status: 'pending_hold',
        paymentStatus: 'pending',
        holdExpiresAt
      }
    });

    await logEvent('booking', booking.id, 'hold_created', { userId: req.user.id, holdExpiresAt, price });

    res.status(201).json({ success: true, message: 'Hold created', data: { booking, price } });
  } catch (error) {
    console.error('Hold booking error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Confirm a booking (capture payment / finalize)
 * POST /api/bookings/confirm
 */
const confirmBooking = async (req, res) => {
  try {
    const { bookingId, providerId, paymentMethod = 'credit_card' } = req.body;
    if (!bookingId) return res.status(400).json({ success: false, message: 'bookingId is required' });

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Check hold expiration
    if (booking.status !== 'pending_hold') {
      return res.status(400).json({ success: false, message: 'Booking is not in hold state' });
    }
    if (booking.holdExpiresAt && new Date(booking.holdExpiresAt) < new Date()) {
      // expire
      await prisma.booking.update({ where: { id: bookingId }, data: { status: 'cancelled' } });
      await logEvent('booking', bookingId, 'hold_expired', {});
      return res.status(410).json({ success: false, message: 'Hold expired' });
    }

    // Here you would integrate with Stripe to capture payment; for now create Payment record and mark as completed
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: booking.totalPrice,
        method: paymentMethod,
        status: 'completed',
        providerId: providerId || null
      }
    });

    const updated = await prisma.booking.update({ where: { id: bookingId }, data: { status: 'confirmed', paymentStatus: 'captured' } });
    await logEvent('booking', bookingId, 'confirmed', { paymentId: payment.id });

    res.json({ success: true, message: 'Booking confirmed', data: { booking: updated, payment } });
  } catch (error) {
    console.error('Confirm booking error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Final exports
module.exports = {
  createBooking,
  getUserBookings,
  getBookingById,
  updateBookingStatus,
  cancelBooking,
  getAllBookings,
  holdBooking,
  confirmBooking,
};