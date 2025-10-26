# CarHive Backend API

A comprehensive car rental platform backend (CarHive) built with Node.js, Express, Prisma ORM and MongoDB. This repository implements a production-minded REST API that supports user auth, vehicle inventory, bookings with a hold workflow, a flexible pricing engine, admin operations, and audit logging.

## 🚀 Features

- **User Authentication & Authorization** - JWT-based auth with role-based access control
- **Vehicle Management** - CRUD operations with advanced filtering and search
- **Booking System** - Complete reservation management with conflict checking
 - **Booking System** - Complete reservation management with conflict checking and short-lived holds (reservation holds)
- **Location Management** - Airport and city locations with availability tracking
- **Review System** - Customer reviews and ratings for vehicles
- **Payment Tracking** - Mock payment integration ready for real payment providers
- **Admin Dashboard** - Admin-only routes for managing all resources
- **Rate Limiting** - Protection against abuse with configurable limits
- **Data Validation** - Comprehensive input validation using Joi
- **Error Handling** - Centralized error handling with detailed responses

New / Advanced features (implemented)
- Pricing engine (PriceRule + AddOn models): supports seasonal/weekday/length-of-rental rules, promo codes, per-day and flat add-ons, taxes and fees. See `src/services/pricingService.js`.
- Hold workflow: create short holds (`pending_hold`) with `holdExpiresAt` and confirm flow to capture payment. Endpoints: `POST /api/bookings/hold`, `POST /api/bookings/confirm`.
- Audit logging: booking lifecycle events and critical actions are written into `AuditLog` model via `src/services/auditService.js`.
- Availability checks include pending holds to avoid double bookings.

## 📋 Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd CarHiveBackend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   DATABASE_URL="mongodb://localhost:27017/carhive"
   JWT_SECRET="your-super-secret-jwt-key"
   JWT_EXPIRES_IN="7d"
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   ```

4. **Generate Prisma client**
   ```bash
   npx prisma generate
   ```

5. **Push database schema**
   ```bash
   npx prisma db push
   ```

6. **Seed the database**
   ```bash
   npm run seed
   ```

7. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

Note: if you run the backend on a different port, update `VITE_API_URL` in the frontend accordingly.

### Authentication

All protected routes require an `Authorization` header:
```
Authorization: Bearer <your-jwt-token>
```

### Sample Credentials (from seed data)
- **Admin**: `admin@carhive.com` / `admin123`
- **Customer**: `john.doe@example.com` / `customer123`

### API Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user profile (Protected)
- `PUT /api/auth/profile` - Update profile (Protected)

#### Vehicles
- `GET /api/vehicles` - Get vehicles with filtering
  - Query params: `location`, `type`, `transmission`, `fuelType`, `minPrice`, `maxPrice`, `startDate`, `endDate`, `search`, `page`, `limit`
- `GET /api/vehicles/:id` - Get vehicle by ID
- `POST /api/vehicles` - Create vehicle (Admin only)
- `PUT /api/vehicles/:id` - Update vehicle (Admin only)
- `DELETE /api/vehicles/:id` - Delete vehicle (Admin only)

#### Bookings
- `POST /api/bookings` - Create booking (Protected)
- `GET /api/bookings` - Get user bookings (Protected)
- `GET /api/bookings/:id` - Get booking by ID (Protected)
- `PUT /api/bookings/:id/cancel` - Cancel booking (Protected)
- `GET /api/bookings/admin/all` - Get all bookings (Admin only)
- `PUT /api/bookings/:id/status` - Update booking status (Admin only)
 - `POST /api/bookings/hold` - Place a short hold for a vehicle (Protected)
   - Creates a booking with `status: pending_hold` and a `holdExpiresAt` timestamp.
   - Body: same as create booking plus optional `addons` and `promoCode`.
 - `POST /api/bookings/confirm` - Confirm a held booking and create a Payment record (Protected)
   - Body: { bookingId, providerId?, paymentMethod? }
   - Currently a mock payment record is created; integrate a payment gateway (Stripe recommended) to perform authorize/capture.

#### Locations
- `GET /api/locations` - Get all locations
- `GET /api/locations/:id` - Get location by ID
- `POST /api/locations` - Create location (Admin only)
- `PUT /api/locations/:id` - Update location (Admin only)
- `DELETE /api/locations/:id` - Delete location (Admin only)

#### Reviews
- `POST /api/reviews` - Create review (Protected)
- `GET /api/reviews/vehicle/:vehicleId` - Get vehicle reviews
- `GET /api/reviews/user` - Get user reviews (Protected)
- `PUT /api/reviews/:id` - Update review (Protected)
- `DELETE /api/reviews/:id` - Delete review (Protected)
- `GET /api/reviews/admin/all` - Get all reviews (Admin only)

#### Users (Admin only)
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id/role` - Update user role
- `DELETE /api/users/:id` - Delete user

