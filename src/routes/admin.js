const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');
const adminController = require('../controllers/adminController');

// All routes require admin authorization
router.use(authenticate);
router.use(authorize('admin'));

// GET /api/admin/overview - Dashboard metrics
router.get('/overview', adminController.getOverviewMetrics);

// GET /api/admin/calendar - Booking calendar data
router.get('/calendar', adminController.getBookingCalendar);

// POST /api/admin/bookings/bulk-action - Bulk approve/reject/cancel
router.post('/bookings/bulk-action', adminController.bulkBookingAction);

// GET /api/admin/export/bookings - Export bookings to CSV
router.get('/export/bookings', adminController.exportBookings);

module.exports = router;
