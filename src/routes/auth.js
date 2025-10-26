const express = require('express');
const { register, login, getProfile, updateProfile } = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes (require authentication)
router.get('/me', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);

module.exports = router;