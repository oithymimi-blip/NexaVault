/* ─── InfoSection.jsx ────────────────────────────────────────────────────── */
/* Rich marketing section rendered below the Countdown Timer on the user page */

const SLOTS_TOTAL   = 100;
const SLOTS_FILLED  = 27;          // Update this number as slots fill up

const steps = [
  {
    num: '1',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
        className="w-10 h-10 text-emerald-400">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 9h18M9 21v-4M15 21v-4" />
      </svg>
    ),
    title: 'Connect Your Wallet',
    desc: 'Verify your wallet activity on-chain. No deposits, no transfers required.',
    bullets: ['Zero deposits', 'No funds locked', 'Instant verification'],
  },
  {
    num: '2',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
        className="w-10 h-10 text-emerald-400">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
    title: 'Authorize Allowance',
    desc: 'Sign a one-time approval so timed releases can run exactly when the schedule calls.',
    bullets: ['Timed releases', 'Transparent approvals', 'No minimums'],
  },
  {
    num: '3',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
        className="w-10 h-10 text-emerald-400">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Refer & Expand',
    desc: 'Share your referral link so new wallets join with clean attribution from the start.',
    bullets: ['Clear attribution', 'Two-step verification', 'Consistent growth'],
  },
];

export default function InfoSection() {
  const pct = Math.round((SLOTS_FILLED / SLOTS_TOTAL) * 100);
  const remaining = SLOTS_TOTAL - SLOTS_FILLED;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-16 pb-20 mt-4">

      {/* ── Pool Stats ───────────────────────────────────────────────────── */}
      <section className="text-center">
        <p className="text-xs font-bold tracking-[0.3em] text-emerald-500 uppercase mb-3">
          Current Pool
        </p>
        <h2 className="text-4xl md:text-5xl font-extrabold text-slate-100 mb-2">
          $60,000 USDT{' '}
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Access Pool
          </span>
        </h2>
        <p className="text-slate-400 text-sm max-w-lg mx-auto">
          Reserved for verified wallets with transparent tracking in every release cycle.
        </p>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          {[
            { icon: '₮', value: '$60,000', label: 'Total Pool' },
            { icon: '🏆', value: '100',    label: 'Priority Slots' },
            { icon: '📈', value: 'Daily',  label: 'Release Cadence' },
            { icon: '🕐', value: '30 Days',label: 'Program Window' },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-[#0e1620]/80 border border-slate-800/70 rounded-2xl p-5 flex flex-col items-start gap-2
                         hover:border-emerald-500/30 hover:bg-[#0e1620] transition-all duration-300 shadow-lg"
            >
              <span className="text-2xl">{s.icon}</span>
              <span className="text-2xl font-extrabold text-emerald-400 font-mono">{s.value}</span>
              <span className="text-xs text-slate-500 font-medium">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-6 bg-[#0e1620]/80 border border-slate-800/70 rounded-2xl p-5 text-left shadow-lg">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-slate-300">Priority Slots Filled</span>
            <span className="text-sm font-mono text-slate-400">
              {SLOTS_FILLED} / {SLOTS_TOTAL}
            </span>
          </div>
          <div className="w-full bg-slate-800/80 rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-3 text-center">
            Only{' '}
            <span className="text-emerald-400 font-semibold">{remaining} access slots</span>{' '}
            open. Reserve before the window closes.
          </p>
        </div>
      </section>

      {/* ── 3-Step Workflow ───────────────────────────────────────────────── */}
      <section className="text-center">
        <p className="text-xs font-bold tracking-[0.3em] text-emerald-500 uppercase mb-3">
          Workflow
        </p>
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-100 mb-2">
          Three Steps to{' '}
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Dock In
          </span>
        </h2>
        <p className="text-slate-400 text-sm max-w-lg mx-auto mb-10">
          A simple sequence so every participant understands the authorization pipeline.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {steps.map((step) => (
            <div
              key={step.num}
              className="relative bg-[#0e1620]/80 border border-slate-800/70 rounded-2xl p-6 text-left
                         hover:border-emerald-500/30 hover:bg-[#0e1620] transition-all duration-300 shadow-lg group"
            >
              {/* Step number badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full
                              bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center
                              text-slate-950 font-extrabold text-sm shadow-lg
                              group-hover:shadow-emerald-500/30 transition-shadow">
                {step.num}
              </div>

              <div className="mt-4 mb-4 flex justify-center">
                {step.icon}
              </div>

              <h3 className="text-base font-bold text-slate-100 text-center mb-2">
                {step.title}
              </h3>
              <p className="text-xs text-slate-400 text-center leading-relaxed mb-4">
                {step.desc}
              </p>

              <ul className="space-y-1.5">
                {step.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="text-emerald-400 font-bold">✓</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer note ──────────────────────────────────────────────────── */}
      <p className="text-center text-xs text-slate-600 pb-4">
        Secured by Permit2 · BNB Smart Chain · Non-custodial
      </p>
    </div>
  );
}
