# Beginner's Guide: IPL Ticket Booking Platform

Welcome to the IPL Ticket Booking Platform! If you are new to programming or web development, this document will explain exactly how this project works in simple, easy-to-understand terms.

## What is the "Tech Stack"?
This project uses a standard, highly popular set of tools:
1. **Frontend**: **React** (with TypeScript). This is the code that runs in your web browser. It draws the buttons, the seating maps, and handles user clicks.
2. **Backend**: **Node.js & Express**. This is the code that runs on the server. It listens for requests from the frontend (like "Hey, I want to buy a ticket") and processes them.
3. **Database**: **SQLite & Prisma**. The database stores all our permanent information (Users, Matches, Seats, Bookings). Prisma is a tool that lets our backend easily talk to the database using JavaScript instead of complicated SQL commands.

---

## Detailed Folder Structure: How and Why It Was Created

When building a full-stack application, keeping code organized is extremely important. We split the project into two main folders (`frontend` and `backend`) so they can run independently.

### 1. `frontend/` (The React Application)
This folder was created using a tool called `Vite` (a modern version of Create React App). Its job is to manage the user interface.

*   **`frontend/public/`**: Stores static files like images, icons, or fonts that don't need to be processed by React.
*   **`frontend/src/`**: The most important folder. This is where all the React code you write lives.
    *   **`src/pages/`**: We created this folder to hold full-screen views (like `Home.tsx`, `Login.tsx`, `SeatSelection.tsx`). Each file here represents a different page in the app.
    *   **`src/components/`**: We created this folder for smaller, reusable pieces of the UI (like `Navbar.tsx`). Instead of writing the navigation bar code on every single page, we write it once here and reuse it.
    *   **`src/services/`**: We created this to hold `api.ts`. This file handles sending HTTP requests to the backend. Keeping this separate means we don't clutter our UI code with networking logic.
    *   **`src/store/`**: This holds `AuthContext.tsx`. We created it to store "global state" (like who is currently logged in) so that every page knows if you are an Admin or a normal User.
*   **`frontend/package.json`**: Created by npm. It lists all the third-party libraries the frontend needs to run (like `react`, `react-router-dom`).

### 2. `backend/` (The Node.js Server)
This folder was created manually to act as the "brain" and data manager of our application.

*   **`backend/src/`**: Contains all our custom server code.
    *   **`src/controllers/`**: We created this folder to hold the "business logic". For example, `booking.controller.ts` decides exactly what happens when someone buys a ticket (checking availability, charging money). We keep logic here so the routing files don't get messy.
    *   **`src/routes/`**: We created this to act as the traffic cop. `match.routes.ts` says: "If a GET request comes to `/api/matches`, send it to the match controller." 
    *   **`src/middleware/`**: We created this for security (like `auth.middleware.ts`). Before a request reaches a controller, it passes through middleware to check if the user is logged in with a valid token.
    *   **`src/config/`**: We created this to hold connection settings, like `db.ts`, which connects the server to the database.
*   **`backend/prisma/`**: We created this when we set up Prisma (our database tool).
    *   **`schema.prisma`**: The blueprint. It defines exactly what tables exist in our SQLite database (User, Match, Seat, etc.).
    *   **`seed.ts`**: A special script we created to automatically fill the empty database with mock data (like the Wankhede Stadium, fake matches, and generating 10,000 seats) so we don't have to do it manually.
*   **`backend/package.json`**: Lists all the backend libraries (like `express`, `prisma`, `jsonwebtoken`).

---

## How Does a Booking Actually Happen? (The Flow)

Let's trace exactly what happens when a user books a ticket:

1. **The User Opens the App**:
   React loads the `Home.tsx` file. The frontend sends a `GET /api/matches` request to the backend. The backend asks the database for the matches and sends them back. React displays them.
   
2. **The User Clicks a Match**:
   React navigates to the `SeatSelection.tsx` page. The frontend connects to a live **WebSocket**. Think of a WebSocket like an open phone line between the browser and the server.
   
3. **The User Clicks a Seat**:
   The frontend says to the backend: *"Hey, hold Seat #123 for User John!"*
   The backend checks the database. If it's free, it marks it as 'HELD'. 
   Then, because of the open phone line (WebSocket), the backend immediately shouts to every other browser looking at that match: *"Seat #123 is held!"* and their screens instantly turn that seat gray.
   
4. **The User Clicks "Checkout"**:
   The frontend sends a `POST /api/bookings` request. 
   The `booking.controller.ts` file takes over. It double-checks that the seats are still valid, calculates the total price, saves a `Booking` record in the database, and marks the seats as permanently `SOLD`.

## Final Notes on the `node_modules` Folder
You might have noticed a massive folder called `node_modules` in both the frontend and backend. 
**Do not touch this folder!** 
This folder is automatically generated when you install tools (like React or Express). No human writes the code inside `node_modules`. It contains the background engine code that makes our simple code work. It is completely normal for it to have thousands of complex files!
