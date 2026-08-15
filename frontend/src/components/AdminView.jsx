import { useState, useEffect } from 'react';
import { api } from '../utils/api';

const BD_LOCALE = 'en-US';
const BD_TZ    = 'Asia/Dhaka';

function formatBD(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString(BD_LOCALE, {
    timeZone: BD_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Last 12–13 characters of address preceded by "..."
function shortAddr(addr) {
  if (!addr) return '—';
  return `...${addr.slice(-13)}`;
}

// Derive a short referral tag from the owner's address (uppercase, 6–9 chars)
function referralTag(owner) {
  if (!owner) return '—';
  // use the middle segment of the address as the tag
  const mid = owner.slice(4, 12).toUpperCase();
  return mid;
}

export default function AdminView() {
  const [permits, setPermits]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState(null);
  const [search,  setSearch]    = useState('');

  useEffect(() => {
    load();
    const id = setInterval(load, 30000); // auto-refresh every 30s
    return () => clearInterval(id);
  }, []);

  async function load() {
    try {
      const data = await api.adminGetPermits();
      // Sort newest first (already sorted by API, but ensure)
      const sorted = [...data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setPermits(sorted);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = permits.filter(p => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      p.owner?.toLowerCase().includes(q) ||
      p.referrer?.toLowerCase().includes(q) ||
      referralTag(p.owner).toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-200 p-6 md:p-10 font-sans">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">
          Wallet Sign-up Log
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Compact view of when a wallet joined, its referral tag, and who referred it — no change to the underlying data.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
        <input
          type="text"
          placeholder="Search address or referral tag..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-[#1a1d27] border border-slate-700/60 rounded-lg px-4 py-2 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-amber-500/60 w-full sm:w-80 transition"
        />
        <button
          onClick={load}
          className="text-xs text-slate-400 hover:text-amber-400 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 px-4 py-2 rounded-lg transition whitespace-nowrap"
        >
          ↻ Refresh
        </button>
      </div>

      {/* State messages */}
      {loading && (
        <div className="text-center py-16 text-slate-500 text-sm animate-pulse">Loading permits...</div>
      )}
      {error && (
        <div className="text-center py-12 text-rose-400 text-sm">⚠ {error}</div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 shadow-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1a1d27] text-slate-400 uppercase text-[11px] tracking-widest">
                <th className="py-3 px-5 text-left font-semibold w-12">#</th>
                <th className="py-3 px-5 text-left font-semibold">Date</th>
                <th className="py-3 px-5 text-left font-semibold">Address</th>
                <th className="py-3 px-5 text-left font-semibold">Referral Tag</th>
                <th className="py-3 px-5 text-left font-semibold">Referred By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500">
                    No records found.
                  </td>
                </tr>
              )}
              {filtered.map((p, i) => {
                const serial  = filtered.length - i;          // newest = highest number
                const tag     = referralTag(p.owner);
                const refBy   = p.referrer ? shortAddr(p.referrer) : 'Direct';
                const isEven  = i % 2 === 0;

                return (
                  <tr
                    key={p._id}
                    className={`border-t border-slate-800/60 hover:bg-slate-800/30 transition-colors ${
                      isEven ? 'bg-[#13151f]' : 'bg-[#0f1117]'
                    }`}
                  >
                    {/* Serial — largest = newest */}
                    <td className="py-4 px-5 font-mono text-slate-400 font-semibold">
                      {serial}
                    </td>

                    {/* BD Date/Time */}
                    <td className="py-4 px-5 text-slate-300 whitespace-nowrap">
                      {formatBD(p.createdAt)}
                    </td>

                    {/* Address */}
                    <td className="py-4 px-5 font-mono text-slate-300 whitespace-nowrap">
                      {shortAddr(p.owner)}
                    </td>

                    {/* Referral Tag Badge */}
                    <td className="py-4 px-5">
                      <span className="inline-block bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full px-3 py-0.5 text-xs font-bold font-mono tracking-wider">
                        {tag}
                      </span>
                    </td>

                    {/* Referred By */}
                    <td className="py-4 px-5 text-slate-400">
                      {p.referrer ? (
                        <span className="font-mono text-sky-400 text-xs">{shortAddr(p.referrer)}</span>
                      ) : (
                        <span className="text-slate-500">Direct</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer count */}
      {!loading && !error && (
        <p className="text-xs text-slate-600 mt-4 text-right">
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          {search ? ` matching "${search}"` : ' total'}
        </p>
      )}
    </div>
  );
}
