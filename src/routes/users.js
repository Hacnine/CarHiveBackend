const express = require('express');
const {
  getUsers,
  getUserById,
  updateUserRole,
  deleteUser
} = require('../controllers/userController');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

// All routes are admin-only
router.use(authenticate, authorize('admin'));

router.get('/', getUsers);
router.get('/:id', getUserById);
router.put('/:id/role', updateUserRole);
router.delete('/:id', deleteUser);

module.exports = router;