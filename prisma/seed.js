const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive database seeding...');

  try {
    // Clean existing data (optional - uncomment if you want fresh start)
    // await prisma.auditLog.deleteMany();
    // await prisma.review.deleteMany();
    // await prisma.payment.deleteMany();
    // await prisma.booking.deleteMany();
    // await prisma.maintenanceTask.deleteMany();
    // await prisma.vehicle.deleteMany();
    // await prisma.location.deleteMany();
    // await prisma.addOn.deleteMany();
    // await prisma.priceRule.deleteMany();
    // await prisma.user.deleteMany();

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@carhive.com' },
      update: {},
      create: {
        name: 'CarHive Admin',
        email: 'admin@carhive.com',
        passwordHash: adminPassword,
        phone: '+15551234567',
        role: 'admin',
        loyaltyPoints: 0,
        loyaltyTier: 'bronze'
      }
    });
    console.log('✅ Admin user created');

    // Create multiple sample customers with varying loyalty levels
    const customerPassword = await bcrypt.hash('customer123', 12);
    
    const customer1 = await prisma.user.upsert({
      where: { email: 'john.doe@example.com' },
      update: {},
      create: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        passwordHash: customerPassword,
        phone: '+15559876543',
        role: 'customer',
        loyaltyPoints: 1500,
        loyaltyTier: 'silver'
      }
    });

    const customer2 = await prisma.user.upsert({
      where: { email: 'jane.smith@example.com' },
      update: {},
      create: {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        passwordHash: customerPassword,
        phone: '+15555551234',
        role: 'customer',
        loyaltyPoints: 6500,
        loyaltyTier: 'gold'
      }
    });

    const customer3 = await prisma.user.upsert({
      where: { email: 'mike.wilson@example.com' },
      update: {},
      create: {
        name: 'Mike Wilson',
        email: 'mike.wilson@example.com',
        passwordHash: customerPassword,
        phone: '+15555559876',
        role: 'customer',
        loyaltyPoints: 12000,
        loyaltyTier: 'platinum'
      }
    });

    const customer4 = await prisma.user.upsert({
      where: { email: 'sarah.johnson@example.com' },
      update: {},
      create: {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@example.com',
        passwordHash: customerPassword,
        phone: '+15555556789',
        role: 'customer',
        loyaltyPoints: 450,
        loyaltyTier: 'bronze'
      }
    });

    console.log('✅ Sample customers created with loyalty tiers');

    // Create locations
    const locations = [
      {
        name: 'Los Angeles International Airport',
        code: 'LAX',
        address: '1 World Way, Los Angeles, CA 90045',
        type: 'airport',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90045',
        phone: '+13106465252',
        hours: '24/7',
        minAge: 21,
        debitAllowed: true,
        depositAmount: 200,
        isActive: true
      },
      {
        name: 'Downtown Los Angeles',
        code: 'DTLA',
        address: '123 S Hope St, Los Angeles, CA 90012',
        type: 'city',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90012',
        phone: '+12135550123',
        hours: 'Mon-Sun: 6:00 AM - 10:00 PM',
        minAge: 21,
        debitAllowed: false,
        depositAmount: 150,
        isActive: true
      },
      {
        name: 'John F. Kennedy International Airport',
        code: 'JFK',
        address: 'Queens, NY 11430',
        type: 'airport',
        city: 'New York',
        state: 'NY',
        zipCode: '11430',
        phone: '+17182444444',
        hours: '24/7',
        minAge: 25,
        debitAllowed: true,
        depositAmount: 250,
        isActive: true
      },
      {
        name: 'Manhattan Midtown',
        code: 'NYC',
        address: '234 W 42nd St, New York, NY 10036',
        type: 'city',
        city: 'New York',
        state: 'NY',
        zipCode: '10036',
        phone: '+12125550156',
        hours: 'Mon-Sun: 7:00 AM - 9:00 PM',
        minAge: 25,
        debitAllowed: false,
        depositAmount: 200,
        isActive: true
      },
      {
        name: 'Miami International Airport',
        code: 'MIA',
        address: '2100 NW 42nd Ave, Miami, FL 33126',
        type: 'airport',
        city: 'Miami',
        state: 'FL',
        zipCode: '33126',
        phone: '+13058767000',
        hours: '24/7',
        minAge: 21,
        debitAllowed: true,
        depositAmount: 200,
        isActive: true
      },
      {
        name: 'South Beach',
        code: 'SBE',
        address: '1234 Ocean Dr, Miami Beach, FL 33139',
        type: 'city',
        city: 'Miami Beach',
        state: 'FL',
        zipCode: '33139',
        phone: '+13055550189',
        hours: 'Mon-Sun: 8:00 AM - 8:00 PM',
        minAge: 23,
        debitAllowed: true,
        depositAmount: 175,
        isActive: true
      },
      {
        name: 'San Francisco International Airport',
        code: 'SFO',
        address: 'San Francisco, CA 94128',
        type: 'airport',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94128',
        phone: '+16508218211',
        hours: '24/7',
        minAge: 21,
        debitAllowed: true,
        depositAmount: 225,
        isActive: true
      },
      {
        name: 'Chicago O\'Hare International Airport',
        code: 'ORD',
        address: '10000 W O\'Hare Ave, Chicago, IL 60666',
        type: 'airport',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60666',
        phone: '+17738946000',
        hours: '24/7',
        minAge: 21,
        debitAllowed: true,
        depositAmount: 200,
        isActive: true
      }
    ];

    const createdLocations = [];
    for (const locationData of locations) {
      const location = await prisma.location.upsert({
        where: { code: locationData.code },
        update: {},
        create: locationData
      });
      createdLocations.push(location);
    }
    console.log('✅ Locations created');

    // Create vehicles with varied statuses
    const vehicles = [
      // Economy Cars
      {
        sku: 'ECAR-001',
        make: 'Nissan',
        model: 'Versa',
        year: 2023,
        category: 'economy',
        transmission: 'automatic',
        fuelType: 'gasoline',
        baseDailyRate: 35.99,
        dailyRate: 35.99,
        status: 'available',
        locationId: createdLocations[0].id, // LAX
        imageUrl: 'https://images.unsplash.com/photo-1619767886558-efdc259cde1a',
        description: 'Fuel-efficient and reliable economy car perfect for city driving.',
        seats: 5,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera']
      },
      {
        sku: 'ECAR-002',
        make: 'Chevrolet',
        model: 'Spark',
        year: 2023,
        category: 'economy',
        transmission: 'automatic',
        fuelType: 'gasoline',
        baseDailyRate: 32.99,
        dailyRate: 32.99,
        status: 'available',
        locationId: createdLocations[1].id, // DTLA
        imageUrl: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d',
        description: 'Compact and affordable car ideal for short trips.',
        seats: 4,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'Fuel Efficient']
      },
      {
        sku: 'ECAR-003',
        make: 'Hyundai',
        model: 'Accent',
        year: 2024,
        category: 'economy',
        transmission: 'automatic',
        fuelType: 'gasoline',
        baseDailyRate: 37.99,
        dailyRate: 37.99,
        status: 'rented',
        locationId: createdLocations[6].id, // SFO
        imageUrl: 'https://images.unsplash.com/photo-1583267746897-3e0c31c0f751',
        description: 'Modern economy car with great gas mileage.',
        seats: 5,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Apple CarPlay']
      },
      // Compact Cars
      {
        sku: 'CCAR-001',
        make: 'Toyota',
        model: 'Corolla',
        year: 2023,
        category: 'compact',
        transmission: 'automatic',
        fuelType: 'gasoline',
        baseDailyRate: 42.99,
        dailyRate: 42.99,
        status: 'available',
        locationId: createdLocations[2].id, // JFK
        imageUrl: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb',
        description: 'Reliable compact car with excellent fuel economy.',
        seats: 5,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Lane Keeping']
      },
      {
        sku: 'CCAR-002',
        make: 'Honda',
        model: 'Civic',
        year: 2024,
        category: 'compact',
        transmission: 'automatic',
        fuelType: 'gasoline',
        baseDailyRate: 45.99,
        dailyRate: 45.99,
        status: 'available',
        locationId: createdLocations[3].id, // NYC
        imageUrl: 'https://images.unsplash.com/photo-1590362891991-f776e747a588',
        description: 'Stylish and efficient compact car with modern features.',
        seats: 5,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Lane Keeping Assist', 'Adaptive Cruise']
      },
      {
        sku: 'CCAR-003',
        make: 'Mazda',
        model: 'Mazda3',
        year: 2023,
        category: 'compact',
        transmission: 'automatic',
        fuelType: 'gasoline',
        baseDailyRate: 44.99,
        dailyRate: 44.99,
        status: 'maintenance',
        locationId: createdLocations[7].id, // ORD
        imageUrl: 'https://images.unsplash.com/photo-1617654112368-307921291f42',
        description: 'Sporty compact with premium interior.',
        seats: 5,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Leather Seats']
      },
      // Midsize Cars
      {
        sku: 'MCAR-001',
        make: 'Toyota',
        model: 'Camry',
        year: 2024,
        category: 'midsize',
        transmission: 'automatic',
        fuelType: 'gasoline',
        baseDailyRate: 52.99,
        dailyRate: 52.99,
        status: 'available',
        locationId: createdLocations[4].id, // MIA
        imageUrl: 'https://images.unsplash.com/photo-1621135802920-133df287f89c',
        description: 'Spacious midsize sedan with premium comfort features.',
        seats: 5,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Heated Seats', 'Sunroof']
      },
      {
        sku: 'MCAR-002',
        make: 'Honda',
        model: 'Accord',
        year: 2024,
        category: 'midsize',
        transmission: 'automatic',
        fuelType: 'hybrid',
        baseDailyRate: 54.99,
        dailyRate: 54.99,
        status: 'available',
        locationId: createdLocations[5].id, // SBE
        imageUrl: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8',
        description: 'Hybrid midsize sedan with advanced safety features.',
        seats: 5,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Heated Seats', 'Adaptive Cruise Control', 'Hybrid']
      },
      {
        sku: 'MCAR-003',
        make: 'Nissan',
        model: 'Altima',
        year: 2023,
        category: 'midsize',
        transmission: 'automatic',
        fuelType: 'gasoline',
        baseDailyRate: 49.99,
        dailyRate: 49.99,
        status: 'reserved',
        locationId: createdLocations[0].id, // LAX
        imageUrl: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2',
        description: 'Comfortable midsize sedan for long trips.',
        seats: 5,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera']
      },
      // SUVs
      {
        sku: 'SUV-001',
        make: 'Ford',
        model: 'Explorer',
        year: 2023,
        category: 'suv',
        transmission: 'automatic',
        fuelType: 'gasoline',
        baseDailyRate: 72.99,
        dailyRate: 72.99,
        status: 'available',
        locationId: createdLocations[0].id, // LAX
        imageUrl: 'https://images.unsplash.com/photo-1619767886558-efdc259cde1a',
        description: 'Spacious 7-seater SUV perfect for family trips.',
        seats: 7,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Third Row Seating', '4WD', 'Towing Package']
      },
      {
        sku: 'SUV-002',
        make: 'Chevrolet',
        model: 'Tahoe',
        year: 2024,
        category: 'suv',
        transmission: 'automatic',
        fuelType: 'gasoline',
        baseDailyRate: 89.99,
        dailyRate: 89.99,
        status: 'available',
        locationId: createdLocations[2].id, // JFK
        imageUrl: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b',
        description: 'Full-size SUV with premium amenities and towing capacity.',
        seats: 8,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Third Row Seating', '4WD', 'Towing Package', 'Heated Seats']
      },
      {
        sku: 'SUV-003',
        make: 'Jeep',
        model: 'Grand Cherokee',
        year: 2024,
        category: 'suv',
        transmission: 'automatic',
        fuelType: 'gasoline',
        baseDailyRate: 79.99,
        dailyRate: 79.99,
        status: 'available',
        locationId: createdLocations[4].id, // MIA
        imageUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf',
        description: 'Rugged SUV with off-road capabilities.',
        seats: 5,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', '4WD', 'Navigation', 'Leather Seats']
      },
      {
        sku: 'SUV-004',
        make: 'Toyota',
        model: 'Highlander',
        year: 2024,
        category: 'suv',
        transmission: 'automatic',
        fuelType: 'hybrid',
        baseDailyRate: 76.99,
        dailyRate: 76.99,
        status: 'rented',
        locationId: createdLocations[6].id, // SFO
        imageUrl: 'https://images.unsplash.com/photo-1609521263047-f8f205293f24',
        description: 'Hybrid SUV with excellent fuel economy.',
        seats: 7,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Third Row Seating', 'Hybrid', 'Adaptive Cruise']
      },
      // Luxury Cars
      {
        sku: 'LUX-001',
        make: 'BMW',
        model: '3 Series',
        year: 2024,
        category: 'luxury',
        transmission: 'automatic',
        fuelType: 'gasoline',
        baseDailyRate: 95.99,
        dailyRate: 95.99,
        status: 'available',
        locationId: createdLocations[4].id, // MIA
        imageUrl: 'https://images.unsplash.com/photo-1555215695-3004980ad54e',
        description: 'Luxury sedan with premium interior and advanced technology.',
        seats: 5,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Leather Seats', 'Premium Sound System', 'Navigation', 'Sunroof']
      },
      {
        sku: 'LUX-002',
        make: 'Mercedes-Benz',
        model: 'C-Class',
        year: 2024,
        category: 'luxury',
        transmission: 'automatic',
        fuelType: 'gasoline',
        baseDailyRate: 98.99,
        dailyRate: 98.99,
        status: 'available',
        locationId: createdLocations[5].id, // SBE
        imageUrl: 'https://images.unsplash.com/photo-1617531653332-bd46c24f2068',
        description: 'Elegant luxury sedan with sophisticated design and comfort.',
        seats: 5,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Leather Seats', 'Premium Sound System', 'Navigation', 'Sunroof', 'Heated/Cooled Seats']
      },
      {
        sku: 'LUX-003',
        make: 'Audi',
        model: 'A4',
        year: 2024,
        category: 'luxury',
        transmission: 'automatic',
        fuelType: 'gasoline',
        baseDailyRate: 92.99,
        dailyRate: 92.99,
        status: 'available',
        locationId: createdLocations[3].id, // NYC
        imageUrl: 'https://images.unsplash.com/photo-1610768764270-790fbec18178',
        description: 'Sophisticated luxury sedan with Quattro AWD.',
        seats: 5,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Leather Seats', 'AWD', 'Virtual Cockpit', 'Matrix LED Headlights']
      },
      {
        sku: 'LUX-004',
        make: 'Tesla',
        model: 'Model 3',
        year: 2024,
        category: 'luxury',
        transmission: 'automatic',
        fuelType: 'electric',
        baseDailyRate: 102.99,
        dailyRate: 102.99,
        status: 'available',
        locationId: createdLocations[6].id, // SFO
        imageUrl: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89',
        description: 'Electric luxury sedan with autopilot features.',
        seats: 5,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Electric', 'Autopilot', 'Premium Sound', 'Navigation', 'Glass Roof']
      },
      // Vans
      {
        sku: 'VAN-001',
        make: 'Chrysler',
        model: 'Pacifica',
        year: 2023,
        category: 'van',
        transmission: 'automatic',
        fuelType: 'gasoline',
        baseDailyRate: 68.99,
        dailyRate: 68.99,
        status: 'available',
        locationId: createdLocations[7].id, // ORD
        imageUrl: 'https://images.unsplash.com/photo-1527786356703-4b100091cd2c',
        description: 'Family minivan with entertainment system.',
        seats: 7,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Rear Entertainment', 'Stow-n-Go Seats']
      },
      {
        sku: 'VAN-002',
        make: 'Honda',
        model: 'Odyssey',
        year: 2024,
        category: 'van',
        transmission: 'automatic',
        fuelType: 'gasoline',
        baseDailyRate: 71.99,
        dailyRate: 71.99,
        status: 'available',
        locationId: createdLocations[2].id, // JFK
        imageUrl: 'https://images.unsplash.com/photo-1464219789935-c2d9d9aba644',
        description: 'Premium minivan with advanced safety.',
        seats: 8,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Rear Entertainment', 'Power Sliding Doors', 'Adaptive Cruise']
      }
    ];

    const createdVehicles = [];
    for (const vehicleData of vehicles) {
      const vehicle = await prisma.vehicle.create({
        data: vehicleData
      });
      createdVehicles.push(vehicle);
    }
    console.log(`✅ ${createdVehicles.length} Vehicles created with varied statuses`);

    // Create comprehensive bookings with various statuses
    const bookings = [];
    
    // 1. Confirmed upcoming booking - John (Silver)
    let futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    let endDate = new Date(futureDate);
    endDate.setDate(endDate.getDate() + 3);
    const booking1 = await prisma.booking.create({
      data: {
        userId: customer1.id,
        vehicleId: createdVehicles[0].id, // Nissan Versa
        locationPickupId: createdLocations[0].id,
        locationDropoffId: createdLocations[1].id,
        startDate: futureDate,
        endDate: endDate,
        subtotal: 107.97,
        taxes: 9.72,
        fees: 5.00,
        totalPrice: 122.69,
        status: 'confirmed',
        paymentStatus: 'captured',
        notes: 'Airport pickup requested'
      }
    });
    bookings.push(booking1);
    await prisma.payment.create({
      data: {
        bookingId: booking1.id,
        amount: 122.69,
        method: 'credit_card',
        status: 'completed',
        providerId: 'ch_test_' + Math.random().toString(36).substr(2, 9)
      }
    });

    // 2. Active rental with GPS tracking - Jane (Gold)
    let activeStart = new Date();
    activeStart.setDate(activeStart.getDate() - 1);
    let activeEnd = new Date();
    activeEnd.setDate(activeEnd.getDate() + 2);
    const booking2 = await prisma.booking.create({
      data: {
        userId: customer2.id,
        vehicleId: createdVehicles[2].id, // Hyundai Accent (rented)
        locationPickupId: createdLocations[6].id, // SFO
        locationDropoffId: createdLocations[0].id, // LAX
        startDate: activeStart,
        endDate: activeEnd,
        subtotal: 113.97,
        taxes: 10.26,
        fees: 5.00,
        totalPrice: 129.23,
        status: 'active',
        paymentStatus: 'captured',
        addons: {
          tracking: {
            enabled: true,
            locations: [
              { lat: 37.7749, lng: -122.4194, speed: 45, heading: 90, accuracy: 10, timestamp: new Date(Date.now() - 3600000).toISOString() },
              { lat: 37.7849, lng: -122.4094, speed: 55, heading: 85, accuracy: 8, timestamp: new Date(Date.now() - 1800000).toISOString() },
              { lat: 37.7949, lng: -122.3994, speed: 60, heading: 80, accuracy: 12, timestamp: new Date().toISOString() }
            ],
            totalDistance: 8.5,
            alerts: []
          },
          pickupInspection: {
            photos: ['https://example.com/inspection1.jpg'],
            fuelLevel: 1.0,
            odometer: 15420,
            at: activeStart
          }
        }
      }
    });
    bookings.push(booking2);
    await prisma.payment.create({
      data: {
        bookingId: booking2.id,
        amount: 129.23,
        method: 'credit_card',
        status: 'completed',
        providerId: 'ch_test_' + Math.random().toString(36).substr(2, 9)
      }
    });

    // 3. Completed booking with loyalty points - John (Silver)
    let completedStart = new Date();
    completedStart.setDate(completedStart.getDate() - 15);
    let completedEnd = new Date(completedStart);
    completedEnd.setDate(completedEnd.getDate() + 5);
    const booking3 = await prisma.booking.create({
      data: {
        userId: customer1.id,
        vehicleId: createdVehicles[13].id, // BMW 3 Series
        locationPickupId: createdLocations[4].id,
        locationDropoffId: createdLocations[5].id,
        startDate: completedStart,
        endDate: completedEnd,
        subtotal: 479.95,
        taxes: 43.20,
        fees: 15.00,
        totalPrice: 538.15,
        status: 'completed',
        paymentStatus: 'captured',
        addons: {
          pickupInspection: {
            photos: ['https://example.com/pickup1.jpg'],
            fuelLevel: 1.0,
            odometer: 28500,
            at: completedStart
          },
          returnInspection: {
            photos: ['https://example.com/return1.jpg'],
            fuelLevel: 0.95,
            odometer: 28850,
            damage: false,
            damageCost: 0,
            calculations: {
              lateFee: 0,
              extraMileageCost: 0,
              fuelCost: 2.50,
              finalTotal: 540.65
            },
            at: completedEnd
          }
        }
      }
    });
    bookings.push(booking3);
    await prisma.payment.create({
      data: {
        bookingId: booking3.id,
        amount: 540.65,
        method: 'credit_card',
        status: 'completed',
        providerId: 'ch_test_' + Math.random().toString(36).substr(2, 9)
      }
    });

    // 4. Active rental with SOS - Mike (Platinum)
    let sosStart = new Date();
    sosStart.setDate(sosStart.getDate() - 2);
    let sosEnd = new Date();
    sosEnd.setDate(sosEnd.getDate() + 1);
    const booking4 = await prisma.booking.create({
      data: {
        userId: customer3.id,
        vehicleId: createdVehicles[11].id, // Toyota Highlander (rented)
        locationPickupId: createdLocations[6].id,
        locationDropoffId: createdLocations[6].id,
        startDate: sosStart,
        endDate: sosEnd,
        subtotal: 230.97,
        taxes: 20.79,
        fees: 10.00,
        totalPrice: 261.76,
        status: 'active',
        paymentStatus: 'captured',
        addons: {
          sosRequests: [
            {
              at: new Date(Date.now() - 7200000),
              note: 'Flat tire on Highway 101',
              location: '37.4419° N, 122.1430° W',
              status: 'dispatched'
            }
          ],
          tracking: {
            enabled: true,
            locations: [
              { lat: 37.4419, lng: -122.1430, speed: 0, heading: 0, accuracy: 5, timestamp: new Date(Date.now() - 7200000).toISOString() }
            ],
            totalDistance: 45.2,
            alerts: [
              {
                type: 'sos',
                message: 'Emergency assistance requested',
                timestamp: new Date(Date.now() - 7200000).toISOString()
              }
            ]
          }
        }
      }
    });
    bookings.push(booking4);
    await prisma.payment.create({
      data: {
        bookingId: booking4.id,
        amount: 261.76,
        method: 'credit_card',
        status: 'completed',
        providerId: 'ch_test_' + Math.random().toString(36).substr(2, 9)
      }
    });

    // 5. Pending booking awaiting payment - Sarah (Bronze)
    let pendingDate = new Date();
    pendingDate.setDate(pendingDate.getDate() + 14);
    let pendingEnd = new Date(pendingDate);
    pendingEnd.setDate(pendingEnd.getDate() + 7);
    const booking5 = await prisma.booking.create({
      data: {
        userId: customer4.id,
        vehicleId: createdVehicles[7].id, // Honda Accord
        locationPickupId: createdLocations[5].id,
        locationDropoffId: createdLocations[4].id,
        startDate: pendingDate,
        endDate: pendingEnd,
        subtotal: 384.93,
        taxes: 34.64,
        fees: 20.00,
        totalPrice: 439.57,
        status: 'pending',
        paymentStatus: 'pending'
      }
    });
    bookings.push(booking5);

    // 6. Reserved booking (checked in) - Jane (Gold)
    let reservedDate = new Date();
    reservedDate.setDate(reservedDate.getDate() + 2);
    let reservedEnd = new Date(reservedDate);
    reservedEnd.setDate(reservedEnd.getDate() + 4);
    const booking6 = await prisma.booking.create({
      data: {
        userId: customer2.id,
        vehicleId: createdVehicles[8].id, // Nissan Altima (reserved)
        locationPickupId: createdLocations[0].id,
        locationDropoffId: createdLocations[0].id,
        startDate: reservedDate,
        endDate: reservedEnd,
        subtotal: 199.96,
        taxes: 18.00,
        fees: 10.00,
        totalPrice: 227.96,
        status: 'reserved',
        paymentStatus: 'captured',
        addons: {
          checkin: {
            documents: ['license.jpg', 'insurance.jpg'],
            agreementSigned: true,
            qrCode: `QR-${Date.now()}-12345`,
            at: new Date()
          }
        }
      }
    });
    bookings.push(booking6);
    await prisma.payment.create({
      data: {
        bookingId: booking6.id,
        amount: 227.96,
        method: 'debit_card',
        status: 'completed',
        providerId: 'ch_test_' + Math.random().toString(36).substr(2, 9)
      }
    });

    // 7. Cancelled booking with refund - Sarah (Bronze)
    let cancelledDate = new Date();
    cancelledDate.setDate(cancelledDate.getDate() + 5);
    const booking7 = await prisma.booking.create({
      data: {
        userId: customer4.id,
        vehicleId: createdVehicles[5].id, // Honda Civic
        locationPickupId: createdLocations[3].id,
        locationDropoffId: createdLocations[3].id,
        startDate: cancelledDate,
        endDate: new Date(cancelledDate.getTime() + 2 * 24 * 60 * 60 * 1000),
        subtotal: 91.98,
        taxes: 8.28,
        fees: 5.00,
        totalPrice: 105.26,
        status: 'cancelled',
        paymentStatus: 'refunded',
        notes: 'Cancelled - Change of plans'
      }
    });
    bookings.push(booking7);
    await prisma.payment.create({
      data: {
        bookingId: booking7.id,
        amount: 105.26,
        method: 'credit_card',
        status: 'refunded',
        providerId: 'ch_test_' + Math.random().toString(36).substr(2, 9)
      }
    });

    // 8. Completed luxury booking - Mike (Platinum)
    let luxuryStart = new Date();
    luxuryStart.setDate(luxuryStart.getDate() - 20);
    let luxuryEnd = new Date(luxuryStart);
    luxuryEnd.setDate(luxuryEnd.getDate() + 3);
    const booking8 = await prisma.booking.create({
      data: {
        userId: customer3.id,
        vehicleId: createdVehicles[14].id, // Mercedes E-Class
        locationPickupId: createdLocations[2].id,
        locationDropoffId: createdLocations[3].id,
        startDate: luxuryStart,
        endDate: luxuryEnd,
        subtotal: 299.97,
        taxes: 27.00,
        fees: 15.00,
        totalPrice: 341.97,
        status: 'completed',
        paymentStatus: 'captured'
      }
    });
    bookings.push(booking8);
    await prisma.payment.create({
      data: {
        bookingId: booking8.id,
        amount: 341.97,
        method: 'credit_card',
        status: 'completed',
        providerId: 'ch_test_' + Math.random().toString(36).substr(2, 9)
      }
    });

    console.log(`✅ ${bookings.length} Bookings created with various statuses`);

    // Create reviews for completed bookings
    await prisma.review.create({
      data: {
        userId: customer1.id,
        vehicleId: createdVehicles[13].id, // BMW 3 Series
        rating: 5,
        comment: 'Absolutely loved the BMW! Smooth ride, luxurious interior, and great performance. Will definitely rent again.'
      }
    });

    await prisma.review.create({
      data: {
        userId: customer3.id,
        vehicleId: createdVehicles[14].id, // Mercedes E-Class
        rating: 5,
        comment: 'Mercedes was in perfect condition. The service was excellent and the car exceeded expectations!'
      }
    });

    await prisma.review.create({
      data: {
        userId: customer2.id,
        vehicleId: createdVehicles[5].id, // Honda Civic
        rating: 4,
        comment: 'Great compact car for city driving. Clean and reliable. Only wish it had a bit more trunk space.'
      }
    });

    console.log('✅ Sample reviews created');

    // Create maintenance tasks for vehicles in maintenance status
    await prisma.maintenanceTask.create({
      data: {
        vehicleId: createdVehicles[6].id, // Mazda3 (in maintenance)
        type: 'service',
        description: 'Regular 5,000 mile oil change and filter replacement',
        scheduledAt: new Date(),
        status: 'in_progress',
        assignedTo: 'Mike Johnson',
        cost: 75.00,
        mileage: 45320,
        notes: 'Also check tire pressure and fluid levels'
      }
    });

    console.log('✅ Maintenance tasks created');

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📝 Sample Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin Account:');
    console.log('  Email: admin@carhive.com');
    console.log('  Password: admin123');
    console.log('  Role: admin');
    console.log('  Phone: +15551234567');
    console.log('\nCustomer Accounts:');
    console.log('  1. John Doe (Silver Tier - 1500 points)');
    console.log('     Email: john.doe@example.com');
    console.log('     Password: customer123');
    console.log('     Phone: +15555551111');
    console.log('\n  2. Jane Smith (Gold Tier - 6500 points)');
    console.log('     Email: jane.smith@example.com');
    console.log('     Password: customer123');
    console.log('     Phone: +15555551234');
    console.log('\n  3. Mike Wilson (Platinum Tier - 12000 points)');
    console.log('     Email: mike.wilson@example.com');
    console.log('     Password: customer123');
    console.log('     Phone: +15555559876');
    console.log('\n  4. Sarah Johnson (Bronze Tier - 450 points)');
    console.log('     Email: sarah.johnson@example.com');
    console.log('     Password: customer123');
    console.log('     Phone: +15555556789');
    console.log('\n📊 Seeded Data Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  • 5 Users (1 admin + 4 customers)');
    console.log('  • 8 Locations (LAX, DTLA, JFK, NYC, MIA, SBE, SFO, ORD)');
    console.log('  • 20 Vehicles (6 categories, varied statuses)');
    console.log('  • 8 Bookings (pending, confirmed, active, completed, cancelled)');
    console.log('  • 8 Payments (completed, pending, refunded)');
    console.log('  • 3 Reviews (4-5 star ratings)');
    console.log('  • 1 Maintenance Task (in-progress oil change)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });