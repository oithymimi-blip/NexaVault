import { useState, useEffect } from 'react';

function shortAddr(addr) {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function NotificationCenter({ notifications, onClear, onMarkRead, audioEnabled, setAudioEnabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState && unreadCount > 0 && onMarkRead) {
      onMarkRead();
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className="relative bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-700 transition flex items-center gap-2 font-medium"
        title="View Approval Notifications Log"
      >
        <span>🔔</span>
        <span>Notifications</span>
        {unreadCount > 0 && (
          <span className="bg-sky-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notification Modal / Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#181b24] border border-slate-700/80 rounded-2xl shadow-2xl z-50 p-4 font-sans text-slate-200 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-slate-700/60 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🔔</span>
                <h3 className="font-bold text-sm text-slate-100">Approval Activity Log</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAudioEnabled(!audioEnabled)}
                  className={`text-[11px] px-2 py-1 rounded-md border transition font-medium ${
                    audioEnabled
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {audioEnabled ? '🔊 Sound ON' : '🔇 Mute'}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-200 text-sm px-1.5"
                >
                  ✕
                </button>
              </div>
            </div>

            {notifications.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No recent approval notifications recorded yet.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {notifications.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-3 bg-[#11131c] hover:bg-[#1f2333] border border-slate-800 rounded-xl transition flex justify-between items-start gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-semibold text-slate-200">
                          Wallet Approved
                        </span>
                      </div>
                      <p className="text-xs font-mono text-sky-400 font-medium">
                        {shortAddr(item.owner)}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                      ACTIVE
                    </span>
                  </div>
                ))}
              </div>
            )}

            {notifications.length > 0 && (
              <div className="pt-3 border-t border-slate-700/60 mt-3 flex justify-between items-center text-xs">
                <span className="text-slate-500 text-[11px]">
                  {notifications.length} total event{notifications.length !== 1 ? 's' : ''} stored
                </span>
                <button
                  onClick={onClear}
                  className="text-slate-400 hover:text-rose-400 transition text-[11px]"
                >
                  Clear Log History
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
