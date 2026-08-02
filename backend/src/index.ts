import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

dotenv.config();

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(helmet());
app.use(cors());
app.use(express.json());

// --- MIDDLEWARE ---

const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Authentication required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    (req as any).user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const authorize = (roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user || !roles.includes(user.role)) return res.status(403).json({ message: 'Forbidden' });
  next();
};

// --- AUTH ROUTES ---

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hashedPassword, name } });
    res.status(201).json({ message: 'User created', userId: user.id });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/auth/profile', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: (req as any).user.userId },
    select: { id: true, email: true, name: true, role: true },
  });
  res.json(user);
});

// --- MATCH ROUTES ---

app.get('/api/matches', async (req, res) => {
  const matches = await prisma.match.findMany({ include: { stadium: true }, where: { deletedAt: null } });
  res.json(matches);
});

app.get('/api/matches/:id', async (req, res) => {
  const match = await prisma.match.findUnique({
    where: { id: req.params.id },
    include: { stadium: true, layout: true },
  });
  if (!match) return res.status(404).json({ message: 'Match not found' });
  res.json(match);
});

app.get('/api/matches/:id/seats', async (req, res) => {
  const seats = await prisma.matchSeat.findMany({ where: { matchId: req.params.id } });
  res.json(seats);
});

app.post('/api/matches/:id/hold', authenticate, async (req, res) => {
  try {
    const { seatId } = req.body;
    const userId = (req as any).user.userId;

    const seat = await prisma.$transaction(async (tx) => {
      const currentSeat = await tx.matchSeat.findUnique({ where: { id: seatId } });
      if (!currentSeat || currentSeat.status === 'SOLD') throw new Error('Seat not available');
      if (currentSeat.status === 'HELD' && currentSeat.heldUntil && currentSeat.heldUntil > new Date() && currentSeat.heldBy !== userId) {
        throw new Error('Seat already held');
      }

      return tx.matchSeat.update({
        where: { id: seatId },
        data: { status: 'HELD', heldBy: userId, heldUntil: new Date(Date.now() + 5 * 60 * 1000) },
      });
    });

    io.to(`match-${req.params.id}`).emit('seat-held', { seatId, userId });
    res.json({ message: 'Seat held', seat });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// --- BOOKING ROUTES ---

app.post('/api/bookings', authenticate, async (req, res) => {
  try {
    const { matchId, seatIds, paymentMethod } = req.body;
    const userId = (req as any).user.userId;

    const booking = await prisma.$transaction(async (tx) => {
      const seats = await tx.matchSeat.findMany({ where: { id: { in: seatIds }, matchId } });
      if (seats.length !== seatIds.length) throw new Error('Seats not found');

      for (const seat of seats) {
        if (seat.status === 'SOLD') throw new Error(`Seat ${seat.row}-${seat.col} sold`);
        if (seat.status === 'HELD' && seat.heldBy !== userId && seat.heldUntil && seat.heldUntil > new Date()) {
          throw new Error(`Seat ${seat.row}-${seat.col} held by another`);
        }
      }

      const totalAmount = seats.reduce((acc, s) => acc + s.price, 0);
      const newBooking = await tx.booking.create({
        data: { userId, matchId, totalAmount, status: 'CONFIRMED', seats: { connect: seatIds.map((id: string) => ({ id })) } },
      });

      await tx.matchSeat.updateMany({
        where: { id: { in: seatIds } },
        data: { status: 'SOLD', bookingId: newBooking.id, heldBy: null, heldUntil: null },
      });

      await tx.payment.create({ data: { bookingId: newBooking.id, amount: totalAmount, method: paymentMethod || 'CARD', status: 'SUCCESS' } });
      return newBooking;
    });

    seatIds.forEach((seatId: string) => io.to(`match-${matchId}`).emit('seat-booked', { seatId }));
    res.status(201).json(booking);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/bookings', authenticate, async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { userId: (req as any).user.userId },
    include: { match: { include: { stadium: true } }, seats: true },
  });
  res.json(bookings);
});

// --- ADMIN ROUTES ---

app.get('/api/admin/stats', authenticate, authorize(['ADMIN']), async (req, res) => {
  const totalUsers = await prisma.user.count({ where: { role: 'USER' } });
  const totalBookings = await prisma.booking.count({ where: { status: 'CONFIRMED' } });
  const totalMatches = await prisma.match.count({ where: { deletedAt: null } });
  const revenue = await prisma.booking.aggregate({ _sum: { totalAmount: true }, where: { status: 'CONFIRMED' } });
  const recent = await prisma.booking.findMany({
    take: 5, orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, email: true } }, match: { select: { homeTeam: true, awayTeam: true } } }
  });
  res.json({ totalUsers, totalBookings, totalMatches, totalRevenue: revenue._sum.totalAmount || 0, recentBookings: recent });
});

app.post('/api/admin/matches', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const { homeTeam, awayTeam, matchDate, basePrice } = req.body;
    const stadium = await prisma.stadium.findFirst();
    const layout = await prisma.seatLayout.findFirst();
    if (!stadium || !layout) throw new Error('System error: No stadium/layout');

    const match = await prisma.match.create({
      data: { homeTeam, awayTeam, matchDate: new Date(matchDate), basePrice: Number(basePrice), stadiumId: stadium.id, layoutId: layout.id }
    });

    // Generate seats (simplified for brevity here, but normally you'd keep it)
    const stands = ['North', 'East', 'South', 'West'];
    const seatsData = [];
    for (const stand of stands) {
      for (let r = 1; r <= 10; r++) { // Reduced for demo/speed
        for (let c = 1; c <= 10; c++) {
          seatsData.push({ matchId: match.id, row: r, col: c, section: stand, price: match.basePrice + (r * 10), status: 'AVAILABLE' });
        }
      }
    }
    await prisma.matchSeat.createMany({ data: seatsData });
    res.status(201).json({ message: 'Match created', match });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- SOCKETS ---

io.on('connection', (socket) => {
  socket.on('join-match', (matchId) => socket.join(`match-${matchId}`));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
