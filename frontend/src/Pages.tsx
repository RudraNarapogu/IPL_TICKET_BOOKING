import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, useAuth, useSocket, Match, Seat } from './App';

// --- HOME PAGE ---
export const Home = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/matches').then(res => { setMatches(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center mt-20 text-xl font-semibold">Loading Matches...</div>;
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Upcoming IPL Matches</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {matches.map(m => (
          <div key={m.id} className="bg-white rounded-xl shadow-lg overflow-hidden border hover:shadow-xl transition">
            <div className="bg-secondary p-4 text-white text-center font-bold">{m.homeTeam} vs {m.awayTeam}</div>
            <div className="p-6">
              <div className="text-gray-600 mb-2 font-medium">📅 {new Date(m.matchDate).toLocaleString()}</div>
              <div className="text-gray-600 mb-4 font-medium">📍 {m.stadium.name}</div>
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-primary">₹ {m.basePrice}</span>
                <Link to={`/match/${m.id}`} className="bg-primary text-white px-6 py-2 rounded-lg font-semibold hover:bg-primary-dark transition">Book Now</Link>
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
    } catch (err: any) { alert(err.response?.data?.message || 'Error logging in'); }
  };

  return (
    <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-xl shadow-md border">
      <h2 className="text-3xl font-bold mb-6 text-center text-primary">Login</h2>
      <form onSubmit={handle} className="space-y-4">
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 border rounded focus:ring-2 focus:ring-primary outline-none" required />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 border rounded focus:ring-2 focus:ring-primary outline-none" required />
        <button className="w-full bg-primary text-white py-2 rounded font-bold hover:bg-primary-dark transition">Login</button>
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
      alert('Registration successful! Please login.');
      navigate('/login');
    } catch (err: any) { alert(err.response?.data?.error || 'Error registering'); }
  };
  return (
    <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-xl shadow-md border">
      <h2 className="text-3xl font-bold mb-6 text-center text-primary">Register</h2>
      <form onSubmit={handle} className="space-y-4">
        <input type="text" placeholder="Name" onChange={e => setForm({...form, name: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-primary outline-none" required />
        <input type="email" placeholder="Email" onChange={e => setForm({...form, email: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-primary outline-none" required />
        <input type="password" placeholder="Password" onChange={e => setForm({...form, password: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-primary outline-none" required />
        <button className="w-full bg-primary text-white py-2 rounded font-bold hover:bg-primary-dark transition">Register</button>
      </form>
    </div>
  );
};

// --- MATCH DETAILS ---
export const MatchDetails = () => {
  const { id } = useParams();
  const [match, setMatch] = useState<any>(null);
  useEffect(() => { api.get(`/matches/${id}`).then(res => setMatch(res.data)); }, [id]);
  if (!match) return <div className="text-center mt-20">Loading Match Details...</div>;
  return (
    <div className="max-w-5xl mx-auto mt-8 bg-white p-8 rounded-xl shadow-lg border">
      <h1 className="text-4xl font-bold text-center mb-8 text-secondary">{match.homeTeam} vs {match.awayTeam}</h1>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <p className="text-lg">📅 <b>Date:</b> {new Date(match.matchDate).toLocaleString()}</p>
          <p className="text-lg">📍 <b>Venue:</b> {match.stadium.name}, {match.stadium.city}</p>
          <p className="text-lg">🎟️ <b>Price:</b> <span className="text-primary font-bold">₹ {match.basePrice} onwards</span></p>
        </div>
        <div className="bg-gray-50 p-6 rounded-xl text-center border flex flex-col justify-center">
          <p className="mb-4 text-gray-600">Select your preferred seats from the interactive stadium map.</p>
          <Link to={`/match/${match.id}/seats`} className="bg-primary text-white px-8 py-3 rounded-lg font-bold hover:bg-primary-dark transition shadow-md">Select Seats</Link>
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
      const confirm = window.confirm(`Confirm booking for ₹${seats.filter(s => selected.includes(s.id)).reduce((a,b)=>a+b.price, 0)}?`);
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
        <div className="flex gap-2 mb-8 border-b pb-4 overflow-x-auto">
          {sections.map(sec => (
            <button key={sec} onClick={() => setActiveSection(sec)}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition ${activeSection === sec ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {sec} Stand
            </button>
          ))}
        </div>
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
        <div className="mt-8 flex gap-6 text-sm border-t pt-6">
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div> Available</div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-primary rounded"></div> Selected</div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-yellow-400 rounded"></div> Held</div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-300 rounded"></div> Sold</div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-xl border shadow-md h-fit sticky top-8">
        <h3 className="text-xl font-bold border-b pb-4 mb-4">Summary</h3>
        <div className="space-y-3 mb-6 max-h-48 overflow-y-auto">
          {selected.length === 0 ? <p className="text-gray-400 italic">Select seats</p> :
            seats.filter(s => selected.includes(s.id)).map(s => (
              <div key={s.id} className="flex justify-between text-xs">
                <span>{s.section} R{s.row}-C{s.col}</span>
                <span className="font-bold">₹{s.price}</span>
              </div>
            ))}
        </div>
        <div className="border-t pt-4">
          <div className="flex justify-between items-center mb-6">
            <span className="text-gray-600">Total</span>
            <span className="text-2xl font-bold text-primary">₹{seats.filter(s => selected.includes(s.id)).reduce((a,b) => a+b.price, 0)}</span>
          </div>
          <button onClick={proceed} disabled={selected.length === 0} className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:bg-primary-dark transition disabled:opacity-50">Proceed</button>
        </div>
      </div>
    </div>
  );
};

// --- USER DASHBOARD ---
export const UserDashboard = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/bookings').then(res => {setBookings(res.data); setLoading(false);}); }, []);
  if (loading) return <div className="text-center mt-20 text-xl font-semibold">Loading Dashboard...</div>;
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">My Bookings</h2>
      <div className="space-y-4">
        {bookings.length === 0 ? <p className="text-gray-500 text-center py-10 bg-white rounded-xl border">No bookings yet.</p> :
          bookings.map(b => (
            <div key={b.id} className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md transition">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-xl text-secondary">{b.match.homeTeam} vs {b.match.awayTeam}</p>
                  <p className="text-sm text-gray-500">📅 {new Date(b.match.matchDate).toLocaleDateString()}</p>
                  <p className="mt-2 text-sm">🎟️ <b>{b.seats.length} Seats:</b> {b.seats.map((s:any)=> `R${s.row}-C${s.col}`).join(', ')}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-2xl text-primary mb-1">₹ {b.totalAmount}</p>
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Confirmed</span>
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
  const [matchForm, setMatchForm] = useState({ homeTeam: '', awayTeam: '', matchDate: '', basePrice: '' });
  const [loading, setLoading] = useState(false);

  const fetchStats = () => api.get('/admin/stats').then(res => setStats(res.data));
  useEffect(() => { fetchStats(); }, []);

  const handleCreateMatch = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/admin/matches', matchForm);
      alert('Match created successfully with 400 seats!');
      setMatchForm({ homeTeam: '', awayTeam: '', matchDate: '', basePrice: '' });
      fetchStats();
    } catch (err: any) { alert(err.response?.data?.error || 'Error creating match'); }
    setLoading(false);
  };

  if (!stats) return <div className="text-center mt-20 text-xl font-semibold">Loading Admin Stats...</div>;
  return (
    <div className="space-y-10">
      <h2 className="text-3xl font-bold text-secondary">Admin Dashboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Users', val: stats.totalUsers, color: 'bg-blue-500' },
          { label: 'Total Bookings', val: stats.totalBookings, color: 'bg-green-500' },
          { label: 'Total Matches', val: stats.totalMatches, color: 'bg-purple-500' },
          { label: 'Total Revenue', val: `₹${stats.totalRevenue}`, color: 'bg-orange-500' }
        ].map(s => (
          <div key={s.label} className={`${s.color} text-white p-6 rounded-2xl shadow-lg`}>
            <p className="text-sm opacity-80 font-bold uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-3xl font-black">{s.val}</p>
          </div>
        ))}
      </div>

      <div className="bg-white p-8 rounded-2xl border shadow-md">
        <h3 className="text-2xl font-bold mb-6 text-secondary">Add New Match</h3>
        <form onSubmit={handleCreateMatch} className="grid md:grid-cols-2 gap-6">
          <input type="text" placeholder="Home Team" value={matchForm.homeTeam} onChange={e => setMatchForm({...matchForm, homeTeam: e.target.value})} className="p-3 border rounded-xl focus:ring-2 focus:ring-primary outline-none" required />
          <input type="text" placeholder="Away Team" value={matchForm.awayTeam} onChange={e => setMatchForm({...matchForm, awayTeam: e.target.value})} className="p-3 border rounded-xl focus:ring-2 focus:ring-primary outline-none" required />
          <input type="datetime-local" value={matchForm.matchDate} onChange={e => setMatchForm({...matchForm, matchDate: e.target.value})} className="p-3 border rounded-xl focus:ring-2 focus:ring-primary outline-none" required />
          <input type="number" placeholder="Base Price" value={matchForm.basePrice} onChange={e => setMatchForm({...matchForm, basePrice: e.target.value})} className="p-3 border rounded-xl focus:ring-2 focus:ring-primary outline-none" required />
          <button disabled={loading} className="md:col-span-2 bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-primary-dark transition disabled:opacity-50 shadow-md">
            {loading ? 'Generating 400 Seats...' : 'Create Match & Generate Seats'}
          </button>
        </form>
      </div>
    </div>
  );
};
