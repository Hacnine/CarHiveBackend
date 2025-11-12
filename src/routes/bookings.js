const express = require('express');
const {
  createBooking,
  getUserBookings,
  getUserDashboard,
  getBookingById,
  updateBookingStatus,
  cancelBooking,
  getAllBookings,
  holdBooking,
  confirmBooking,
  pickupChecklist,
  returnChecklist,
  prepareBooking,
  extendBooking,
  updateBookingLocation,
  getAdminMetrics,
  reportIncident,
  onlineCheckin,
  contactlessPickup,
  modifyBooking,
  requestSOS
} = require('../controllers/bookingController');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

// User routes (require authentication)
router.post('/', authenticate, createBooking);
// Create a short hold (reserve vehicle for a short time)
router.post('/hold', authenticate, holdBooking);
// Confirm a held booking (capture payment)
router.post('/confirm', authenticate, confirmBooking);
// Mark pickup checklist / start rental
router.post('/:id/pickup', authenticate, pickupChecklist);
// Mark return checklist / complete rental
router.post('/:id/return', authenticate, returnChecklist);
router.get('/', authenticate, getUserBookings);
// User dashboard summary
router.get('/dashboard', authenticate, getUserDashboard);
// Modify booking (dates/locations)
router.put('/:id/modify', authenticate, modifyBooking);
router.put('/:id/cancel', authenticate, cancelBooking);
// Update booking location for tracking
router.post('/:id/location', authenticate, updateBookingLocation);
// Report incident during rental
router.post('/:id/incident', authenticate, reportIncident);
// Roadside assistance SOS
router.post('/:id/sos', authenticate, requestSOS);
// Online check-in
router.post('/:id/checkin', authenticate, onlineCheckin);
// Contactless pickup
router.post('/:id/contactless-pickup', authenticate, contactlessPickup);

// Admin routes (place before parameterized routes to avoid conflict)
router.get('/admin/all', authenticate, authorize('admin'), getAllBookings);
router.get('/admin/metrics', authenticate, authorize('admin'), getAdminMetrics);
router.put('/:id/status', authenticate, authorize('admin'), updateBookingStatus);
router.post('/:id/prepare', authenticate, authorize('admin'), prepareBooking);
router.post('/:id/extend', authenticate, extendBooking);

// Parameterized route: must come after admin routes
router.get('/:id', authenticate, getBookingById);

module.exports = router;