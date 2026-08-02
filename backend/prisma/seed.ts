import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create Admin User
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ipl.com' },
    update: {},
    create: {
      email: 'admin@ipl.com',
      name: 'IPL Admin',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  // Create Wankhede Stadium
  const stadium = await prisma.stadium.create({
    data: {
      name: 'Wankhede Stadium',
      location: 'Churchgate',
      city: 'Mumbai',
    },
  });

  const stands = ['North', 'NE', 'East', 'SE', 'South', 'SW', 'West', 'NW'];
  const blocks = ['Lower', 'Upper']; // Lower is closer to pitch

  // Create Seat Layout
  const layout = await prisma.seatLayout.create({
    data: {
      stadiumId: stadium.id,
      name: 'Mega Circular Layout 10k',
      rows: 25,
      cols: 25,
      config: JSON.stringify({ stands, blocks }),
    },
  });

  // Create Match
  const match = await prisma.match.create({
    data: {
      stadiumId: stadium.id,
      layoutId: layout.id,
      homeTeam: 'Mumbai Indians',
      awayTeam: 'Chennai Super Kings',
      matchDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
      basePrice: 1500,
    },
  });

  // Create 10,000 Seats for the match
  // 8 stands * 2 blocks * 25 rows * 25 cols = 10,000 seats exactly
  const seatsData = [];
  const maxRows = 25;
  const maxCols = 25;
  
  for (const stand of stands) {
    for (const block of blocks) {
      const sectionName = `${stand}-${block}`;
      const isLower = block === 'Lower';
      const blockPremium = isLower ? 1500 : 0; // Lower block is more expensive
      
      for (let r = 1; r <= maxRows; r++) {
        for (let c = 1; c <= maxCols; c++) {
          // Within the block, closer rows (lower number) are slightly more expensive
          const rowPremium = (maxRows - r) * 10;
          const price = match.basePrice + blockPremium + rowPremium;
          
          seatsData.push({
            matchId: match.id,
            row: r,
            col: c,
            section: sectionName,
            price: price,
            status: 'AVAILABLE',
          });
        }
      }
    }
  }

  // Insert in batches since 10k might be large for a single insert in SQLite
  const chunkSize = 2000;
  for (let i = 0; i < seatsData.length; i += chunkSize) {
    const chunk = seatsData.slice(i, i + chunkSize);
    await prisma.matchSeat.createMany({
      data: chunk,
    });
    console.log(`Inserted chunk ${i / chunkSize + 1} of ${Math.ceil(seatsData.length / chunkSize)}`);
  }

  console.log('Database seeded successfully with 10,000 seats!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
