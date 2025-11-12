const Joi = require('joi');

// User registration validation
const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot exceed 50 characters',
    'any.required': 'Name is required'
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(6).max(128).required().messages({
    'string.min': 'Password must be at least 6 characters long',
    'string.max': 'Password cannot exceed 128 characters',
    'any.required': 'Password is required'
  }),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional().messages({
    'string.pattern.base': 'Please provide a valid phone number'
  }),
  role: Joi.string().valid('customer', 'admin').default('customer')
});

// User login validation
const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required'
  })
});

// Vehicle creation validation
const vehicleSchema = Joi.object({
  sku: Joi.string().optional(),
  make: Joi.string().min(1).max(50).required(),
  model: Joi.string().min(1).max(50).required(),
  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).required(),
  category: Joi.string().valid('economy', 'compact', 'midsize', 'suv', 'luxury', 'van').required(),
  transmission: Joi.string().valid('manual', 'automatic').required(),
  fuelType: Joi.string().valid('gasoline', 'diesel', 'hybrid', 'electric').required(),
  baseDailyRate: Joi.number().positive().required(),
  dailyRate: Joi.number().positive().required(),
  status: Joi.string().valid('available', 'reserved', 'rented', 'maintenance', 'retired').default('available'),
  locationId: Joi.string().optional(),
  imageUrl: Joi.string().uri().optional(),
  description: Joi.string().max(500).optional(),
  seats: Joi.number().integer().min(1).max(15).default(5),
  doors: Joi.number().integer().min(2).max(6).default(4),
  features: Joi.array().items(Joi.string()).default([])
});

// Booking creation validation
const bookingSchema = Joi.object({
  vehicleId: Joi.string().required(),
  locationPickupId: Joi.string().required(),
  locationDropoffId: Joi.string().required(),
  startDate: Joi.date().iso().min('now').required().messages({
    'date.min': 'Start date cannot be in the past'
  }),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required().messages({
    'date.greater': 'End date must be after start date'
  }),
  notes: Joi.string().max(500).optional()
});

// Location creation validation
const locationSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  code: Joi.string().min(3).max(10).required(),
  address: Joi.string().min(5).max(200).required(),
  type: Joi.string().valid('airport', 'city').required(),
  city: Joi.string().min(2).max(50).required(),
  state: Joi.string().min(2).max(50).optional(),
  country: Joi.string().min(2).max(50).default('USA'),
  zipCode: Joi.string().optional(),
  phone: Joi.string().optional(),
  hours: Joi.string().optional()
});

// Review creation validation
const reviewSchema = Joi.object({
  vehicleId: Joi.string().required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().max(1000).optional()
});

module.exports = {
  registerSchema,
  loginSchema,
  vehicleSchema,
  bookingSchema,
  locationSchema,
  reviewSchema
};