import { useState, useEffect } from 'react';
import { useMetaMask } from '../hooks/useMetaMask';
import { api } from '../utils/api';
import { ethers } from 'ethers';

export default function PermitHistory() {
  const { account } = useMetaMask();
  const [permits, setPermits] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (account) {
      fetchHistory();
    } else {
      setPermits([]);
    }
  }, [account]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await api.getPermitHistory(account);
      setPermits(data);
    } catch (err) {
      console.error('History fetch error', err);
    } finally {
      setLoading(false);
    }
  };

  if (!account) return <div className="text-center text-slate-500 mt-8">Connect wallet to see your signed permits.</div>;

  return (
    <div className="mt-10 max-w-2xl mx-auto">
      <h3 className="text-xl font-bold text-slate-200 mb-4 flex items-center justify-between">
        <span>Your Permit History</span>
        <button onClick={fetchHistory} className="text-xs text-amber-400 hover:underline">
          Refresh
        </button>
      </h3>
      {loading ? (
        <div className="text-slate-400 text-center py-6">Loading history...</div>
      ) : permits.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 text-center text-slate-400">
          No permits found for this wallet.
        </div>
      ) : (
        <div className="space-y-3">
          {permits.map((p) => {
            const amountFormatted = ethers.formatUnits(p.amount, 18);
            const isActivated = p.status === 'activated';
            const isExpired = p.status === 'expired' || Date.now() / 1000 > p.deadline;
            const isPending = p.status === 'pending';
            const totalTransferred = p.totalTransferred
              ? parseFloat(ethers.formatUnits(p.totalTransferred, 18)).toFixed(4)
              : '0.0000';

            return (
              <div key={p._id} className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-md hover:border-slate-700 transition">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-lg font-mono font-semibold text-slate-100">{amountFormatted} USDT</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Nonce: <span className="font-mono text-slate-300">{p.nonce}</span> | Expires: {new Date(p.deadline * 1000).toLocaleString()}
                    </p>
                    <p className="text-xs mt-1">
                      Status:{' '}
                      <span className={`font-semibold ${isActivated ? 'text-emerald-400' : isExpired ? 'text-rose-400' : 'text-amber-400'}`}>
                        {isActivated ? 'ACTIVE' : isExpired ? 'EXPIRED' : 'PENDING'}
                      </span>
                    </p>
                    {p.executions?.length > 0 && (
                      <p className="text-xs text-slate-400 mt-1">
                        Total Transferred: <span className="text-cyan-400 font-mono font-semibold">{totalTransferred} USDT</span>
                        <span className="text-slate-600 ml-1">({p.executions.length} transfers)</span>
                      </p>
                    )}
                  </div>
                  {p.activationTxHash && (
                    <a
                      href={`https://bscscan.com/tx/${p.activationTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs px-3.5 py-2 rounded-xl border border-slate-700 transition font-medium"
                    >
                      View TX ↗
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
