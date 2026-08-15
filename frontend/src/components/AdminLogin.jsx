import { useState } from 'react';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

export default function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { token } = await api.adminLogin(username, password);
      onLogin(token);
      toast.success('Logged in as admin');
    } catch (err) {
      toast.error('Invalid admin credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="max-w-md mx-auto mt-16 bg-slate-900/80 border border-slate-800 p-8 rounded-3xl shadow-2xl backdrop-blur-xl">
      <h2 className="text-2xl font-bold mb-6 text-slate-100">Admin Authentication</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1 font-medium">Username</label>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1 font-medium">Password</label>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-950 font-bold py-3.5 rounded-xl shadow-lg transition disabled:opacity-50"
        >
          {loading ? 'Authenticating...' : 'Sign In'}
        </button>
      </div>
    </form>
  );
}
