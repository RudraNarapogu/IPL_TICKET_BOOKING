import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

// --- TYPES ---
export interface User { id: string; email: string; name: string; role: 'USER' | 'ADMIN'; }
export interface Stadium { id: string; name: string; city: string; }
export interface Match { id: string; homeTeam: string; awayTeam: string; matchDate: string; stadium: Stadium; basePrice: number; }
export interface Seat { id: string; row: number; col: number; section: string; price: number; status: 'AVAILABLE' | 'HELD' | 'SOLD'; }

// --- API ---
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
export const api = axios.create({ baseURL: `${API_BASE_URL}/api` });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- AUTH CONTEXT ---
interface AuthContextType {
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) setUser(JSON.parse(storedUser));
    setIsLoading(false);
  }, []);

  const login = (token: string, newUser: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(newUser));
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, logout, isLoading }}>{children}</AuthContext.Provider>;
};
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth error');
  return context;
};

// --- SOCKET HOOK ---
export const useSocket = (matchId?: string) => {
  const socketRef = useRef<Socket | null>(null);
  useEffect(() => {
    socketRef.current = io(API_BASE_URL);
    if (matchId) socketRef.current.emit('join-match', matchId);
    return () => { socketRef.current?.disconnect(); };
  }, [matchId]);
  return socketRef.current;
};

// --- NAVBAR ---
const Navbar = () => {
  const { user, logout } = useAuth();
  return (
    <nav className="bg-primary text-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold tracking-tight">IPL Tickets</Link>
        <div className="flex gap-6 items-center">
          {user ? (
            <>
              <Link to="/dashboard" className="hover:text-gray-200">My Bookings</Link>
              {user.role === 'ADMIN' && <Link to="/admin" className="hover:text-gray-200">Admin</Link>}
              <button onClick={logout} className="bg-white text-primary px-4 py-2 rounded-lg font-bold">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-gray-200">Login</Link>
              <Link to="/register" className="bg-white text-primary px-4 py-2 rounded-lg font-bold">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

// --- PAGES (Imported from a consolidated file to keep App.tsx clean-ish) ---
import { Home, Login, Register, MatchDetails, SeatSelection, UserDashboard, AdminDashboard } from './Pages';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/match/:id" element={<MatchDetails />} />
          <Route path="/match/:id/seats" element={<SeatSelection />} />
          <Route path="/dashboard" element={<UserDashboard />} />
          <Route path="/admin/*" element={<AdminDashboard />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
