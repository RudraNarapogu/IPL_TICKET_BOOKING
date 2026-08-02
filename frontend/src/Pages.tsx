import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, useAuth, useSocket, Match, Seat, User } from './App';

// --- HOME PAGE ---
export const Home = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/matches').then(res => { setMatches(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center mt-20">Loading...</div>;
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Upcoming IPL Matches</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {matches.map(m => (
          <div key={m.id} className="bg-white rounded-xl shadow-lg overflow-hidden border hover:shadow-xl transition">
            <div className="bg-secondary p-4 text-white text-center font-bold">{m.homeTeam} vs {m.awayTeam}</div>
            <div className="p-6">
              <div className="text-gray-600 mb-2">📅 {new Date(m.matchDate).toLocaleString()}</div>
              <div className="text-gray-600 mb-4">📍 {m.stadium.name}</div>
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-primary">₹ {m.basePrice}</span>
                <Link to={`/match/${m.id}`} className="bg-primary text-white px-6 py-2 rounded-lg font-semibold">Book Now</Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- LOGIN PAGE ---
export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handle = async (e: any) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/login', { email, password });
      login(data.token, data.user);
      navigate(data.user.role === 'ADMIN' ? '/admin' : '/');
    } catch (err: any) { alert(err.response?.data?.message || 'Error'); }
  };

  return (
    <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-xl shadow-md border">
      <h2 className="text-3xl font-bold mb-6 text-center text-primary">Login</h2>
      <form onSubmit={handle} className="space-y-4">
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 border rounded" required />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 border rounded" required />
        <button className="w-full bg-primary text-white py-2 rounded font-bold">Login</button>
      </form>
    </div>
  );
};

// --- REGISTER PAGE ---
export const Register = () => {
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const navigate = useNavigate();
  const handle = async (e: any) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', form);
      navigate('/login');
    } catch (err: any) { alert(err.response?.data?.error || 'Error'); }
  };
  return (
    <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-xl shadow-md border">
      <h2 className="text-3xl font-bold mb-6 text-center text-primary">Register</h2>
      <form onSubmit={handle} className="space-y-4">
        <input type="text" placeholder="Name" onChange={e => setForm({...form, name: e.target.value})} className="w-full p-2 border rounded" required />
        <input type="email" placeholder="Email" onChange={e => setForm({...form, email: e.target.value})} className="w-full p-2 border rounded" required />
        <input type="password" placeholder="Password" onChange={e => setForm({...form, password: e.target.value})} className="w-full p-2 border rounded" required />
        <button className="w-full bg-primary text-white py-2 rounded font-bold">Register</button>
      </form>
    </div>
  );
};

// --- MATCH DETAILS ---
export const MatchDetails = () => {
  const { id } = useParams();
  const [match, setMatch] = useState<any>(null);
  useEffect(() => { api.get(`/matches/${id}`).then(res => setMatch(res.data)); }, [id]);
  if (!match) return <div>Loading...</div>;
  return (
    <div className="max-w-5xl mx-auto mt-8 bg-white p-8 rounded-xl shadow-lg border">
      <h1 className="text-4xl font-bold text-center mb-8">{match.homeTeam} vs {match.awayTeam}</h1>
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <p className="mb-2">📅 <b>Date:</b> {new Date(match.matchDate).toLocaleString()}</p>
          <p className="mb-2">📍 <b>Venue:</b> {match.stadium.name}, {match.stadium.city}</p>
          <p className="mb-4">🎟️ <b>Price:</b> ₹ {match.basePrice} onwards</p>
        </div>
        <div className="bg-gray-50 p-6 rounded-xl text-center border">
          <p className="mb-4">Select your seats from the interactive map.</p>
          <Link to={`/match/${match.id}/seats`} className="bg-primary text-white px-8 py-3 rounded-lg font-bold block">Select Seats</Link>
        </div>
      </div>
    </div>
  );
};

