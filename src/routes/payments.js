const express = require('express');
const router = express.Router();
const { createCheckoutSession } = require('../controllers/paymentController');

// POST /api/payments/create-checkout-session
router.post('/create-checkout-session', createCheckoutSession);

module.exports = router;
