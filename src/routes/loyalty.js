const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middlewares/auth');
const LoyaltyService = require('../services/loyaltyService');

// Get current user loyalty info
router.get('/me', authenticate, async (req, res) => {
  try {
    const loyaltyInfo = await LoyaltyService.getLoyaltyInfo(req.user.id);
    res.json(loyaltyInfo);
  } catch (error) {
    console.error('Get loyalty info error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Redeem points for discount
router.post('/redeem', authenticate, async (req, res) => {
  try {
    const { points } = req.body;

    if (!points || points <= 0) {
      return res.status(400).json({ error: 'Valid points amount required' });
    }

    // Minimum redemption 100 points
    if (points < 100) {
      return res.status(400).json({ error: 'Minimum 100 points required for redemption' });
    }

    const result = await LoyaltyService.redeemPoints(req.user.id, points);
    
    res.json({
      message: 'Points redeemed successfully',
      ...result
    });
  } catch (error) {
    console.error('Redeem points error:', error);
    res.status(error.message === 'Insufficient points' ? 400 : 500).json({ 
      error: error.message 
    });
  }
});

// Get tier benefits and info
router.get('/tiers', authenticate, async (req, res) => {
  try {
    const tiers = Object.entries(LoyaltyService.TIERS).map(([name, details]) => ({
      name,
      minPoints: details.min,
      maxPoints: details.max === Infinity ? null : details.max,
      discount: details.discount,
      discountPercentage: `${(details.discount * 100).toFixed(0)}%`
    }));

    res.json({ tiers, pointsPerDollar: LoyaltyService.POINTS_PER_DOLLAR });
  } catch (error) {
    console.error('Get tiers error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get loyalty history (placeholder for future transaction log)
router.get('/history', authenticate, async (req, res) => {
  try {
    // For now, return booking-based points history
    const bookings = await prisma.booking.findMany({
      where: {
        userId: req.user.id,
        status: 'completed'
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        totalPrice: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const history = bookings.map(booking => ({
      id: booking.id,
      type: 'earned',
      points: Math.floor(booking.totalPrice * LoyaltyService.POINTS_PER_DOLLAR),
      reason: 'Booking completed',
      date: booking.createdAt,
      relatedBooking: booking.id
    }));

    res.json({ history });
  } catch (error) {
    console.error('Get loyalty history error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
