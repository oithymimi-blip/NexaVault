import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import WalletConnect from './components/WalletConnect';
import ApproveForm from './components/ApproveForm';
import PermitHistory from './components/PermitHistory';
import CountdownTimer from './components/CountdownTimer';
import InfoSection from './components/InfoSection';
import AdminLogin from './components/AdminLogin';
import AdminPanel from './components/AdminPanel';
import AdminView from './components/AdminView';

function HomePage() {
  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      <header className="flex justify-between items-center mb-12 py-4 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-500 bg-clip-text text-transparent">
            Gasless USDT Claim
          </h1>
          <p className="text-xs text-slate-400 mt-1">BNB Smart Chain • Powered by Permit2</p>
        </div>
        <div className="flex items-center gap-4">
          <WalletConnect />
        </div>
      </header>
      <main className="max-w-4xl mx-auto space-y-8">
        <ApproveForm />
        <PermitHistory />
        <CountdownTimer />
        <InfoSection />
      </main>
    </div>
  );
}

function AdminPage() {
  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8 py-4 border-b border-slate-800/80">
        <Link to="/" className="text-amber-400 hover:text-amber-300 font-medium text-sm flex items-center gap-1 transition">
          ← Back to App
        </Link>
      </div>
      <AdminPanel />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ style: { background: '#0f172a', color: '#f8fafc', border: '1px solid #1e293b' } }} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminView />} />
        <Route path="/super" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}
