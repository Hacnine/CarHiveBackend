const express = require('express');
const {
  createMaintenanceTask,
  getMaintenanceTasks,
  getMaintenanceTaskById,
  updateMaintenanceTask,
  deleteMaintenanceTask
} = require('../controllers/maintenanceController');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

// All maintenance routes require admin access
router.post('/', authenticate, authorize('admin'), createMaintenanceTask);
router.get('/', authenticate, authorize('admin'), getMaintenanceTasks);
router.get('/:id', authenticate, authorize('admin'), getMaintenanceTaskById);
router.put('/:id', authenticate, authorize('admin'), updateMaintenanceTask);
router.delete('/:id', authenticate, authorize('admin'), deleteMaintenanceTask);

module.exports = router;
