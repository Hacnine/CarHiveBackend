const { PrismaClient } = require('@prisma/client');
const { bookingSchema } = require('../utils/validation');

const prisma = new PrismaClient();
const pricingService = require('../services/pricingService');
const availabilityService = require('../services/availabilityService');
const { logEvent } = require('../services/auditService');
const notificationService = require('../services/notificationService');
const LoyaltyService = require('../services/loyaltyService');

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
      priceBreakdown = await pricingService.calculatePriceForBooking({ vehicleId, startDate: start, endDate: end, addons: [], promoCode: null, userId: req.user.id, pickupLocationId, dropoffLocationId });
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
        },
        user: {
          select: {
            email: true
          }
        }
      }
    });

    // Send confirmation email
    try {
      await notificationService.sendBookingConfirmation(booking.user.email, booking);
    } catch (e) {
      console.warn('Failed to send booking confirmation email', e);
    }

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
        payment: true,
        user: true
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
    if (['completed', 'cancelled', 'active'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel this booking'
      });
    }

    const now = new Date();
    const startDate = new Date(booking.startDate);
    const hoursBeforeStart = (startDate - now) / (1000 * 60 * 60);

    // Cancellation policy: free if >48 hours before start, else 50% fee
    let cancellationFee = 0;
    let refundAmount = 0;
    if (hoursBeforeStart <= 48) {
      cancellationFee = booking.totalPrice * 0.5;
      refundAmount = booking.totalPrice - cancellationFee;
    } else {
      refundAmount = booking.totalPrice;
    }

    const addons = booking.addons || {};
    addons.cancellation = {
      cancelledAt: now,
      hoursBeforeStart,
      cancellationFee,
      refundAmount,
      policy: hoursBeforeStart > 48 ? 'free' : '50% fee'
    };

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: { status: 'cancelled', addons }
    });

    // Update vehicle status back to available if reserved
    if (booking.vehicleId && ['confirmed', 'ready_for_pickup'].includes(booking.status)) {
      await prisma.vehicle.update({
        where: { id: booking.vehicleId },
        data: { status: 'available' }
      });
    }

    await logEvent('booking', id, 'cancelled', { userId: req.user.id, cancellationFee, refundAmount });

    // Send cancellation confirmation
    try {
      await notificationService.sendCancellationNotice(booking.user.email, updatedBooking, { cancellationFee, refundAmount });
    } catch (e) {
      console.warn('Failed to send cancellation notice', e);
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: { booking: updatedBooking, cancellationFee, refundAmount }
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
    const price = await pricingService.calculatePriceForBooking({ vehicleId, startDate, endDate, addons, promoCode, userId: req.user.id, pickupLocationId, dropoffLocationId });

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

/**
 * Get dashboard summary for the authenticated user
 * GET /api/bookings/dashboard
 */
const getUserDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    const [upcomingOrdersCount, totalOrdersCount, cancelledOrdersCount, couponsCount, recentBookings] = await Promise.all([
      // Upcoming: bookings with a future start date and not cancelled/completed
      prisma.booking.count({
        where: {
          userId,
          startDate: { gt: now },
          status: { in: ['pending', 'pending_hold', 'confirmed'] }
        }
      }),
      // Total bookings for the user
      prisma.booking.count({ where: { userId } }),
      // Cancelled bookings
      prisma.booking.count({ where: { userId, status: 'cancelled' } }),
      // Number of promo rules (available coupons)
      prisma.priceRule.count({ where: { type: 'promo' } }),
      // Recent bookings list (latest 5)
      prisma.booking.findMany({
        where: { userId },
        include: {
          vehicle: {
            select: { id: true, make: true, model: true, year: true, imageUrl: true }
          },
          pickupLocation: { select: { id: true, name: true, city: true } },
          dropoffLocation: { select: { id: true, name: true, city: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    const recentOrders = recentBookings.map(b => ({
      orderId: b.id,
      carName: b.vehicle ? `${b.vehicle.make} ${b.vehicle.model}` : 'Unknown vehicle',
      pickUpLocation: b.pickupLocation ? (b.pickupLocation.city || b.pickupLocation.name) : null,
      dropOffLocation: b.dropoffLocation ? (b.dropoffLocation.city || b.dropoffLocation.name) : null,
      pickUpDate: b.startDate,
      returnDate: b.endDate,
      status: b.status
    }));

    res.json({
      success: true,
      data: {
        upcomingOrders: upcomingOrdersCount,
        coupons: couponsCount,
        totalOrders: totalOrdersCount,
        cancelledOrders: cancelledOrdersCount,
        recentOrders
      }
    });
  } catch (error) {
    console.error('Get user dashboard error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};



/**
 * Pickup checklist — store inspection info and mark booking active
 * POST /api/bookings/:id/pickup
 */
const pickupChecklist = async (req, res) => {
  try {
    const { id } = req.params;
    const { photos = [], fuelLevel = null, odometer = null, notes = '', userVerified = false, documentsChecked = false, signature = null, damageAcknowledged = false } = req.body;

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Only allow pickup when booking is ready for pickup
    if (booking.status !== 'ready_for_pickup') {
      return res.status(400).json({ success: false, message: 'Booking is not ready for pickup' });
    }

    // Save inspection data into the booking.addons JSON (legacy field) under pickupInspection
    const addons = booking.addons || {};
    addons.pickupInspection = { photos, fuelLevel, odometer, notes, userVerified, documentsChecked, signature, damageAcknowledged, at: new Date() };

    const updated = await prisma.booking.update({ where: { id }, data: { addons, status: 'active' } });

    // Update vehicle status to rented
    if (booking.vehicleId) {
      await prisma.vehicle.update({
        where: { id: booking.vehicleId },
        data: { status: 'rented' }
      });
    }

    await logEvent('booking', id, 'picked_up', { userId: req.user.id, photosCount: photos.length, fuelLevel, odometer, userVerified, documentsChecked });

    res.json({ success: true, message: 'Pickup recorded, booking is now active', data: { booking: updated } });
  } catch (error) {
    console.error('Pickup checklist error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Return checklist — store return inspection and close booking
 * POST /api/bookings/:id/return
 */
const returnChecklist = async (req, res) => {
  try {
    const { id } = req.params;
    const { photos = [], fuelLevel = null, odometer = null, damage = false, damageNotes = '', damageCost = 0 } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { vehicle: true, user: true, pickupLocation: true }
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (booking.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Booking is not active' });
    }

    const now = new Date();
    const endDate = new Date(booking.endDate);
    const startDate = new Date(booking.startDate);
    const rentalDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));

    // Calculate late fee
    let lateFee = 0;
    if (now > endDate) {
      const lateHours = Math.ceil((now - endDate) / (1000 * 60 * 60));
      const lateFeePerHour = booking.pickupLocation?.lateFeePerHour || 10; // default $10/hour
      lateFee = lateHours * lateFeePerHour;
    }

    // Calculate extra mileage
    let extraMileageCost = 0;
    const pickupOdometer = booking.addons?.pickupInspection?.odometer;
    if (pickupOdometer && odometer) {
      const expectedMiles = rentalDays * 100; // assume 100 miles/day
      const actualMiles = odometer - pickupOdometer;
      const extraMiles = Math.max(0, actualMiles - expectedMiles);
      const mileageRate = booking.pickupLocation?.extraMileageRate || 0.5; // $0.50/mile
      extraMileageCost = extraMiles * mileageRate;
    }

    // Calculate fuel top-up
    let fuelCost = 0;
    if (fuelLevel !== null && fuelLevel < 1.0) {
      const fuelNeeded = 1.0 - fuelLevel;
      const fuelPricePerGallon = booking.pickupLocation?.fuelPricePerGallon || 4.0; // $4/gallon
      fuelCost = fuelNeeded * fuelPricePerGallon;
    }

    // Damage cost
    const damageCostValue = damage ? parseFloat(damageCost) || 0 : 0;

    // Total adjustments
    const totalAdjustments = lateFee + extraMileageCost + fuelCost + damageCostValue;
    const finalTotal = booking.totalPrice + totalAdjustments;

    const addons = booking.addons || {};
    addons.returnInspection = {
      photos,
      fuelLevel,
      odometer,
      damage,
      damageNotes,
      damageCost: damageCostValue,
      calculations: {
        lateFee,
        extraMileageCost,
        fuelCost,
        totalAdjustments,
        finalTotal
      },
      at: now
    };

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        addons,
        status: 'completed',
        totalPrice: finalTotal
      }
    });

    // Update vehicle status
    let newVehicleStatus = 'available';
    if (damage) {
      newVehicleStatus = 'maintenance';
    }

    if (booking.vehicleId) {
      await prisma.vehicle.update({
        where: { id: booking.vehicleId },
        data: { status: newVehicleStatus }
      });
    }

    await logEvent('booking', id, 'returned', {
      userId: req.user.id,
      damage,
      odometer,
      totalAdjustments,
      finalTotal,
      vehicleStatus: newVehicleStatus
    });

    // Award loyalty points for completed booking
    try {
      const loyaltyResult = await LoyaltyService.awardPoints(
        booking.userId,
        finalTotal,
        'booking_completed'
      );
      console.log('Loyalty points awarded:', loyaltyResult);
    } catch (loyaltyError) {
      console.warn('Failed to award loyalty points:', loyaltyError);
      // Non-critical error, continue
    }

    // Send receipt
    try {
      await notificationService.sendReturnReceipt(booking.user.email, updated, {
        lateFee,
        extraMileageCost,
        fuelCost,
        damageCost: damageCostValue,
        totalAdjustments
      });
    } catch (e) {
      console.warn('Failed to send return receipt', e);
    }

    // Send follow-up for review
    try {
      await notificationService.sendReviewRequest(booking.user.email, booking);
    } catch (e) {
      console.warn('Failed to send review request', e);
    }

    res.json({
      success: true,
      message: 'Return recorded, booking completed',
      data: {
        booking: updated,
        adjustments: {
          lateFee,
          extraMileageCost,
          fuelCost,
          damageCost: damageCostValue,
          totalAdjustments,
          finalTotal
        }
      }
    });
  } catch (error) {
    console.error('Return checklist error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Prepare booking for pickup (Admin only)
 * POST /api/bookings/:id/prepare
 */
const prepareBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { cleaned = false, fueled = false, inspected = false, maintenanceDone = false, conditionImages = [], notes = '' } = req.body;

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.status !== 'confirmed' && booking.status !== 'reserved') {
      return res.status(400).json({ success: false, message: 'Booking is not in a state that can be prepared' });
    }

    const addons = booking.addons || {};
    addons.preparation = { cleaned, fueled, inspected, maintenanceDone, conditionImages, notes, at: new Date() };

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        addons,
        status: 'ready_for_pickup'
      }
    });

    // Update vehicle status if all preparation is done
    if (booking.vehicleId && cleaned && fueled && inspected) {
      await prisma.vehicle.update({
        where: { id: booking.vehicleId },
        data: { status: 'available' } // Ready for pickup, but vehicle is still reserved for this booking
      });
    }

    await logEvent('booking', id, 'prepared', { userId: req.user.id, preparation: { cleaned, fueled, inspected, maintenanceDone } });

    // Send notification to user that vehicle is ready for pickup
    try {
      const user = await prisma.user.findUnique({ where: { id: booking.userId } });
      if (user) {
        await notificationService.sendBookingReminder(user.email, booking);
        // Also send check-in reminder
        await notificationService.sendCheckinReminder(user.email, booking);
      }
    } catch (e) {
      console.warn('Failed to send pickup ready notification', e);
    }

    res.json({ success: true, message: 'Booking prepared for pickup', data: { booking: updatedBooking } });
  } catch (error) {
    console.error('Prepare booking error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Extend booking (During Rental Period)
 * POST /api/bookings/:id/extend
 */
const extendBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { newEndDate, additionalDays } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { vehicle: true, user: true }
    });

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (booking.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Booking is not active' });
    }

    const currentEnd = new Date(booking.endDate);
    let newEnd;

    if (newEndDate) {
      newEnd = new Date(newEndDate);
    } else if (additionalDays) {
      newEnd = new Date(currentEnd.getTime() + additionalDays * 24 * 60 * 60 * 1000);
    } else {
      return res.status(400).json({ success: false, message: 'newEndDate or additionalDays required' });
    }

    if (newEnd <= currentEnd) {
      return res.status(400).json({ success: false, message: 'New end date must be after current end date' });
    }

    // Check availability for extension
    const conflictingBookings = await prisma.booking.findMany({
      where: {
        vehicleId: booking.vehicleId,
        status: { in: ['confirmed', 'active', 'ready_for_pickup'] },
        OR: [
          {
            startDate: { lte: newEnd },
            endDate: { gte: currentEnd }
          }
        ]
      }
    });

    if (conflictingBookings.length > 1) { // >1 because current booking is included
      return res.status(409).json({ success: false, message: 'Vehicle not available for extension' });
    }

    // Calculate additional price
    const additionalDaysCount = Math.ceil((newEnd - currentEnd) / (1000 * 60 * 60 * 24));
    const additionalPrice = booking.vehicle.dailyRate * additionalDaysCount;

    // Update booking
    const updated = await prisma.booking.update({
      where: { id },
      data: {
        endDate: newEnd,
        totalPrice: booking.totalPrice + additionalPrice
      }
    });

    await logEvent('booking', id, 'extended', { userId: req.user.id, oldEndDate: booking.endDate, newEndDate: newEnd, additionalPrice });

    // Send notification
    try {
      await notificationService.sendBookingConfirmation(booking.user.email, updated);
    } catch (e) {
      console.warn('Failed to send extension confirmation', e);
    }

    res.json({ success: true, message: 'Booking extended successfully', data: { booking: updated, additionalPrice } });
  } catch (error) {
    console.error('Extend booking error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Update booking location (for tracking during rental)
 * POST /api/bookings/:id/location
 */
const updateBookingLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude, timestamp, speed, fuelLevel } = req.body;

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (booking.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Booking is not active' });
    }

    const addons = booking.addons || {};
    if (!addons.locationUpdates) addons.locationUpdates = [];
    addons.locationUpdates.push({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      speed: speed ? parseFloat(speed) : null,
      fuelLevel: fuelLevel ? parseFloat(fuelLevel) : null
    });

    const updated = await prisma.booking.update({ where: { id }, data: { addons } });

    // Check for alerts
    let alerts = [];
    if (fuelLevel && fuelLevel < 0.1) alerts.push('Low fuel');
    if (speed && speed > 120) alerts.push('Speeding'); // assuming km/h

    // Check approaching drop-off
    const now = new Date();
    const endDate = new Date(booking.endDate);
    const hoursToEnd = (endDate - now) / (1000 * 60 * 60);
    if (hoursToEnd <= 1 && hoursToEnd > 0) {
      alerts.push('Approaching drop-off time');
    }

    // Basic geofencing: assume no cross-border, but for demo, if latitude > 50 or < 25, alert (US approx)
    if (latitude && (latitude > 50 || latitude < 25)) {
      alerts.push('Outside allowed area');
    }

    // Calculate rental stats
    const startDate = new Date(booking.startDate);
    const elapsedHours = (now - startDate) / (1000 * 60 * 60);
    const remainingHours = Math.max(0, (endDate - now) / (1000 * 60 * 60));
    const estimatedRemainingCost = (remainingHours / 24) * booking.vehicle.dailyRate;

    const stats = {
      elapsedHours: Math.round(elapsedHours * 100) / 100,
      remainingHours: Math.round(remainingHours * 100) / 100,
      estimatedRemainingCost: Math.round(estimatedRemainingCost * 100) / 100,
      currentMileage: odometer || booking.addons?.pickupInspection?.odometer || 0
    };

    // Fuel stop suggestions if low fuel
    let fuelStopSuggestions = [];
    if (fuelLevel && fuelLevel < 0.2) {
      // Simulate nearby fuel stops
      fuelStopSuggestions = [
        { name: 'Shell Station', distance: '2 miles', address: '123 Main St' },
        { name: 'BP Gas', distance: '3.5 miles', address: '456 Oak Ave' }
      ];
    }

    if (alerts.length > 0) {
      // Send notification
      try {
        await notificationService.sendBookingAlert(booking.user.email, booking, alerts);
      } catch (e) {
        console.warn('Failed to send alert', e);
      }
    }

    res.json({
      success: true,
      message: 'Location updated',
      data: {
        alerts,
        stats,
        fuelStopSuggestions
      }
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get admin metrics (Post-Rental Analytics)
 * GET /api/bookings/admin/metrics
 */
const getAdminMetrics = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Total revenue last 30 days
    const revenueResult = await prisma.booking.aggregate({
      where: {
        status: 'completed',
        updatedAt: { gte: thirtyDaysAgo }
      },
      _sum: { totalPrice: true }
    });
    const totalRevenue = revenueResult._sum.totalPrice || 0;

    // Vehicle utilization: average booked days / total vehicle days
    const vehicles = await prisma.vehicle.findMany();
    let totalBookedDays = 0;
    let totalVehicleDays = vehicles.length * 30; // 30 days

    for (const vehicle of vehicles) {
      const bookings = await prisma.booking.findMany({
        where: {
          vehicleId: vehicle.id,
          status: { in: ['active', 'completed'] },
          startDate: { lte: now },
          endDate: { gte: thirtyDaysAgo }
        }
      });
      for (const booking of bookings) {
        const start = new Date(Math.max(booking.startDate, thirtyDaysAgo));
        const end = new Date(Math.min(booking.endDate, now));
        const days = Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
        totalBookedDays += days;
      }
    }
    const utilizationRate = totalVehicleDays > 0 ? (totalBookedDays / totalVehicleDays) * 100 : 0;

    // Upcoming bookings
    const upcomingBookings = await prisma.booking.count({
      where: {
        startDate: { gte: now, lte: thirtyDaysFromNow },
        status: { in: ['confirmed', 'ready_for_pickup'] }
      }
    });

    // Vehicles under maintenance
    const maintenanceVehicles = await prisma.vehicle.count({
      where: { status: 'maintenance' }
    });

    // Recent completed bookings
    const recentCompleted = await prisma.booking.count({
      where: {
        status: 'completed',
        updatedAt: { gte: thirtyDaysAgo }
      }
    });

    res.json({
      success: true,
      data: {
        totalRevenue,
        utilizationRate: Math.round(utilizationRate * 100) / 100,
        upcomingBookings,
        maintenanceVehicles,
        recentCompletedBookings: recentCompleted,
        period: 'last 30 days'
      }
    });
  } catch (error) {
    console.error('Get admin metrics error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Report vehicle breakdown or accident (during rental)
 * POST /api/bookings/:id/incident
 */
const reportIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, description, location, photos = [], contactInfo, severity = 'minor', replacementNeeded = false } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { vehicle: true, user: true }
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (booking.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Booking is not active' });
    }

    const addons = booking.addons || {};
    if (!addons.incidents) addons.incidents = [];
    addons.incidents.push({
      type, // 'breakdown' or 'accident'
      description,
      location,
      photos,
      contactInfo,
      severity,
      replacementNeeded,
      reportedAt: new Date(),
      status: 'reported'
    });

    const updated = await prisma.booking.update({ where: { id }, data: { addons } });

    // Update vehicle status to maintenance if severe
    if (severity === 'major' || type === 'accident') {
      await prisma.vehicle.update({
        where: { id: booking.vehicleId },
        data: { status: 'maintenance' }
      });
    }

    await logEvent('booking', id, 'incident_reported', { userId: req.user.id, type, severity });

    // Send notification to admin/support
    try {
      // Assume admin email or send to support
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@carhive.com';
      await notificationService.sendIncidentReport(adminEmail, booking, { type, description, location, severity });
    } catch (e) {
      console.warn('Failed to send incident report', e);
    }

    // If replacement needed, note it
    let replacementBooking = null;
    if (replacementNeeded) {
      // For now, just flag; in real system, create replacement booking
      addons.replacementRequested = true;
      await prisma.booking.update({ where: { id }, data: { addons } });
    }

    res.json({ success: true, message: 'Incident reported successfully', data: { booking: updated } });
  } catch (error) {
    console.error('Report incident error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Online check-in (upload documents, generate agreement)
 * POST /api/bookings/:id/checkin
 */
const onlineCheckin = async (req, res) => {
  try {
    const { id } = req.params;
    const { documents = [], agreementSigned = false, notes = '' } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { vehicle: true, user: true, pickupLocation: true, dropoffLocation: true }
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (booking.status !== 'confirmed' && booking.status !== 'ready_for_pickup') {
      return res.status(400).json({ success: false, message: 'Booking is not eligible for check-in' });
    }

    const addons = booking.addons || {};
    addons.checkin = {
      documents, // array of uploaded document URLs or data
      agreementSigned,
      notes,
      checkedInAt: new Date()
    };

    // Generate QR code for pickup (simulate)
    const qrCode = `QR-${booking.id}-${Date.now()}`;

    addons.checkin.qrCode = qrCode;

    const updated = await prisma.booking.update({
      where: { id },
      data: { addons, status: 'checked_in' }
    });

    await logEvent('booking', id, 'checked_in', { userId: req.user.id });

    // Send digital agreement
    try {
      await notificationService.sendDigitalAgreement(booking.user.email, updated, qrCode);
    } catch (e) {
      console.warn('Failed to send digital agreement', e);
    }

    res.json({ success: true, message: 'Check-in completed successfully', data: { booking: updated, qrCode } });
  } catch (error) {
    console.error('Online check-in error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Contactless pickup (QR scan, self-inspection)
 * POST /api/bookings/:id/contactless-pickup
 */
const contactlessPickup = async (req, res) => {
  try {
    const { id } = req.params;
    const { qrCode, photos = [], fuelLevel = null, odometer = null, notes = '' } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { vehicle: true, user: true }
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Verify QR code
    const expectedQr = booking.addons?.checkin?.qrCode;
    if (!expectedQr || qrCode !== expectedQr) {
      return res.status(400).json({ success: false, message: 'Invalid QR code' });
    }

    if (booking.status !== 'checked_in' && booking.status !== 'ready_for_pickup') {
      return res.status(400).json({ success: false, message: 'Booking not ready for pickup' });
    }

    // Simulate IoT unlock
    const unlockSuccess = true; // In real system, call IoT API

    if (!unlockSuccess) {
      return res.status(500).json({ success: false, message: 'Failed to unlock vehicle' });
    }

    // Store self-inspection data
    const addons = booking.addons || {};
    addons.contactlessPickup = {
      photos,
      fuelLevel,
      odometer,
      notes,
      unlockedAt: new Date(),
      selfInspected: true
    };

    const updated = await prisma.booking.update({
      where: { id },
      data: { addons, status: 'active' }
    });

    // Update vehicle status to rented
    if (booking.vehicleId) {
      await prisma.vehicle.update({
        where: { id: booking.vehicleId },
        data: { status: 'rented' }
      });
    }

    await logEvent('booking', id, 'contactless_picked_up', { userId: req.user.id, photosCount: photos.length });

    res.json({
      success: true,
      message: 'Contactless pickup completed, vehicle unlocked',
      data: {
        booking: updated,
        vehicleUnlocked: true,
        fuelLevel,
        odometer
      }
    });
  } catch (error) {
    console.error('Contactless pickup error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Modify Booking
 * PUT /api/bookings/:id/modify
 */
const modifyBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, locationPickupId, locationDropoffId } = req.body;

    // Find booking
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { vehicle: true, user: true }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Check permissions
    if (booking.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Check if booking can be modified
    const modifiableStatuses = ['pending', 'confirmed', 'pending_hold'];
    if (!modifiableStatuses.includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Booking cannot be modified at this stage'
      });
    }

    // Validate dates if provided
    let updateData = {};
    if (startDate || endDate) {
      const newStartDate = startDate ? new Date(startDate) : booking.startDate;
      const newEndDate = endDate ? new Date(endDate) : booking.endDate;

      if (newStartDate >= newEndDate) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date'
        });
      }

      if (newStartDate < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Start date cannot be in the past'
        });
      }

      updateData.startDate = newStartDate;
      updateData.endDate = newEndDate;

      // Recalculate pricing
      const days = Math.ceil((newEndDate - newStartDate) / (1000 * 60 * 60 * 24));
      const dailyRate = booking.vehicle.dailyRate;
      const subtotal = days * dailyRate;
      const taxes = subtotal * 0.09; // 9% tax
      const fees = 5.00; // Base fee
      const totalPrice = subtotal + taxes + fees;

      updateData.subtotal = subtotal;
      updateData.taxes = taxes;
      updateData.fees = fees;
      updateData.totalPrice = totalPrice;
    }

    // Validate locations if provided
    if (locationPickupId) {
      const pickupLocation = await prisma.location.findUnique({
        where: { id: locationPickupId }
      });
      if (!pickupLocation) {
        return res.status(400).json({
          success: false,
          message: 'Invalid pickup location'
        });
      }
      updateData.locationPickupId = locationPickupId;
    }

    if (locationDropoffId) {
      const dropoffLocation = await prisma.location.findUnique({
        where: { id: locationDropoffId }
      });
      if (!dropoffLocation) {
        return res.status(400).json({
          success: false,
          message: 'Invalid dropoff location'
        });
      }
      updateData.locationDropoffId = locationDropoffId;
    }

    // Update booking
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: updateData,
      include: {
        vehicle: true,
        pickupLocation: true,
        dropoffLocation: true
      }
    });

    // Log the modification
    await logEvent('booking', id, 'modified', {
      userId: req.user.id,
      changes: updateData
    });

    res.json({
      success: true,
      message: 'Booking modified successfully',
      data: updatedBooking
    });

  } catch (error) {
    console.error('Modify booking error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Roadside Assistance / SOS
 * POST /api/bookings/:id/sos
 */
const requestSOS = async (req, res) => {
  try {
    const { id } = req.params;
    const { note = '', location = null } = req.body;
    const booking = await prisma.booking.findUnique({ where: { id }, include: { user: true, vehicle: true } });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Access denied' });
    if (booking.status !== 'active') return res.status(400).json({ success: false, message: 'SOS only available during active rental' });
    const addons = booking.addons || {};
    if (!addons.sosRequests) addons.sosRequests = [];
    addons.sosRequests.push({ at: new Date(), note, location, status: 'dispatched' });
    await prisma.booking.update({ where: { id }, data: { addons } });

    // Send multi-channel notification
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'support@carhive.com';
      const adminPhone = process.env.ADMIN_PHONE; // E.164 format: +15555555555

      // Email notification
      if (notificationService.sendSOSAlert) {
        await notificationService.sendSOSAlert(adminEmail, booking, { note, location });
      }

      // SMS notification via integration service
      if (adminPhone) {
        const IntegrationService = require('../services/integrationService');
        await IntegrationService.sendSOSAlertSMS(adminPhone, booking, location);
      }
    } catch (e) { console.warn('SOS notify failed', e); }

    await logEvent('booking', id, 'sos_requested', { userId: req.user.id, note });
    res.json({ success: true, message: 'SOS request received. Assistance dispatched.' });
  } catch (error) {
    console.error('SOS request error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Final exports
module.exports = {
  createBooking,
  getUserBookings,
  getUserDashboard,
  getBookingById,
  updateBookingStatus,
  cancelBooking,
  getAllBookings,
  holdBooking,
  confirmBooking,
  modifyBooking,
  pickupChecklist,
  returnChecklist,
  prepareBooking,
  extendBooking,
  updateBookingLocation,
  getAdminMetrics,
  reportIncident,
  onlineCheckin,
  contactlessPickup,
  requestSOS,
};