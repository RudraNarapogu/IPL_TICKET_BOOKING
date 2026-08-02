# IPL Ticket Booking System

A full-stack application for booking IPL match tickets with real-time seat availability and an interactive stadium layout.

## Features

- **Interactive Stadium Map**: Browse seats by stands (North, East, South, West) and rows.
- **Real-time Updates**: Live seat status (Available, Held, Sold) using WebSockets (Socket.IO).
- **Secure Authentication**: User registration and login with JWT-based sessions.
- **Booking Management**: View your booking history and ticket details in a personal dashboard.
- **Admin Dashboard**: Overview of system stats including total users, matches, bookings, and revenue.
- **Database Integration**: Robust data management using Prisma ORM and SQLite.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Axios, Socket.IO Client.
- **Backend**: Node.js, Express, Socket.IO, Prisma, JWT, bcrypt, Zod.
- **Database**: SQLite (via Prisma).

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/RudraNarapogu/IPL_TICKET_BOOKING.git
   cd IPL_TICKET_BOOKING
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   npm install
   ```
   Create a `.env` file in the `backend` folder:
   ```env
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="your_secret_key"
   PORT=3001
   ```
   Initialize the database:
   ```bash
   npx prisma migrate dev --name init
   npx ts-node prisma/seed.ts
   ```
   Start the backend:
   ```bash
   npm run dev
   ```

3. **Frontend Setup**:
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

4. **Access the App**:
   Open [http://localhost:5173](http://localhost:5173) in your browser.

## Credentials

- **Admin Account**:
  - Email: `admin@ipl.com`
  - Password: `admin123`

## License

MIT
