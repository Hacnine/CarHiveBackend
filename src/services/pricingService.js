const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Pure price calculation helper - returns line-item breakdown.
 * This function is intentionally pure-ish: accepts objects and arrays so it can be unit-tested.
 *
 * Inputs:
 *  - vehicle: { dailyRate, baseDailyRate }
 *  - startDate, endDate
 *  - addons: [{ addonId, qty }]
 *  - location: { depositAmount, currency }
 *  - priceRules: array of rules to apply (seasonal, weekday...)
 *  - promoRule: optional promo PriceRule
 *  - user: { age }
 */
function calculatePriceBreakdown({ vehicle, startDate, endDate, addons = [], location = {}, priceRules = [], promoRule = null, user = {} }) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.max(1, Math.ceil((end - start) / msPerDay));

  const baseDaily = typeof vehicle.dailyRate === 'number' ? vehicle.dailyRate : (vehicle.baseDailyRate || 0);
  let subtotal = baseDaily * days;
  const dayRates = new Array(days).fill(baseDaily);

  // Apply priceRules (simple implementation): for seasonal rules that match date range apply multiplier or flatAmount
  if (Array.isArray(priceRules)) {
    priceRules.forEach(rule => {
      try {
        if (rule.type === 'seasonal' && rule.startDate && rule.endDate) {
          const rStart = new Date(rule.startDate);
          const rEnd = new Date(rule.endDate);
          // if any overlap, apply multiplier to all days (simple)
          if (!(end < rStart || start > rEnd)) {
            if (rule.multiplier) {
              for (let i = 0; i < dayRates.length; i++) dayRates[i] = dayRates[i] * rule.multiplier;
            }
            if (rule.flatAmount) {
              for (let i = 0; i < dayRates.length; i++) dayRates[i] = dayRates[i] + rule.flatAmount;
            }
          }
        } else if (rule.type === 'weekday' && rule.multiplier) {
          // rule.weekdays: assume rule.weekdays is array of 0-6 ints
          const weekdays = rule.weekdays || [];
          for (let i = 0; i < days; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            if (weekdays.includes(d.getDay())) {
              dayRates[i] = dayRates[i] * rule.multiplier;
            }
          }
        } else if (rule.type === 'length_of_rental' && rule.multiplier) {
          if (rule.minDays && days >= rule.minDays) {
            for (let i = 0; i < dayRates.length; i++) dayRates[i] = dayRates[i] * rule.multiplier;
          }
        }
      } catch (e) {
        // swallow rule errors so pricing still returns
        console.warn('PriceRule application error', e);
      }
    });
  }

  subtotal = dayRates.reduce((s, r) => s + r, 0);

  // Add-ons
  let addonsTotal = 0;
  const addonsLine = [];
  if (Array.isArray(addons) && addons.length > 0) {
    addons.forEach(a => {
      const qty = a.qty || 1;
      const price = a.price || 0; // allow pre-resolved price
      const perDay = a.perDay !== undefined ? a.perDay : true;
      const linePrice = perDay ? price * qty * days : price * qty;
      addonsLine.push({ addonId: a.addonId, name: a.name, qty, perDay, unitPrice: price, linePrice });
      addonsTotal += linePrice;
    });
  }

  // Location-specific fees (one-way)
  let oneWayFee = 0;
  if (location && location.oneWayFee && location.oneWayFee > 0) {
    oneWayFee = location.oneWayFee;
  }

  // Young-driver fee
  let youngDriverFee = 0;
  const userAge = user.age || 0;
  const youngThreshold = (location && location.minAgeThreshold) || 25;
  const youngDriverPerDay = (location && location.youngDriverFeePerDay) || 15;
  if (userAge > 0 && userAge < youngThreshold) {
    youngDriverFee = youngDriverPerDay * days;
  }

  // Taxes & fees (simple defaults)
  const fees = oneWayFee;
  const taxableBase = subtotal + addonsTotal + fees + youngDriverFee;
  const taxRate = (location && location.taxRate) || 0.1; // default 10%
  const taxes = Math.round((taxableBase * taxRate) * 100) / 100;

  let totalBeforePromo = Math.round((subtotal + addonsTotal + fees + youngDriverFee + taxes) * 100) / 100;

  // Apply promoRule (simple): flatAmount or multiplier
  let promoDiscount = 0;
  if (promoRule) {
    if (promoRule.flatAmount) {
      promoDiscount = promoRule.flatAmount;
    } else if (promoRule.multiplier) {
      promoDiscount = Math.round(totalBeforePromo * (1 - (1 / promoRule.multiplier)) * 100) / 100;
    }
  }

  const totalPrice = Math.max(0, Math.round((totalBeforePromo - promoDiscount) * 100) / 100);

  return {
    days,
    dailyRates: dayRates,
    subtotal: Math.round(subtotal * 100) / 100,
    addons: addonsLine,
    addonsTotal: Math.round(addonsTotal * 100) / 100,
    fees: Math.round(fees * 100) / 100,
    youngDriverFee: Math.round(youngDriverFee * 100) / 100,
    taxes: Math.round(taxes * 100) / 100,
    promoDiscount: Math.round(promoDiscount * 100) / 100,
    total: totalPrice
  };
}

/**
 * Convenience function that fetches necessary DB records and returns breakdown.
 */
async function calculatePriceForBooking({ vehicleId, startDate, endDate, addons = [], promoCode = null, userId = null, pickupLocationId = null, dropoffLocationId = null }) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new Error('Vehicle not found');

  const pickupLocation = pickupLocationId ? await prisma.location.findUnique({ where: { id: pickupLocationId } }) : (vehicle.locationId ? await prisma.location.findUnique({ where: { id: vehicle.locationId } }) : {});
  const dropoffLocation = dropoffLocationId ? await prisma.location.findUnique({ where: { id: dropoffLocationId } }) : pickupLocation;

  // load price rules overlapping period and vehicle category
  const rules = await prisma.priceRule.findMany({
    where: {
      OR: [
        { type: 'seasonal' },
        { type: 'weekday' },
        { type: 'length_of_rental' }
      ]
    }
  });

  let promoRule = null;
  if (promoCode) {
    promoRule = await prisma.priceRule.findFirst({ where: { code: promoCode, type: 'promo' } });
  }

  // Expand addons with price/ perDay
  const resolvedAddons = [];
  for (const a of addons) {
    const addon = await prisma.addOn.findUnique({ where: { id: a.addonId || a.id } });
    if (addon) resolvedAddons.push({ addonId: addon.id, name: addon.name, qty: a.qty || 1, price: addon.price, perDay: addon.perDay });
  }

  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : {};

  // Calculate cross-location fee
  const crossLocationFee = (pickupLocationId && dropoffLocationId && pickupLocationId !== dropoffLocationId) ? 50 : 0; // Fixed fee for different locations

  const breakdown = calculatePriceBreakdown({ vehicle, startDate, endDate, addons: resolvedAddons, location: pickupLocation, priceRules: rules, promoRule, user });

  // Add cross-location fee to fees
  breakdown.fees += crossLocationFee;
  breakdown.total += crossLocationFee;

  return breakdown;
}

module.exports = {
  calculatePriceBreakdown,
  calculatePriceForBooking
};
