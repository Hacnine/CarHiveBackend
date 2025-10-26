const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@carhive.com' },
      update: {},
      create: {
        name: 'CarHive Admin',
        email: 'admin@carhive.com',
        passwordHash: adminPassword,
        phone: '(555) 123-4567',
        role: 'admin'
      }
    });
    console.log('✅ Admin user created');

    // Create sample customer
    const customerPassword = await bcrypt.hash('customer123', 12);
    const customer = await prisma.user.upsert({
      where: { email: 'john.doe@example.com' },
      update: {},
      create: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        passwordHash: customerPassword,
        phone: '(555) 987-6543',
        role: 'customer'
      }
    });
    console.log('✅ Sample customer created');

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
        phone: '(310) 646-5252',
        hours: '24/7'
      },
      {
        name: 'Downtown Los Angeles',
        code: 'DTLA',
        address: '123 S Hope St, Los Angeles, CA 90012',
        type: 'city',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90012',
        phone: '(213) 555-0123',
        hours: 'Mon-Sun: 6:00 AM - 10:00 PM'
      },
      {
        name: 'John F. Kennedy International Airport',
        code: 'JFK',
        address: 'Queens, NY 11430',
        type: 'airport',
        city: 'New York',
        state: 'NY',
        zipCode: '11430',
        phone: '(718) 244-4444',
        hours: '24/7'
      },
      {
        name: 'Manhattan Midtown',
        code: 'NYC',
        address: '234 W 42nd St, New York, NY 10036',
        type: 'city',
        city: 'New York',
        state: 'NY',
        zipCode: '10036',
        phone: '(212) 555-0156',
        hours: 'Mon-Sun: 7:00 AM - 9:00 PM'
      },
      {
        name: 'Miami International Airport',
        code: 'MIA',
        address: '2100 NW 42nd Ave, Miami, FL 33126',
        type: 'airport',
        city: 'Miami',
        state: 'FL',
        zipCode: '33126',
        phone: '(305) 876-7000',
        hours: '24/7'
      },
      {
        name: 'South Beach',
        code: 'SBE',
        address: '1234 Ocean Dr, Miami Beach, FL 33139',
        type: 'city',
        city: 'Miami Beach',
        state: 'FL',
        zipCode: '33139',
        phone: '(305) 555-0189',
        hours: 'Mon-Sun: 8:00 AM - 8:00 PM'
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

    // Create vehicles
    const vehicles = [
      // Economy Cars
      {
        make: 'Nissan',
        model: 'Versa',
        year: 2023,
        type: 'economy',
        transmission: 'automatic',
        fuelType: 'gasoline',
        dailyRate: 35.99,
        locationId: createdLocations[0].id, // LAX
        imageUrl: 'https://example.com/nissan-versa.jpg',
        description: 'Fuel-efficient and reliable economy car perfect for city driving.',
        seats: 5,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports']
      },
      {
        make: 'Chevrolet',
        model: 'Spark',
        year: 2023,
        type: 'economy',
        transmission: 'automatic',
        fuelType: 'gasoline',
        dailyRate: 32.99,
        locationId: createdLocations[1].id, // DTLA
        imageUrl: 'https://example.com/chevrolet-spark.jpg',
        description: 'Compact and affordable car ideal for short trips.',
        seats: 4,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth']
      },
      // Compact Cars
      {
        make: 'Toyota',
        model: 'Corolla',
        year: 2023,
        type: 'compact',
        transmission: 'automatic',
        fuelType: 'gasoline',
        dailyRate: 42.99,
        locationId: createdLocations[2].id, // JFK
        imageUrl: 'https://example.com/toyota-corolla.jpg',
        description: 'Reliable compact car with excellent fuel economy.',
        seats: 5,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera']
      },
      {
        make: 'Honda',
        model: 'Civic',
        year: 2023,
        type: 'compact',
        transmission: 'automatic',
        fuelType: 'gasoline',
        dailyRate: 45.99,
        locationId: createdLocations[3].id, // NYC
        imageUrl: 'https://example.com/honda-civic.jpg',
        description: 'Stylish and efficient compact car with modern features.',
        seats: 5,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Lane Keeping Assist']
      },
      // Midsize Cars
      {
        make: 'Toyota',
        model: 'Camry',
        year: 2023,
        type: 'midsize',
        transmission: 'automatic',
        fuelType: 'gasoline',
        dailyRate: 52.99,
        locationId: createdLocations[4].id, // MIA
        imageUrl: 'https://example.com/toyota-camry.jpg',
        description: 'Spacious midsize sedan with premium comfort features.',
        seats: 5,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Heated Seats']
      },
      {
        make: 'Honda',
        model: 'Accord',
        year: 2023,
        type: 'midsize',
        transmission: 'automatic',
        fuelType: 'gasoline',
        dailyRate: 54.99,
        locationId: createdLocations[5].id, // SBE
        imageUrl: 'https://example.com/honda-accord.jpg',
        description: 'Premium midsize sedan with advanced safety features.',
        seats: 5,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Heated Seats', 'Adaptive Cruise Control']
      },
      // SUVs
      {
        make: 'Ford',
        model: 'Explorer',
        year: 2023,
        type: 'suv',
        transmission: 'automatic',
        fuelType: 'gasoline',
        dailyRate: 72.99,
        locationId: createdLocations[0].id, // LAX
        imageUrl: 'https://example.com/ford-explorer.jpg',
        description: 'Spacious 7-seater SUV perfect for family trips.',
        seats: 7,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Third Row Seating', '4WD']
      },
      {
        make: 'Chevrolet',
        model: 'Tahoe',
        year: 2023,
        type: 'suv',
        transmission: 'automatic',
        fuelType: 'gasoline',
        dailyRate: 89.99,
        locationId: createdLocations[2].id, // JFK
        imageUrl: 'https://example.com/chevrolet-tahoe.jpg',
        description: 'Full-size SUV with premium amenities and towing capacity.',
        seats: 8,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Third Row Seating', '4WD', 'Towing Package']
      },
      // Luxury Cars
      {
        make: 'BMW',
        model: '3 Series',
        year: 2023,
        type: 'luxury',
        transmission: 'automatic',
        fuelType: 'gasoline',
        dailyRate: 95.99,
        locationId: createdLocations[4].id, // MIA
        imageUrl: 'https://example.com/bmw-3series.jpg',
        description: 'Luxury sedan with premium interior and advanced technology.',
        seats: 5,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Leather Seats', 'Premium Sound System', 'Navigation']
      },
      {
        make: 'Mercedes-Benz',
        model: 'C-Class',
        year: 2023,
        type: 'luxury',
        transmission: 'automatic',
        fuelType: 'gasoline',
        dailyRate: 98.99,
        locationId: createdLocations[5].id, // SBE
        imageUrl: 'https://example.com/mercedes-c-class.jpg',
        description: 'Elegant luxury sedan with sophisticated design and comfort.',
        seats: 5,
        doors: 4,
        features: ['Air Conditioning', 'Bluetooth', 'USB Ports', 'Backup Camera', 'Leather Seats', 'Premium Sound System', 'Navigation', 'Sunroof']
      }
    ];

    const createdVehicles = [];
    for (const vehicleData of vehicles) {
      const vehicle = await prisma.vehicle.create({
        data: vehicleData
      });
      createdVehicles.push(vehicle);
    }
    console.log('✅ Vehicles created');

    // Create sample bookings
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const endDate = new Date(futureDate);
    endDate.setDate(endDate.getDate() + 3);

    const sampleBooking = await prisma.booking.create({
      data: {
        userId: customer.id,
        vehicleId: createdVehicles[0].id,
        locationPickupId: createdLocations[0].id,
        locationDropoffId: createdLocations[1].id,
        startDate: futureDate,
        endDate: endDate,
        totalPrice: 107.97, // 3 days * $35.99
        status: 'confirmed',
        notes: 'Sample booking for testing purposes'
      }
    });
    console.log('✅ Sample booking created');

    // Create sample payment
    await prisma.payment.create({
      data: {
        bookingId: sampleBooking.id,
        amount: 107.97,
        method: 'credit_card',
        status: 'completed',
        transactionId: 'tx_sample_12345'
      }
    });
    console.log('✅ Sample payment created');

    // Create completed booking for review
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);
    const pastEndDate = new Date(pastDate);
    pastEndDate.setDate(pastEndDate.getDate() + 2);

    const completedBooking = await prisma.booking.create({
      data: {
        userId: customer.id,
        vehicleId: createdVehicles[2].id,
        locationPickupId: createdLocations[2].id,
        locationDropoffId: createdLocations[2].id,
        startDate: pastDate,
        endDate: pastEndDate,
        totalPrice: 85.98, // 2 days * $42.99
        status: 'completed'
      }
    });

    // Create sample review
    await prisma.review.create({
      data: {
        userId: customer.id,
        vehicleId: createdVehicles[2].id,
        rating: 5,
        comment: 'Excellent car! Very clean and reliable. The Toyota Corolla was perfect for my business trip to NYC.'
      }
    });
    console.log('✅ Sample review created');

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📝 Sample Credentials:');
    console.log('Admin: admin@carhive.com / admin123');
    console.log('Customer: john.doe@example.com / customer123');

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