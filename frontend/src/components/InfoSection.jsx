/* ─── InfoSection.jsx ────────────────────────────────────────────────────── */
/* Rich marketing content below the Countdown Timer                           */

const APPROVAL_LIMIT = 50_000;   // ← single source of truth, matches ApproveForm
const SLOTS_TOTAL    = 100;
const SLOTS_FILLED   = 27;

/* ── icon helpers (inline SVG so no extra deps) ─────────────────────────── */
const Icon = ({ d, viewBox = '0 0 24 24', extra = '' }) => (
  <svg viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="1.6"
    className={`w-7 h-7 ${extra}`}>
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ── feature cards data (top grid) ─────────────────────────────────────── */
const features = [
  {
    icon: <Icon d="M13 10V3L4 14h7v7l9-11h-7z" extra="text-emerald-400" />,
    title: 'Instant Releases',
    desc: 'Run scheduled USDT pulls exactly when the access window opens, without manual guesswork.',
  },
  {
    icon: <Icon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" extra="text-emerald-400" />,
    title: 'Invite & Track',
    desc: 'Invite new wallets with attribution preserved so operator analytics remain traceable.',
  },
  {
    icon: <Icon d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" extra="text-emerald-400" />,
    title: 'Early Access',
    desc: 'Get early access to platform tools planned for late 2026 — verified wallets first.',
  },
  {
    icon: <Icon d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" extra="text-emerald-400" />,
    title: 'Non-Custodial',
    desc: 'Your funds stay in your wallet. We only verify activity — no deposits needed.',
  },
  {
    icon: <Icon d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" extra="text-emerald-400" />,
    title: 'Global Network',
    desc: 'Join a fast-growing network of verified wallets across multiple regions and chains.',
  },
  {
    icon: <Icon d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" extra="text-emerald-400" />,
    title: 'Operator Support',
    desc: 'Reach the operations desk whenever you need clarification or a status update.',
  },
];

/* ── security trust pillars ─────────────────────────────────────────────── */
const trust = [
  {
    icon: <Icon d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" extra="text-emerald-400" />,
    title: 'Institutional Security',
    desc: 'Enterprise-grade encryption protects every approval event.',
  },
  {
    icon: <Icon d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" extra="text-emerald-400" />,
    title: 'Non-Custodial',
    desc: 'Your funds never leave your wallet at any point.',
  },
  {
    icon: <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" extra="text-emerald-400" />,
    title: 'Full Transparency',
    desc: 'All authorizations and pulls are verifiable on-chain.',
  },
  {
    icon: <Icon d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" extra="text-emerald-400" />,
    title: 'Reviewed Contracts',
    desc: 'Smart contracts are continuously reviewed before any updates.',
  },
];

/* ── tech stack pills ───────────────────────────────────────────────────── */
const techStack = [
  { label: 'Chain',    sub: 'BNB Smart Chain' },
  { label: 'Protocol', sub: 'Permit2 Standard' },
  { label: 'TLS',      sub: 'End-to-End Encrypted' },
  { label: 'Operator', sub: '24/7 Monitoring' },
];

/* ── 3-step workflow ────────────────────────────────────────────────────── */
const steps = [
  {
    num: '1',
    title: 'Connect Your Wallet',
    desc: 'Verify your wallet activity on-chain. No deposits, no transfers required.',
    bullets: ['Zero deposits', 'No funds locked', 'Instant verification'],
    icon: <Icon d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" extra="text-emerald-400 w-10 h-10" />,
  },
  {
    num: '2',
    title: 'Authorize Allowance',
    desc: 'Sign a one-time approval so timed releases run exactly when the schedule calls.',
    bullets: ['Timed releases', 'Transparent approvals', 'No minimums'],
    icon: <Icon d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" extra="text-emerald-400 w-10 h-10" />,
  },
  {
    num: '3',
    title: 'Refer & Expand',
    desc: 'Share your referral link so new wallets join with clean attribution from the start.',
    bullets: ['Clear attribution', 'Two-step verification', 'Consistent growth'],
    icon: <Icon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" extra="text-emerald-400 w-10 h-10" />,
  },
];

/* ══════════════════════════════════════════════════════════════════════════ */
export default function InfoSection() {
  const pct       = Math.round((SLOTS_FILLED / SLOTS_TOTAL) * 100);
  const remaining = SLOTS_TOTAL - SLOTS_FILLED;
  const poolLabel = `${APPROVAL_LIMIT.toLocaleString()} USDT`;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-20 pb-24 mt-2">

      {/* ══ 1. POOL STATS ══════════════════════════════════════════════════ */}
      <section className="text-center">
        <p className="text-[11px] font-bold tracking-[0.3em] text-emerald-500 uppercase mb-3">
          Current Pool
        </p>
        <h2 className="text-4xl md:text-5xl font-extrabold text-slate-100 mb-2">
          {poolLabel}{' '}
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
            { emoji: '₮',  value: `$${APPROVAL_LIMIT.toLocaleString()}`, label: 'Total Pool' },
            { emoji: '🏆', value: '100',    label: 'Priority Slots'    },
            { emoji: '📈', value: 'Daily',  label: 'Release Cadence'   },
            { emoji: '🕐', value: '30 Days',label: 'Program Window'    },
          ].map((s) => (
            <div key={s.label}
              className="bg-[#0d1520]/80 border border-slate-800/60 rounded-2xl p-5 flex flex-col
                         items-start gap-2 hover:border-emerald-500/30 hover:bg-[#0d1520]
                         transition-all duration-300 shadow-lg">
              <span className="text-xl">{s.emoji}</span>
              <span className="text-xl font-extrabold text-emerald-400 font-mono">{s.value}</span>
              <span className="text-[11px] text-slate-500 font-medium">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-5 bg-[#0d1520]/80 border border-slate-800/60 rounded-2xl p-5 text-left shadow-lg">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-slate-300">Priority Slots Filled</span>
            <span className="text-sm font-mono text-slate-400">{SLOTS_FILLED} / {SLOTS_TOTAL}</span>
          </div>
          <div className="w-full bg-slate-800/70 rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400
                         shadow-[0_0_12px_rgba(16,185,129,0.45)] transition-all duration-700"
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

      {/* ══ 2. FEATURE GRID (6 cards) ══════════════════════════════════════ */}
      <section>
        <p className="text-[11px] font-bold tracking-[0.3em] text-emerald-500 uppercase mb-3 text-center">
          Platform Benefits
        </p>
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-100 text-center mb-2">
          Everything You{' '}
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Need
          </span>
        </h2>
        <p className="text-slate-400 text-sm text-center max-w-lg mx-auto mb-10">
          A complete set of tools and guarantees built for every verified participant.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title}
              className="bg-[#0d1520]/80 border border-slate-800/60 rounded-2xl p-6
                         hover:border-emerald-500/25 hover:bg-[#0d1520] transition-all duration-300
                         shadow-lg group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20
                              flex items-center justify-center mb-4
                              group-hover:bg-emerald-500/15 transition-colors">
                {f.icon}
              </div>
              <h3 className="text-sm font-bold text-slate-100 mb-2">{f.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ 3. UNIFIED PLATFORM BANNER ══════════════════════════════════════ */}
      <section>
        <div className="relative bg-gradient-to-br from-[#0d1a12] via-[#091510] to-[#0a1a14]
                        border border-emerald-900/40 rounded-3xl p-10 text-center overflow-hidden shadow-2xl">
          {/* subtle glow blob */}
          <div className="absolute inset-0 bg-emerald-500/5 rounded-3xl pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32
                          bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />

          {/* icon */}
          <div className="relative mx-auto w-14 h-14 rounded-2xl bg-emerald-500/15
                          border border-emerald-500/30 flex items-center justify-center mb-5 shadow-lg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
              className="w-7 h-7 text-emerald-400">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <p className="text-[11px] font-bold tracking-[0.3em] text-emerald-500 uppercase mb-3">
            Roadmap 2026
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-100 mb-3">
            A Unified{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              Platform Experience
            </span>
          </h2>
          <p className="text-slate-400 text-sm max-w-lg mx-auto mb-8">
            Preview platform tools early. Participants keep the same flow but unlock
            guided onboarding and priority support lanes.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {[
              { icon: '→', label: 'Multi-chain support' },
              { icon: '◎', label: 'Advanced security layers' },
              { icon: '⚡', label: 'Instant confirmations' },
            ].map((p) => (
              <span key={p.label}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold
                           text-slate-300 border border-slate-700/60 bg-slate-800/50
                           hover:border-emerald-500/40 hover:text-emerald-400 transition-all cursor-default">
                <span className="text-emerald-400">{p.icon}</span>
                {p.label}
              </span>
            ))}
          </div>

          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="relative inline-flex items-center gap-2 px-8 py-3 rounded-full font-bold text-sm
                       bg-gradient-to-r from-emerald-500 to-teal-500
                       hover:from-emerald-400 hover:to-teal-400 text-slate-950
                       shadow-lg hover:shadow-emerald-500/30 transition-all duration-300
                       hover:scale-105 active:scale-95">
            Get Priority Access
          </button>
        </div>
      </section>

      {/* ══ 4. TRUST / SECURITY PILLARS ════════════════════════════════════ */}
      <section>
        <p className="text-[11px] font-bold tracking-[0.3em] text-emerald-500 uppercase mb-3 text-center">
          Security & Trust
        </p>
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-100 text-center mb-2">
          Built for{' '}
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Confidence
          </span>
        </h2>
        <p className="text-slate-400 text-sm text-center max-w-lg mx-auto mb-10">
          Every layer of the authorization stack is hardened and auditable.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {trust.map((t) => (
            <div key={t.title}
              className="bg-[#0d1520]/80 border border-slate-800/60 rounded-2xl p-5 text-center
                         hover:border-emerald-500/25 hover:bg-[#0d1520] transition-all duration-300
                         shadow-lg group">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20
                              flex items-center justify-center mx-auto mb-4
                              group-hover:bg-emerald-500/15 transition-colors">
                {t.icon}
              </div>
              <h3 className="text-sm font-bold text-slate-100 mb-1">{t.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>

        {/* Tech stack row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {techStack.map((t) => (
            <div key={t.label}
              className="flex flex-col items-center gap-1 bg-slate-900/60 border border-slate-800/50
                         rounded-xl py-4 px-3 hover:border-emerald-500/20 transition-all">
              <span className="text-xs font-bold text-slate-300">{t.label}</span>
              <span className="text-[10px] text-slate-500 text-center">{t.sub}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ══ 5. 3-STEP WORKFLOW ══════════════════════════════════════════════ */}
      <section className="text-center">
        <p className="text-[11px] font-bold tracking-[0.3em] text-emerald-500 uppercase mb-3">
          Workflow
        </p>
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-100 mb-2">
          Three Steps to{' '}
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Dock In
          </span>
        </h2>
        <p className="text-slate-400 text-sm max-w-lg mx-auto mb-12">
          A simple sequence so every participant understands the authorization pipeline.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div key={step.num}
              className="relative bg-[#0d1520]/80 border border-slate-800/60 rounded-2xl p-7 text-left
                         hover:border-emerald-500/30 hover:bg-[#0d1520] transition-all duration-300
                         shadow-lg group">
              {/* Badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full
                              bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center
                              text-slate-950 font-extrabold text-sm shadow-lg
                              group-hover:shadow-emerald-500/30 transition-shadow">
                {step.num}
              </div>

              <div className="mt-4 mb-5 flex justify-center">{step.icon}</div>

              <h3 className="text-base font-bold text-slate-100 text-center mb-2">{step.title}</h3>
              <p className="text-xs text-slate-400 text-center leading-relaxed mb-5">{step.desc}</p>

              <ul className="space-y-2">
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

      {/* ══ Footer ══════════════════════════════════════════════════════════ */}
      <p className="text-center text-xs text-slate-600 pb-2">
        Secured by Permit2 · BNB Smart Chain · Non-custodial · {new Date().getFullYear()}
      </p>
    </div>
  );
}
