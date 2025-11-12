const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const IntegrationService = require('../services/integrationService');

/**
 * Update GPS location for active rental
 * POST /api/tracking/:bookingId/location
 */
const updateGPSLocation = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { lat, lng, speed, heading, accuracy, timestamp } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { user: true, vehicle: true }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Verify user owns this booking
    if (booking.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Only track active rentals
    if (booking.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Booking not active' });
    }

    // Store GPS data in addons
    const addons = booking.addons || {};
    if (!addons.tracking) {
      addons.tracking = {
        enabled: true,
        locations: [],
        totalDistance: 0,
        alerts: []
      };
    }

    const newLocation = {
      lat,
      lng,
      speed: speed || 0,
      heading: heading || 0,
      accuracy: accuracy || 0,
      timestamp: timestamp || new Date().toISOString()
    };

    // Calculate distance if previous location exists
    if (addons.tracking.locations.length > 0) {
      const lastLoc = addons.tracking.locations[addons.tracking.locations.length - 1];
      const distance = IntegrationService.calculateDistance(
        lastLoc.lat,
        lastLoc.lng,
        lat,
        lng
      );
      addons.tracking.totalDistance += distance;
    }

    // Keep only last 100 location points to avoid data bloat
    addons.tracking.locations.push(newLocation);
    if (addons.tracking.locations.length > 100) {
      addons.tracking.locations.shift();
    }

    // Check for alerts
    const alerts = [];
    
    // Speed alert
    if (speed > 120) {
      alerts.push({
        type: 'speeding',
        message: `Speed ${speed} km/h exceeds limit`,
        timestamp: new Date().toISOString()
      });
    }

    // Geofence alert (example: check if outside allowed radius)
    // You can add geofencing logic here

    if (alerts.length > 0) {
      addons.tracking.alerts.push(...alerts);
    }

    // Update booking
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { addons }
    });

    res.json({
      success: true,
      message: 'Location updated',
      data: {
        totalDistance: addons.tracking.totalDistance.toFixed(2),
        alerts: alerts.length > 0 ? alerts : undefined
      }
    });
  } catch (error) {
    console.error('Update GPS location error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get tracking data for active rental
 * GET /api/tracking/:bookingId
 */
const getTrackingData = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vehicle: {
          select: { make: true, model: true, year: true, licensePlate: true }
        },
        pickupLocation: true,
        dropoffLocation: true
      }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const addons = booking.addons || {};
    const tracking = addons.tracking || {
      enabled: false,
      locations: [],
      totalDistance: 0,
      alerts: []
    };

    // Calculate rental stats
    const now = new Date();
    const startDate = new Date(booking.startDate);
    const endDate = new Date(booking.endDate);
    
    const elapsedHours = Math.max(0, (now - startDate) / (1000 * 60 * 60));
    const totalHours = (endDate - startDate) / (1000 * 60 * 60);
    const remainingHours = Math.max(0, (endDate - now) / (1000 * 60 * 60));

    // Estimate remaining cost based on distance and time
    const baseRate = booking.totalPrice / totalHours;
    const estimatedCost = elapsedHours * baseRate;

    res.json({
      success: true,
      data: {
        booking: {
          id: booking.id,
          startDate: booking.startDate,
          endDate: booking.endDate,
          status: booking.status
        },
        vehicle: booking.vehicle,
        tracking: {
          ...tracking,
          currentLocation: tracking.locations.length > 0 
            ? tracking.locations[tracking.locations.length - 1]
            : null
        },
        stats: {
          elapsedHours: elapsedHours.toFixed(1),
          remainingHours: remainingHours.toFixed(1),
          totalDistance: tracking.totalDistance.toFixed(2),
          estimatedCost: estimatedCost.toFixed(2),
          progress: ((elapsedHours / totalHours) * 100).toFixed(1)
        },
        pickupLocation: booking.pickupLocation,
        dropoffLocation: booking.dropoffLocation
      }
    });
  } catch (error) {
    console.error('Get tracking data error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get route suggestions to dropoff location
 * GET /api/tracking/:bookingId/route
 */
const getRouteSuggestion = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { dropoffLocation: true }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const tracking = booking.addons?.tracking;
    if (!tracking || tracking.locations.length === 0) {
      return res.status(400).json({ success: false, message: 'No GPS data available' });
    }

    const currentLocation = tracking.locations[tracking.locations.length - 1];
    const destination = booking.dropoffLocation;

    if (!destination) {
      return res.status(400).json({ success: false, message: 'Dropoff location not set' });
    }

    // Get directions using integration service
    const directions = await IntegrationService.getDirections(
      { lat: currentLocation.lat, lng: currentLocation.lng },
      destination.address || `${destination.city}, ${destination.state}`
    );

    if (!directions.success) {
      return res.status(500).json({ success: false, message: 'Failed to get directions' });
    }

    res.json({
      success: true,
      data: {
        currentLocation,
        destination: {
          name: destination.name,
          address: destination.address,
          city: destination.city
        },
        directions
      }
    });
  } catch (error) {
    console.error('Get route suggestion error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Toggle GPS tracking for booking
 * POST /api/tracking/:bookingId/toggle
 */
const toggleTracking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { enabled } = req.body;

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const addons = booking.addons || {};
    if (!addons.tracking) {
      addons.tracking = {
        enabled: false,
        locations: [],
        totalDistance: 0,
        alerts: []
      };
    }

    addons.tracking.enabled = enabled;

    await prisma.booking.update({
      where: { id: bookingId },
      data: { addons }
    });

    res.json({
      success: true,
      message: `Tracking ${enabled ? 'enabled' : 'disabled'}`,
      data: { enabled }
    });
  } catch (error) {
    console.error('Toggle tracking error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  updateGPSLocation,
  getTrackingData,
  getRouteSuggestion,
  toggleTracking
};