### Example Requests

#### Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@example.com",
    "password": "password123",
    "phone": "(555) 123-4567"
  }'
```

#### Search Vehicles
```bash
curl "http://localhost:5000/api/vehicles?location=LAX&type=suv&minPrice=50&maxPrice=100"
```

#### Create Booking
```bash
curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{
    "vehicleId": "vehicle-id-here",
    "locationPickupId": "pickup-location-id",
    "locationDropoffId": "dropoff-location-id",
    "startDate": "2024-12-01T10:00:00.000Z",
    "endDate": "2024-12-05T10:00:00.000Z"
  }'
```

## 🏗️ Project Structure

```
src/
├── controllers/           # Route handlers
│   ├── authController.js
│   ├── vehicleController.js
│   ├── bookingController.js
│   ├── locationController.js
│   ├── reviewController.js
│   └── userController.js
├── middlewares/          # Custom middleware
│   ├── auth.js
│   └── errorHandler.js
├── routes/               # Route definitions
│   ├── auth.js
│   ├── vehicles.js
│   ├── bookings.js
│   ├── locations.js
│   ├── reviews.js
│   └── users.js
├── utils/                # Utility functions
│   ├── auth.js
│   └── validation.js
├── app.js               # Express app configuration
└── server.js            # Server startup

Additional folders of interest:
- `src/services/` — contains `pricingService.js`, `availabilityService.js`, `auditService.js` and other domain services.
- `prisma/seed.js` — creates sample locations, vehicles, and example promotions/add-ons (useful when demoing the pricing engine).

prisma/
├── schema.prisma        # Database schema
└── seed.js             # Database seeding script
```

## 🗄️ Database Schema

### Models
- **User** - Customer and admin accounts
- **Vehicle** - Car inventory with specifications
- **Location** - Pickup/dropoff locations (airport/city)
- **Booking** - Rental reservations
- **Payment** - Payment tracking
- **Review** - Customer reviews and ratings
- **PriceRule** - Stores pricing rules (seasonal, weekday, length_of_rental, promo codes)
- **AddOn** - Optional extras with per-day or flat pricing
- **AuditLog** - Stores lifecycle/audit events for important entities

### Key Relationships
- Users can have multiple bookings and reviews
- Vehicles belong to locations and can have multiple bookings/reviews
- Bookings connect users, vehicles, and locations with payment info

## 🔒 Security Features

- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - bcrypt with salt rounds
- **Rate Limiting** - Configurable request limits
- **CORS Protection** - Cross-origin request handling
- **Helmet Security** - Security headers
- **Input Validation** - Comprehensive data validation
- **Role-based Access** - Admin/customer permissions

Security notes:
- JWTs are signed with `JWT_SECRET`. Rotate the secret in production and keep it in a secure store.
- Consider enabling HTTPS and stricter CORS rules in production.

## 🚀 Deployment

### Environment Variables for Production
```env
NODE_ENV=production
DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/carhive"
JWT_SECRET="your-production-secret-key"
FRONTEND_URL=https://your-frontend-domain.com
```

### Deployment Platforms
- **Railway** - Easy deployment with automatic MongoDB
- **Render** - Simple deployment with free tier
- **Vercel** - Serverless deployment option
- **Heroku** - Traditional deployment platform

## 📊 Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:push` - Push schema to database
- `npm run prisma:studio` - Open Prisma Studio
- `npm run seed` - Seed database with sample data

New developer commands you may find useful:
- `npx prisma generate` — regenerate Prisma client after schema changes
- `npm run dev` — runs server with nodemon for local development

## 🔧 Configuration

### Rate Limiting
Configure in `.env`:
```env
RATE_LIMIT_WINDOW_MS=900000    # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100    # Max requests per window
```

### CORS
Update allowed origins in `src/app.js`:
```javascript
cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
})
```

## 🧪 Testing

Sample data is automatically created when running the seed script:
- 6 locations (3 airports, 3 city locations)
- 10 vehicles across different categories
- Sample bookings and reviews
- Admin and customer test accounts

Testing notes & quick checks
- Use the seed script (`npm run seed`) to populate sample PriceRule and AddOn data used by the pricing engine.
- Manual smoke test flow:
  1. Register/login a user.
  2. Place a hold: `POST /api/bookings/hold` with vehicleId + start/end dates.
  3. Confirm the hold: `POST /api/bookings/confirm` with the bookingId returned by the hold call.

Automated tests are not yet included for pricing/hold flows; adding Jest + supertest suites is a recommended next step.

## 📝 API Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "errors": ["Detailed error messages"] // For validation errors
}
```

### Pagination Response
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCount": 50,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions, please create an issue in the repository or contact the development team.

---

**CarHive Backend** - Built with ❤️ for the car rental industry