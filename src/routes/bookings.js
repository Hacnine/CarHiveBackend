const express = require('express');
const {
  createBooking,
  getUserBookings,
  getBookingById,
  updateBookingStatus,
  cancelBooking,
  getAllBookings,
  holdBooking,
  confirmBooking
} = require('../controllers/bookingController');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

// User routes (require authentication)
router.post('/', authenticate, createBooking);
// Create a short hold (reserve vehicle for a short time)
router.post('/hold', authenticate, holdBooking);
// Confirm a held booking (capture payment)
router.post('/confirm', authenticate, confirmBooking);
router.get('/', authenticate, getUserBookings);
router.put('/:id/cancel', authenticate, cancelBooking);

// Admin routes (place before parameterized routes to avoid conflict)
router.get('/admin/all', authenticate, authorize('admin'), getAllBookings);
router.put('/:id/status', authenticate, authorize('admin'), updateBookingStatus);

// Parameterized route: must come after admin routes
router.get('/:id', authenticate, getBookingById);

module.exports = router;