const express = require('express');
const {
  getVehicles,
  getAvailableVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  bulkImportVehicles,
  updateVehicleStatus
} = require('../controllers/vehicleController');
const { authenticate, authorize, optionalAuth } = require('../middlewares/auth');

const router = express.Router();

// Public routes
router.get('/', optionalAuth, getVehicles);
// Search available vehicles for a date range and filters
router.get('/available', optionalAuth, getAvailableVehicles);
router.get('/:id', getVehicleById);

// Admin routes
router.post('/', authenticate, authorize('admin'), createVehicle);
router.put('/:id', authenticate, authorize('admin'), updateVehicle);
router.delete('/:id', authenticate, authorize('admin'), deleteVehicle);
router.post('/bulk-import', authenticate, authorize('admin'), bulkImportVehicles);
router.patch('/:id/status', authenticate, authorize('admin'), updateVehicleStatus);

module.exports = router;