import { UserRole, UserStatus, Gender } from '@prisma/client';
import bcrypt from 'bcryptjs';
import prisma from '../packages/libs/prisma';

async function main() {
  console.log('🌱 Starting database seeding...\n');

  try {
    // =================================
    // 1. CREATE ADMIN USER
    // =================================
    console.log('👤 Creating admin user...');

    const adminEmail = 'admin@travel-utility.com';
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    let adminUser;
    if (existingAdmin) {
      console.log('   ℹ️  Admin user already exists, skipping...');
      adminUser = existingAdmin;
    } else {
      const hashedPassword = await bcrypt.hash('Admin@123', 12);
      adminUser = await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          fullName: 'System Administrator',
          firstName: 'System',
          lastName: 'Administrator',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          isEmailVerified: true,
          emailVerified: true,
          gender: Gender.PREFER_NOT_TO_SAY,
          age: 30,
        },
      });
      console.log(`   ✅ Admin user created: ${adminUser.email}`);
    }

    // =================================
    // 2. CREATE SAMPLE COUNTIES
    // =================================
    console.log('\n🏛️  Creating sample counties...');

    const counties = [
      {
        name: 'Los Angeles County',
        state: 'California',
        country: 'United States',
        slug: 'los-angeles-california',
        description:
          'Los Angeles County, officially the County of Los Angeles, is the most populous county in the United States. Home to over 10 million residents, it encompasses 88 incorporated cities including Los Angeles, Long Beach, and Pasadena.',
        coverImage:
          'https://images.unsplash.com/photo-1534190239940-9ba8944ea261?auto=format&fit=crop&w=1200',
        population: 10014009,
        coordinates: {
          lat: 34.0522,
          lng: -118.2437,
        },
        timezone: 'America/Los_Angeles',
        metadata: {
          area: '4,083 sq mi',
          founded: '1850',
          website: 'https://www.lacounty.gov',
        },
        isActive: true,
      },
      {
        name: 'Cook County',
        state: 'Illinois',
        country: 'United States',
        slug: 'cook-illinois',
        description:
          'Cook County is the most populous county in Illinois and the second-most-populous county in the United States. It includes the city of Chicago, the third-largest city in the United States.',
        coverImage:
          'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1200',
        population: 5275541,
        coordinates: {
          lat: 41.8781,
          lng: -87.6298,
        },
        timezone: 'America/Chicago',
        metadata: {
          area: '1,635 sq mi',
          founded: '1831',
          website: 'https://www.cookcountyil.gov',
        },
        isActive: true,
      },
      {
        name: 'Harris County',
        state: 'Texas',
        country: 'United States',
        slug: 'harris-texas',
        description:
          'Harris County is the most populous county in Texas and the third-most populous county in the United States. The county seat is Houston, the most populous city in Texas.',
        coverImage:
          'https://images.unsplash.com/photo-1575989323656-abb3db07a43d?auto=format&fit=crop&w=1200',
        population: 4731145,
        coordinates: {
          lat: 29.7604,
          lng: -95.3698,
        },
        timezone: 'America/Chicago',
        metadata: {
          area: '1,777 sq mi',
          founded: '1836',
          website: 'https://www.hctx.net',
        },
        isActive: true,
      },
      {
        name: 'Maricopa County',
        state: 'Arizona',
        country: 'United States',
        slug: 'maricopa-arizona',
        description:
          'Maricopa County is the most populous county in Arizona. The county seat is Phoenix, the state capital and fifth-most populous city in the United States.',
        coverImage:
          'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200',
        population: 4485414,
        coordinates: {
          lat: 33.4484,
          lng: -112.074,
        },
        timezone: 'America/Phoenix',
        metadata: {
          area: '9,224 sq mi',
          founded: '1871',
          website: 'https://www.maricopa.gov',
        },
        isActive: true,
      },
      {
        name: 'San Diego County',
        state: 'California',
        country: 'United States',
        slug: 'san-diego-california',
        description:
          'San Diego County is a county in the southwestern corner of California. As of 2020, the population was 3,298,634, making it the second-most populous county in California and the fifth-most populous in the United States.',
        coverImage:
          'https://images.unsplash.com/photo-1583874225481-e85acb25c3d1?auto=format&fit=crop&w=1200',
        population: 3298634,
        coordinates: {
          lat: 32.7157,
          lng: -117.1611,
        },
        timezone: 'America/Los_Angeles',
        metadata: {
          area: '4,526 sq mi',
          founded: '1850',
          website: 'https://www.sandiegocounty.gov',
        },
        isActive: true,
      },
      {
        name: 'Orange County',
        state: 'California',
        country: 'United States',
        slug: 'orange-california',
        description:
          'Orange County is located in the Los Angeles metropolitan area in Southern California. As of the 2020 census, the population was 3,186,989, making it the third-most-populous county in California.',
        coverImage:
          'https://images.unsplash.com/photo-1580655653885-65763b2597d0?auto=format&fit=crop&w=1200',
        population: 3186989,
        coordinates: {
          lat: 33.7175,
          lng: -117.8311,
        },
        timezone: 'America/Los_Angeles',
        metadata: {
          area: '948 sq mi',
          founded: '1889',
          website: 'https://www.ocgov.com',
        },
        isActive: true,
      },
      {
        name: 'Miami-Dade County',
        state: 'Florida',
        country: 'United States',
        slug: 'miami-dade-florida',
        description:
          'Miami-Dade County is the most populous county in Florida and the seventh-most populous county in the United States. It includes the city of Miami, the largest city in South Florida.',
        coverImage:
          'https://images.unsplash.com/photo-1506966183522-2440e38b9a5d?auto=format&fit=crop&w=1200',
        population: 2716940,
        coordinates: {
          lat: 25.7617,
          lng: -80.1918,
        },
        timezone: 'America/New_York',
        metadata: {
          area: '2,431 sq mi',
          founded: '1836',
          website: 'https://www.miamidade.gov',
        },
        isActive: true,
      },
      {
        name: 'Kings County',
        state: 'New York',
        country: 'United States',
        slug: 'kings-new-york',
        description:
          'Kings County, coextensive with the New York City borough of Brooklyn, is the most populous county in New York State and the second-most densely populated county in the United States.',
        coverImage:
          'https://images.unsplash.com/photo-1541336032412-2048a678540d?auto=format&fit=crop&w=1200',
        population: 2736074,
        coordinates: {
          lat: 40.6782,
          lng: -73.9442,
        },
        timezone: 'America/New_York',
        metadata: {
          area: '97 sq mi',
          founded: '1683',
          website: 'https://www.brooklyn-usa.org',
        },
        isActive: true,
      },
      {
        name: 'Clark County',
        state: 'Nevada',
        country: 'United States',
        slug: 'clark-nevada',
        description:
          'Clark County is located in the southeastern corner of Nevada. It is the most populous county in Nevada, accounting for nearly three-quarters of its residents. Las Vegas, the state\'s most populous city, has been the county seat since 1909.',
        coverImage:
          'https://images.unsplash.com/photo-1605833556294-ea5a4c16b5f6?auto=format&fit=crop&w=1200',
        population: 2265461,
        coordinates: {
          lat: 36.1699,
          lng: -115.1398,
        },
        timezone: 'America/Los_Angeles',
        metadata: {
          area: '8,061 sq mi',
          founded: '1909',
          website: 'https://www.clarkcountynv.gov',
        },
        isActive: true,
      },
      {
        name: 'King County',
        state: 'Washington',
        country: 'United States',
        slug: 'king-washington',
        description:
          'King County is located in the U.S. state of Washington. The population was 2,269,675 in 2020, making it the most populous county in Washington and the 12th-most populous in the United States. The county seat is Seattle.',
        coverImage:
          'https://images.unsplash.com/photo-1555083307-2f0b8fab6e23?auto=format&fit=crop&w=1200',
        population: 2269675,
        coordinates: {
          lat: 47.6062,
          lng: -122.3321,
        },
        timezone: 'America/Los_Angeles',
        metadata: {
          area: '2,307 sq mi',
          founded: '1852',
          website: 'https://www.kingcounty.gov',
        },
        isActive: true,
      },
    ];

    let createdCount = 0;
    let skippedCount = 0;

    for (const countyData of counties) {
      const existing = await prisma.county.findFirst({
        where: {
          OR: [{ slug: countyData.slug }, { name: countyData.name }],
        },
      });

      if (existing) {
        console.log(`   ℹ️  County "${countyData.name}" already exists, skipping...`);
        skippedCount++;
      } else {
        await prisma.county.create({
          data: {
            ...countyData,
            createdBy: adminUser.id,
          },
        });
        console.log(`   ✅ Created: ${countyData.name}, ${countyData.state}`);
        createdCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   • Counties created: ${createdCount}`);
    console.log(`   • Counties skipped: ${skippedCount}`);
    console.log(`   • Total counties: ${createdCount + skippedCount}`);

    console.log('\n✅ Database seeding completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
