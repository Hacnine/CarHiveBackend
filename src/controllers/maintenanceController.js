const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Create maintenance task
 * POST /api/maintenance
 */
const createMaintenanceTask = async (req, res) => {
  try {
    const { vehicleId, type, description, scheduledAt, assignedTo, notes } = req.body;

    if (!vehicleId || !type || !description || !scheduledAt) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    const task = await prisma.maintenanceTask.create({
      data: {
        vehicleId,
        type,
        description,
        scheduledAt: new Date(scheduledAt),
        assignedTo: assignedTo || null,
        notes: notes || null
      },
      include: {
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            year: true
          }
        }
      }
    });

    res.status(201).json({ success: true, message: 'Maintenance task created', data: { task } });
  } catch (error) {
    console.error('Create maintenance task error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get all maintenance tasks with filters
 * GET /api/maintenance
 */
const getMaintenanceTasks = async (req, res) => {
  try {
    const { vehicleId, status, type, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};
    if (vehicleId) where.vehicleId = vehicleId;
    if (status) where.status = status;
    if (type) where.type = type;

    const [tasks, totalCount] = await Promise.all([
      prisma.maintenanceTask.findMany({
        where,
        include: {
          vehicle: {
            select: {
              id: true,
              make: true,
              model: true,
              year: true,
              status: true
            }
          }
        },
        orderBy: { scheduledAt: 'desc' },
        skip,
        take
      }),
      prisma.maintenanceTask.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / take);

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get maintenance tasks error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get single maintenance task
 * GET /api/maintenance/:id
 */
const getMaintenanceTaskById = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await prisma.maintenanceTask.findUnique({
      where: { id },
      include: {
        vehicle: true
      }
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Maintenance task not found' });
    }

    res.json({ success: true, data: { task } });
  } catch (error) {
    console.error('Get maintenance task error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Update maintenance task
 * PUT /api/maintenance/:id
 */
const updateMaintenanceTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, completedAt, notes, photos, cost, mileage, assignedTo } = req.body;

    const existing = await prisma.maintenanceTask.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Maintenance task not found' });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (completedAt) updateData.completedAt = new Date(completedAt);
    if (notes !== undefined) updateData.notes = notes;
    if (photos) updateData.photos = photos;
    if (cost !== undefined) updateData.cost = parseFloat(cost);
    if (mileage !== undefined) updateData.mileage = parseInt(mileage);
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

    const task = await prisma.maintenanceTask.update({
      where: { id },
      data: updateData,
      include: {
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            year: true
          }
        }
      }
    });

    // If completed, update vehicle status back to available if currently in maintenance
    if (status === 'completed' && existing.vehicleId) {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: existing.vehicleId } });
      if (vehicle && vehicle.status === 'maintenance') {
        await prisma.vehicle.update({
          where: { id: existing.vehicleId },
          data: { status: 'available' }
        });
      }
    }

    res.json({ success: true, message: 'Maintenance task updated', data: { task } });
  } catch (error) {
    console.error('Update maintenance task error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Delete maintenance task
 * DELETE /api/maintenance/:id
 */
const deleteMaintenanceTask = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await prisma.maintenanceTask.findUnique({ where: { id } });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Maintenance task not found' });
    }

    await prisma.maintenanceTask.delete({ where: { id } });

    res.json({ success: true, message: 'Maintenance task deleted' });
  } catch (error) {
    console.error('Delete maintenance task error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  createMaintenanceTask,
  getMaintenanceTasks,
  getMaintenanceTaskById,
  updateMaintenanceTask,
  deleteMaintenanceTask
};
