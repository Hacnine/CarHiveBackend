const express = require('express');
const {
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle
} = require('../controllers/vehicleController');
const { authenticate, authorize, optionalAuth } = require('../middlewares/auth');

const router = express.Router();

// Public routes
router.get('/', optionalAuth, getVehicles);
router.get('/:id', getVehicleById);

// Admin routes
router.post('/', authenticate, authorize('admin'), createVehicle);
router.put('/:id', authenticate, authorize('admin'), updateVehicle);
router.delete('/:id', authenticate, authorize('admin'), deleteVehicle);

module.exports = router;