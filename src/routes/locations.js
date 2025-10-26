const express = require('express');
const {
  getLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation
} = require('../controllers/locationController');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

// Public routes
router.get('/', getLocations);
router.get('/:id', getLocationById);

// Admin routes
router.post('/', authenticate, authorize('admin'), createLocation);
router.put('/:id', authenticate, authorize('admin'), updateLocation);
router.delete('/:id', authenticate, authorize('admin'), deleteLocation);

module.exports = router;