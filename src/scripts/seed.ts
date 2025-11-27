import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Starting database seeding...');

  try {
    // Crear eventos de prueba
    const events = [
      {
        name: 'BMX World Championship 2024',
        date: new Date('2024-06-15'),
        location: 'Madrid, Spain',
        details: 'The biggest BMX event of the year featuring the best riders from around the world.',
        city: 'Madrid',
        country: 'Spain',
        continent: 'Europe',
        dates_text: 'June 15-17, 2024'
      },
      {
        name: 'USA BMX National Series',
        date: new Date('2024-07-20'),
        location: 'Los Angeles, CA',
        details: 'National BMX competition featuring top American riders.',
        city: 'Los Angeles',
        country: 'USA',
        continent: 'North America',
        dates_text: 'July 20-22, 2024'
      },
      {
        name: 'European BMX Cup',
        date: new Date('2024-08-10'),
        location: 'Paris, France',
        details: 'European championship with riders from across the continent.',
        city: 'Paris',
        country: 'France',
        continent: 'Europe',
        dates_text: 'August 10-12, 2024'
      },
      {
        name: 'BMX Freestyle Competition',
        date: new Date('2024-09-05'),
        location: 'Barcelona, Spain',
        details: 'Freestyle BMX competition showcasing creative riding.',
        city: 'Barcelona',
        country: 'Spain',
        continent: 'Europe',
        dates_text: 'September 5-7, 2024'
      }
    ];

    console.log('📅 Creating events...');
    for (const eventData of events) {
      const event = await prisma.event.create({
        data: eventData
      });
      console.log(`✅ Created event: ${event.name}`);
    }

    // Crear noticias de prueba
    const news = [
      {
        title: 'BMX World Championship Announces New Venue',
        content: 'The BMX World Championship has announced that Madrid will host the 2024 event, featuring state-of-the-art facilities.',
        author: 'BMX News Team',
        publishedAt: new Date('2024-01-15'),
        category: 'Competition',
        excerpt: 'Madrid selected as host city for 2024 BMX World Championship.'
      },
      {
        title: 'New BMX Training Facility Opens in Los Angeles',
        content: 'A new world-class BMX training facility has opened in Los Angeles, providing riders with access to professional-grade equipment.',
        author: 'Sports Reporter',
        publishedAt: new Date('2024-01-20'),
        category: 'Facilities',
        excerpt: 'Professional BMX training facility opens in Los Angeles.'
      },
      {
        title: 'European BMX Cup Registration Now Open',
        content: 'Registration for the European BMX Cup is now open. Riders from across Europe are encouraged to apply.',
        author: 'Event Coordinator',
        publishedAt: new Date('2024-01-25'),
        category: 'Events',
        excerpt: 'Registration opens for European BMX Cup competition.'
      }
    ];

    console.log('📰 Creating news...');
    for (const newsData of news) {
      const newsItem = await prisma.news.create({
        data: newsData
      });
      console.log(`✅ Created news: ${newsItem.title}`);
    }

    console.log('🎉 Database seeding completed successfully!');
    console.log(`📊 Created ${events.length} events and ${news.length} news items`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
