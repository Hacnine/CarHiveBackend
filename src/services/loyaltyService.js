const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class LoyaltyService {
  // Points per dollar spent
  static POINTS_PER_DOLLAR = 10;

  // Tier thresholds
  static TIERS = {
    bronze: { min: 0, max: 999, discount: 0 },
    silver: { min: 1000, max: 4999, discount: 0.05 },
    gold: { min: 5000, max: 9999, discount: 0.10 },
    platinum: { min: 10000, max: Infinity, discount: 0.15 }
  };

  /**
   * Award points for a booking
   */
  static async awardPoints(userId, amount, reason = 'booking_completed') {
    try {
      const pointsEarned = Math.floor(amount * this.POINTS_PER_DOLLAR);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('User not found');

      const newPoints = user.loyaltyPoints + pointsEarned;
      const newTier = this.calculateTier(newPoints);

      await prisma.user.update({
        where: { id: userId },
        data: {
          loyaltyPoints: newPoints,
          loyaltyTier: newTier
        }
      });

      console.log(`Awarded ${pointsEarned} points to user ${userId}. New balance: ${newPoints}, Tier: ${newTier}`);

      return { pointsEarned, newPoints, newTier };
    } catch (error) {
      console.error('Award points error:', error);
      throw error;
    }
  }

  /**
   * Redeem points for discount
   */
  static async redeemPoints(userId, points) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('User not found');

      if (user.loyaltyPoints < points) {
        throw new Error('Insufficient points');
      }

      const newPoints = user.loyaltyPoints - points;
      const newTier = this.calculateTier(newPoints);

      await prisma.user.update({
        where: { id: userId },
        data: {
          loyaltyPoints: newPoints,
          loyaltyTier: newTier
        }
      });

      // 100 points = $1 discount
      const discountAmount = points / 100;

      return { pointsRedeemed: points, discountAmount, newPoints, newTier };
    } catch (error) {
      console.error('Redeem points error:', error);
      throw error;
    }
  }

  /**
   * Calculate tier based on points
   */
  static calculateTier(points) {
    for (const [tier, range] of Object.entries(this.TIERS)) {
      if (points >= range.min && points <= range.max) {
        return tier;
      }
    }
    return 'bronze';
  }

  /**
   * Get tier discount percentage
   */
  static getTierDiscount(tier) {
    return this.TIERS[tier]?.discount || 0;
  }

  /**
   * Get user loyalty info
   */
  static async getLoyaltyInfo(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          loyaltyPoints: true,
          loyaltyTier: true
        }
      });

      if (!user) throw new Error('User not found');

      const tierInfo = this.TIERS[user.loyaltyTier] || this.TIERS.bronze;
      const pointsToNextTier = this.getPointsToNextTier(user.loyaltyPoints, user.loyaltyTier);

      return {
        ...user,
        tierInfo,
        pointsToNextTier,
        availableDiscount: tierInfo.discount
      };
    } catch (error) {
      console.error('Get loyalty info error:', error);
      throw error;
    }
  }

  /**
   * Calculate points needed for next tier
   */
  static getPointsToNextTier(currentPoints, currentTier) {
    const tiers = ['bronze', 'silver', 'gold', 'platinum'];
    const currentIndex = tiers.indexOf(currentTier);
    
    if (currentIndex === tiers.length - 1) {
      return 0; // Already at max tier
    }

    const nextTier = tiers[currentIndex + 1];
    const nextThreshold = this.TIERS[nextTier].min;
    
    return Math.max(0, nextThreshold - currentPoints);
  }
}

module.exports = LoyaltyService;
