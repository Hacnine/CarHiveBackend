const express = require('express');
const router = express.Router();
const { createCheckoutSession, handleWebhook } = require('../controllers/paymentController');

// POST /api/payments/create-checkout-session
router.post('/create-checkout-session', createCheckoutSession);

// POST /api/payments/webhook
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

module.exports = router;