// --- SEAT SELECTION ---
export const SeatSelection = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [match, setMatch] = useState<Match | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const socket = useSocket(id);

  useEffect(() => {
    api.get(`/matches/${id}`).then(res => setMatch(res.data));
    api.get(`/matches/${id}/seats`).then(res => {
      setSeats(res.data);
      if (res.data.length > 0) setActiveSection(res.data[0].section);
    });
  }, [id]);

  useEffect(() => {
    if (!socket) return;
    socket.on('seat-held', ({ seatId }) => {
      setSeats(prev => prev.map(s => s.id === seatId ? { ...s, status: 'HELD' } : s));
    });
    socket.on('seat-booked', ({ seatId }) => {
      setSeats(prev => prev.map(s => s.id === seatId ? { ...s, status: 'SOLD' } : s));
    });
  }, [socket]);

  const toggle = (s: Seat) => {
    if (s.status === 'SOLD' || s.status === 'HELD') return;
    setSelected(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id]);
  };

  const proceed = async () => {
    if (!user) return navigate('/login');
    try {
      await Promise.all(selected.map(sid => api.post(`/matches/${id}/hold`, { seatId: sid })));
      const confirm = window.confirm('Confirm booking for ₹' + seats.filter(s => selected.includes(s.id)).reduce((a,b)=>a+b.price, 0) + '?');
      if (confirm) {
        await api.post('/bookings', { matchId: id, seatIds: selected });
        alert('Booking Successful!');
        navigate('/dashboard');
      }
    } catch (e) { alert('Some seats were taken!'); }
  };

  const sections = Array.from(new Set(seats.map(s => s.section)));
  const filteredSeats = seats.filter(s => s.section === activeSection);
  const rows = Array.from(new Set(filteredSeats.map(s => s.row))).sort((a,b) => a-b);

  return (
    <div className="grid md:grid-cols-4 gap-8">
      <div className="md:col-span-3 bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="text-2xl font-bold mb-6">Select Your Seats</h2>

        {/* Section Tabs */}
        <div className="flex gap-2 mb-8 border-b pb-4 overflow-x-auto">
          {sections.map(sec => (
            <button key={sec} onClick={() => setActiveSection(sec)}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition ${activeSection === sec ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {sec} Stand
            </button>
          ))}
        </div>

        {/* Seat Map */}
        <div className="space-y-4 overflow-x-auto pb-4">
          {rows.map(rowNum => (
            <div key={rowNum} className="flex gap-2 items-center min-w-max">
              <span className="w-12 text-sm font-bold text-gray-400">Row {rowNum}</span>
              <div className="flex gap-2">
                {filteredSeats.filter(s => s.row === rowNum).sort((a,b) => a.col - b.col).map(s => (
                  <button key={s.id} onClick={() => toggle(s)}
                    title={`₹${s.price}`}
                    className={`w-10 h-10 rounded flex items-center justify-center text-xs font-bold transition
                      ${s.status === 'SOLD' ? 'bg-gray-300 text-gray-500 cursor-not-allowed' :
                        s.status === 'HELD' ? 'bg-yellow-400 text-white cursor-not-allowed' :
                        selected.includes(s.id) ? 'bg-primary text-white shadow-lg scale-110' : 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-200'}`}>
                    {s.col}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-8 flex gap-6 text-sm border-t pt-6">
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div> Available</div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-primary rounded"></div> Selected</div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-yellow-400 rounded"></div> Held</div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-300 rounded"></div> Sold</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-md h-fit sticky top-8">
        <h3 className="text-xl font-bold border-b pb-4 mb-4">Booking Summary</h3>
        <div className="space-y-3 mb-6">
          {selected.length === 0 ? (
            <p className="text-gray-400 italic">Select seats to continue</p>
          ) : (
            seats.filter(s => selected.includes(s.id)).map(s => (
              <div key={s.id} className="flex justify-between text-sm">
                <span>{s.section} Stand - Row {s.row}, Seat {s.col}</span>
                <span className="font-bold">₹{s.price}</span>
              </div>
            ))
          )}
        </div>
        <div className="border-t pt-4">
          <div className="flex justify-between items-center mb-6">
            <span className="text-gray-600">Total Amount</span>
            <span className="text-2xl font-bold text-primary">₹{seats.filter(s => selected.includes(s.id)).reduce((a,b) => a+b.price, 0)}</span>
          </div>
          <button onClick={proceed} disabled={selected.length === 0}
            className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-primary-dark transition disabled:opacity-50">
            Proceed to Pay
          </button>
        </div>
      </div>
    </div>
  );
};

// --- USER DASHBOARD ---
export const UserDashboard = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  useEffect(() => { api.get('/bookings').then(res => setBookings(res.data)); }, []);
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">My Bookings</h2>
      <div className="space-y-4">
        {bookings.map(b => (
          <div key={b.id} className="bg-white p-6 rounded-xl border shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold text-lg">{b.match.homeTeam} vs {b.match.awayTeam}</p>
                <p className="text-sm text-gray-500">{new Date(b.match.matchDate).toLocaleDateString()}</p>
                <p className="text-sm">{b.seats.length} Seats: {b.seats.map((s:any)=>`R${s.row}-C${s.col}`).join(', ')}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-primary">₹ {b.totalAmount}</p>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Confirmed</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- ADMIN DASHBOARD ---
export const AdminDashboard = () => {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => { api.get('/admin/stats').then(res => setStats(res.data)); }, []);
  if (!stats) return <div>Loading...</div>;
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Admin Dashboard</h2>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded border shadow-sm text-center"><p className="text-gray-500">Users</p><p className="text-2xl font-bold">{stats.totalUsers}</p></div>
        <div className="bg-white p-4 rounded border shadow-sm text-center"><p className="text-gray-500">Bookings</p><p className="text-2xl font-bold">{stats.totalBookings}</p></div>
        <div className="bg-white p-4 rounded border shadow-sm text-center"><p className="text-gray-500">Matches</p><p className="text-2xl font-bold">{stats.totalMatches}</p></div>
        <div className="bg-white p-4 rounded border shadow-sm text-center"><p className="text-gray-500">Revenue</p><p className="text-2xl font-bold">₹{stats.totalRevenue}</p></div>
      </div>
    </div>
  );
};
