const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const trackingController = require('../controllers/trackingController');

// All routes require authentication
router.use(authenticate);

// POST /api/tracking/:bookingId/location - Update GPS location
router.post('/:bookingId/location', trackingController.updateGPSLocation);

// GET /api/tracking/:bookingId - Get tracking data and stats
router.get('/:bookingId', trackingController.getTrackingData);

// GET /api/tracking/:bookingId/route - Get route suggestions
router.get('/:bookingId/route', trackingController.getRouteSuggestion);

// POST /api/tracking/:bookingId/toggle - Enable/disable tracking
router.post('/:bookingId/toggle', trackingController.toggleTracking);

module.exports = router;
