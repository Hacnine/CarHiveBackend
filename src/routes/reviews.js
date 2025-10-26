const express = require('express');
const {
  createReview,
  getVehicleReviews,
  getUserReviews,
  updateReview,
  deleteReview,
  getAllReviews
} = require('../controllers/reviewController');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

// Public routes
router.get('/vehicle/:vehicleId', getVehicleReviews);

// User routes (require authentication)
router.post('/', authenticate, createReview);
router.get('/user', authenticate, getUserReviews);
router.put('/:id', authenticate, updateReview);
router.delete('/:id', authenticate, deleteReview);

// Admin routes
router.get('/admin/all', authenticate, authorize('admin'), getAllReviews);

module.exports = router;