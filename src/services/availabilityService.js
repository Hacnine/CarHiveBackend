const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Check overlap helper
 */
function overlaps(startA, endA, startB, endB) {
  return !(endA < startB || startA > endB);
}

/**
 * Check if a vehicle is available between dates (no bookings with status pending_hold, confirmed, active)
 */
async function isVehicleAvailable(vehicleId, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const conflicts = await prisma.booking.findMany({
    where: {
      vehicleId,
      status: { in: ['pending_hold', 'confirmed', 'active'] },
      OR: [
        {
          startDate: { lte: end },
          endDate: { gte: start }
        }
      ]
    }
  });

  return conflicts.length === 0;
}

/**
 * Find available vehicles for a period and optional filters
 */
async function findAvailableVehicles({ startDate, endDate, locationCode, category }) {
  // find candidate vehicles by location/category
  const where = {};
  if (locationCode) {
    const location = await prisma.location.findFirst({ where: { code: locationCode } });
    if (!location) return [];
    where.locationId = location.id;
  }
  if (category) {
    where.category = category;
  }

  // only return vehicles that are available in status
  where.status = 'available';

  const candidates = await prisma.vehicle.findMany({ where });
  const available = [];
  for (const v of candidates) {
    const ok = await isVehicleAvailable(v.id, startDate, endDate);
    if (ok) available.push(v);
  }
  return available;
}

module.exports = { isVehicleAvailable, findAvailableVehicles };
