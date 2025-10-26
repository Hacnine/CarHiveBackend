const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function logEvent(entity, entityId, action, data = {}) {
  try {
    await prisma.auditLog.create({
      data: {
        entity,
        entityId,
        action,
        data
      }
    });
  } catch (e) {
    console.warn('Failed to write audit log', e);
  }
}

module.exports = { logEvent };