const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get admin dashboard overview metrics
 * GET /api/admin/overview
 */
const getOverviewMetrics = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Parallel queries for performance
    const [
      totalVehicles,
      availableVehicles,
      totalBookings,
      activeBookings,
      monthlyBookings,
      lastMonthBookings,
      monthlyRevenue,
      lastMonthRevenue,
      pendingVerifications,
      recentBookings,
      topVehicles,
      locationStats
    ] = await Promise.all([
      // Vehicle metrics
      prisma.vehicle.count(),
      prisma.vehicle.count({ where: { status: 'available' } }),

      // Booking counts
      prisma.booking.count(),
      prisma.booking.count({ where: { status: 'active' } }),
      prisma.booking.count({
        where: {
          createdAt: { gte: startOfMonth }
        }
      }),
      prisma.booking.count({
        where: {
          createdAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth
          }
        }
      }),

      // Revenue calculations
      prisma.booking.aggregate({
        where: {
          status: { in: ['completed', 'active', 'confirmed'] },
          createdAt: { gte: startOfMonth }
        },
        _sum: { totalPrice: true }
      }),
      prisma.booking.aggregate({
        where: {
          status: { in: ['completed', 'active', 'confirmed'] },
          createdAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth
          }
        },
        _sum: { totalPrice: true }
      }),

      // Pending verifications
      prisma.booking.count({
        where: {
          status: 'pending',
          verificationStatus: { not: 'approved' }
        }
      }),

      // Recent bookings for timeline
      prisma.booking.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          },
          vehicle: {
            select: { id: true, make: true, model: true, year: true }
          },
          pickupLocation: {
            select: { name: true, city: true }
          }
        }
      }),

      // Top performing vehicles
      prisma.booking.groupBy({
        by: ['vehicleId'],
        where: {
          status: { in: ['completed', 'active'] },
          createdAt: { gte: startOfMonth }
        },
        _count: { id: true },
        _sum: { totalPrice: true },
        orderBy: {
          _count: { id: 'desc' }
        },
        take: 5
      }),

      // Location statistics
      prisma.booking.groupBy({
        by: ['locationPickupId'],
        where: {
          createdAt: { gte: startOfMonth }
        },
        _count: { id: true },
        orderBy: {
          _count: { id: 'desc' }
        },
        take: 5
      })
    ]);

    // Enrich top vehicles with details
    const topVehiclesWithDetails = await Promise.all(
      topVehicles.map(async (v) => {
        const vehicle = await prisma.vehicle.findUnique({
          where: { id: v.vehicleId },
          select: { id: true, make: true, model: true, year: true, imageUrl: true }
        });
        return {
          ...vehicle,
          bookingCount: v._count.id,
          revenue: v._sum.totalPrice || 0
        };
      })
    );

    // Enrich location stats
    const locationStatsWithDetails = await Promise.all(
      locationStats.map(async (loc) => {
        const location = await prisma.location.findUnique({
          where: { id: loc.locationPickupId },
          select: { id: true, name: true, city: true }
        });
        return {
          ...location,
          bookingCount: loc._count.id
        };
      })
    );

    // Calculate growth percentages
    const bookingGrowth = lastMonthBookings > 0
      ? ((monthlyBookings - lastMonthBookings) / lastMonthBookings) * 100
      : 0;

    const revenueGrowth = (lastMonthRevenue._sum.totalPrice || 0) > 0
      ? ((((monthlyRevenue._sum.totalPrice || 0) - (lastMonthRevenue._sum.totalPrice || 0)) / (lastMonthRevenue._sum.totalPrice || 0)) * 100)
      : 0;

    // Fleet utilization rate
    const utilizationRate = totalVehicles > 0
      ? ((totalVehicles - availableVehicles) / totalVehicles) * 100
      : 0;

    res.json({
      success: true,
      data: {
        metrics: {
          totalVehicles,
          availableVehicles,
          utilizationRate: utilizationRate.toFixed(1),
          totalBookings,
          activeBookings,
          monthlyBookings,
          bookingGrowth: bookingGrowth.toFixed(1),
          monthlyRevenue: monthlyRevenue._sum.totalPrice || 0,
          revenueGrowth: revenueGrowth.toFixed(1),
          pendingVerifications
        },
        recentBookings: recentBookings.map(b => ({
          id: b.id,
          user: b.user,
          vehicle: b.vehicle ? `${b.vehicle.make} ${b.vehicle.model}` : 'N/A',
          location: b.pickupLocation ? b.pickupLocation.city : 'N/A',
          startDate: b.startDate,
          endDate: b.endDate,
          status: b.status,
          totalPrice: b.totalPrice,
          createdAt: b.createdAt
        })),
        topVehicles: topVehiclesWithDetails,
        topLocations: locationStatsWithDetails
      }
    });
  } catch (error) {
    console.error('Get overview metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get booking calendar data for admin dashboard
 * GET /api/admin/calendar
 */
const getBookingCalendar = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate && endDate) {
      where.OR = [
        {
          startDate: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        },
        {
          endDate: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        }
      ];
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true }
        },
        vehicle: {
          select: { make: true, model: true, licensePlate: true }
        },
        pickupLocation: {
          select: { name: true }
        }
      },
      orderBy: { startDate: 'asc' }
    });

    const calendarEvents = bookings.map(b => ({
      id: b.id,
      title: b.vehicle ? `${b.vehicle.make} ${b.vehicle.model}` : 'Vehicle',
      start: b.startDate,
      end: b.endDate,
      status: b.status,
      user: b.user?.name,
      location: b.pickupLocation?.name,
      totalPrice: b.totalPrice,
      backgroundColor: getStatusColor(b.status)
    }));

    res.json({
      success: true,
      data: calendarEvents
    });
  } catch (error) {
    console.error('Get booking calendar error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Bulk approve/reject bookings
 * POST /api/admin/bookings/bulk-action
 */
const bulkBookingAction = async (req, res) => {
  try {
    const { bookingIds, action } = req.body;

    if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'bookingIds array is required'
      });
    }

    if (!['approve', 'reject', 'cancel'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be approve, reject, or cancel'
      });
    }

    const statusMap = {
      approve: 'confirmed',
      reject: 'cancelled',
      cancel: 'cancelled'
    };

    const newStatus = statusMap[action];

    const result = await prisma.booking.updateMany({
      where: {
        id: { in: bookingIds }
      },
      data: {
        status: newStatus,
        verificationStatus: action === 'approve' ? 'approved' : 'rejected'
      }
    });

    res.json({
      success: true,
      message: `${result.count} bookings ${action}d successfully`,
      data: { count: result.count }
    });
  } catch (error) {
    console.error('Bulk booking action error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Export bookings data to CSV format
 * GET /api/admin/export/bookings
 */
const exportBookings = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;

    const where = {};
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    if (status) {
      where.status = status;
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true, phone: true }
        },
        vehicle: {
          select: { make: true, model: true, year: true, licensePlate: true }
        },
        pickupLocation: {
          select: { name: true, city: true }
        },
        dropoffLocation: {
          select: { name: true, city: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Generate CSV
    const headers = [
      'Booking ID',
      'User Name',
      'User Email',
      'User Phone',
      'Vehicle',
      'License Plate',
      'Pickup Location',
      'Dropoff Location',
      'Start Date',
      'End Date',
      'Status',
      'Total Price',
      'Created At'
    ];

    const rows = bookings.map(b => [
      b.id,
      b.user?.name || '',
      b.user?.email || '',
      b.user?.phone || '',
      b.vehicle ? `${b.vehicle.make} ${b.vehicle.model} ${b.vehicle.year}` : '',
      b.vehicle?.licensePlate || '',
      b.pickupLocation ? `${b.pickupLocation.name}, ${b.pickupLocation.city}` : '',
      b.dropoffLocation ? `${b.dropoffLocation.name}, ${b.dropoffLocation.city}` : '',
      b.startDate?.toISOString() || '',
      b.endDate?.toISOString() || '',
      b.status,
      b.totalPrice,
      b.createdAt?.toISOString() || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="bookings-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Helper function for status colors
function getStatusColor(status) {
  const colors = {
    pending: '#FFA500',
    confirmed: '#00AA00',
    active: '#0066FF',
    completed: '#808080',
    cancelled: '#FF0000'
  };
  return colors[status] || '#CCCCCC';
}

module.exports = {
  getOverviewMetrics,
  getBookingCalendar,
  bulkBookingAction,
  exportBookings
};
