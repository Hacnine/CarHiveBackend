const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const notificationService = require('../services/notificationService');
require('dotenv').config();

async function createCheckoutSession(req, res) {
  const { bookingId } = req.body || {};
  if (!bookingId) return res.status(400).json({ success: false, message: 'bookingId is required' });

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

  // If Stripe is not configured, return a helpful response so frontend can fallback to demo flow
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(501).json({ success: false, message: 'Stripe not configured on server' });
  }

  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' });

    const amount = Math.round((booking.totalPrice || 0) * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: `Booking ${booking.id}` },
            unit_amount: amount
          },
          quantity: 1
        }
      ],
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5174'}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5174'}/payment-cancel`,
      metadata: { bookingId: booking.id }
    });

    return res.json({ success: true, url: session.url });
  } catch (err) {
    console.error('Stripe create session failed', err);
    return res.status(500).json({ success: false, message: 'Failed to create Stripe session', error: String(err) });
  }
}

async function handleWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' });
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookingId = session.metadata.bookingId;

    // Update booking status to confirmed/paid
    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'confirmed', paymentStatus: 'paid' },
      include: { user: { select: { email: true } }, vehicle: true }
    });

    // Update vehicle status to reserved
    if (booking.vehicleId) {
      await prisma.vehicle.update({
        where: { id: booking.vehicleId },
        data: { status: 'reserved' }
      });
    }

    // Send payment receipt
    try {
      await notificationService.sendPaymentReceipt(booking.user.email, booking);
    } catch (e) {
      console.warn('Failed to send payment receipt', e);
    }

    console.log(`Payment successful for booking ${bookingId}`);
  }

  res.json({ received: true });
}

module.exports = { createCheckoutSession, handleWebhook };
