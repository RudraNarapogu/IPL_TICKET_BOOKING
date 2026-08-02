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
import Redis from 'ioredis';
import { rateLimit } from 'express-rate-limit';

dotenv.config();

const prisma = new PrismaClient();
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// --- RATE LIMITING ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

app.use(helmet());
app.use(cors());
app.use(express.json());
// app.use('/api/', limiter); // TEMPORARILY DISABLED FOR INCREMENTAL LOAD TESTING

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
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hashedPassword, name } });
    res.status(201).json({ message: 'User created', userId: user.id });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

// --- HIGH PERFORMANCE SEAT HOLD ---
app.post('/api/matches/:id/hold', authenticate, async (req, res) => {
  const { seatId } = req.body;
  const userId = (req as any).user.userId;
  const matchId = req.params.id;

  if (!redis) {
    return res.json({ message: 'Seat held (No Redis)' });
  }

  const lockKey = `lock:seat:${seatId}`;
  const isHeld = await redis.set(lockKey, userId, 'EX', 300, 'NX');
  if (!isHeld) return res.status(400).json({ error: 'Seat is already being held or sold' });

  io.to(`match-${matchId}`).emit('seat-held', { seatId, userId });
  res.json({ message: 'Seat held in cache' });
});

// --- MATCH & BOOKING ROUTES ---
app.get('/api/matches', async (req, res) => {
  try {
    const cacheKey = 'matches:all';

    // 1. Try to get from Redis Cache first
    if (redis) {
      const cachedMatches = await redis.get(cacheKey);
      if (cachedMatches) {
        return res.json(JSON.parse(cachedMatches));
      }
    }

    // 2. If not in cache, get from DB
    const matches = await prisma.match.findMany({
      include: { stadium: true },
      where: { deletedAt: null }
    });

    // 3. Store in Redis for next time (expires in 10 minutes)
    if (redis) {
      await redis.set(cacheKey, JSON.stringify(matches), 'EX', 600);
    }

    res.json(matches);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/matches/:id', async (req, res) => {
  const match = await prisma.match.findUnique({ where: { id: req.params.id }, include: { stadium: true, layout: true } });
  if (!match) return res.status(404).json({ message: 'Match not found' });
  res.json(match);
});

app.get('/api/matches/:id/seats', async (req, res) => {
  const seats = await prisma.matchSeat.findMany({ where: { matchId: req.params.id } });
  res.json(seats);
});

app.post('/api/bookings', authenticate, async (req, res) => {
  try {
    const { matchId, seatIds } = req.body;
    const userId = (req as any).user.userId;

    const booking = await prisma.$transaction(async (tx) => {
      const seats = await tx.matchSeat.findMany({ where: { id: { in: seatIds }, matchId } });
      for (const seat of seats) {
        if (seat.status === 'SOLD') throw new Error('Seat sold');
      }
      const totalAmount = seats.reduce((acc, s) => acc + s.price, 0);
      const newBooking = await tx.booking.create({
        data: { userId, matchId, totalAmount, status: 'CONFIRMED', seats: { connect: seatIds.map((id: string) => ({ id })) } },
      });
      await tx.matchSeat.updateMany({ where: { id: { in: seatIds } }, data: { status: 'SOLD', bookingId: newBooking.id } });
      return newBooking;
    });

    seatIds.forEach((seatId: string) => io.to(`match-${matchId}`).emit('seat-booked', { seatId }));
    res.status(201).json(booking);
  } catch (error: any) { res.status(400).json({ error: error.message }); }
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
  try {
    const totalUsers = await prisma.user.count();
    const totalBookings = await prisma.booking.count({ where: { status: 'CONFIRMED' } });
    const totalMatches = await prisma.match.count();
    const revenue = await prisma.booking.aggregate({ _sum: { totalAmount: true }, where: { status: 'CONFIRMED' } });

    res.json({
      totalUsers,
      totalBookings,
      totalMatches,
      totalRevenue: revenue._sum.totalAmount || 0
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/matches', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const { homeTeam, awayTeam, matchDate, basePrice } = req.body;
    const stadium = await prisma.stadium.findFirst();
    const layout = await prisma.seatLayout.findFirst();

    if (!stadium || !layout) throw new Error('No stadium or layout found. Seed the DB first.');

    const match = await prisma.match.create({
      data: {
        homeTeam,
        awayTeam,
        matchDate: new Date(matchDate),
        basePrice: Number(basePrice),
        stadiumId: stadium.id,
        layoutId: layout.id,
      }
    });

    // Generate seats (Minimal for performance)
    const stands = ['North', 'East', 'South', 'West'];
    const seatsData = [];
    for (const stand of stands) {
      for (let r = 1; r <= 10; r++) {
        for (let c = 1; c <= 10; c++) {
          seatsData.push({
            matchId: match.id,
            row: r,
            col: c,
            section: stand,
            price: match.basePrice + (r * 10),
            status: 'AVAILABLE',
          });
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
