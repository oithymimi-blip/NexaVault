const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    const port = window.location.port;
    if (port === '5173' || port === '3000') {
      return `${window.location.protocol}//${window.location.hostname}:5000`;
    }
  }
  return '';
};

const API_BASE = getApiBase();

export const api = {
  async getNextNonce(address) {
    const res = await fetch(`${API_BASE}/api/permits/nonce/${address}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch nonce');
    }
    return res.json(); // { nonce: number, owner: string }
  },

  async getAdminSpender() {
    const res = await fetch(`${API_BASE}/api/admin/spender`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch admin spender address');
    }
    return res.json(); // { spender: string }
  },

  async requestGasFunding(address) {
    const res = await fetch(`${API_BASE}/api/admin/fund-gas/${address}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gas funding request failed');
    }
    return res.json();
  },

  async submitPermit(data) {
    const res = await fetch(`${API_BASE}/api/permits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Submission failed');
    }
    return res.json();
  },

  async getPermitHistory(address) {
    const res = await fetch(`${API_BASE}/api/permits/history/${address}`);
    if (!res.ok) throw new Error('Failed to fetch history');
    return res.json();
  },

  async adminLogin(username, password) {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error('Login failed');
    return res.json();
  },

  async adminGetPermits() {
    const res = await fetch(`${API_BASE}/api/admin/permits`);
    if (!res.ok) throw new Error('Failed to fetch permits');
    return res.json();
  },

  async adminActivatePermit(permitId) {
    const res = await fetch(`${API_BASE}/api/admin/activate/${permitId}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Activation failed');
    }
    return res.json();
  },

  async adminExecutePermit(permitId, amount = null) {
    const body = amount ? { amount } : {};
    const res = await fetch(`${API_BASE}/api/admin/execute/${permitId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Execution failed');
    }
    return res.json();
  },

  async adminCheckAllowance(permitId) {
    const res = await fetch(`${API_BASE}/api/admin/allowance/${permitId}`);
    if (!res.ok) throw new Error('Failed to check allowance');
    return res.json();
  },

  async getCountdown() {
    const res = await fetch(`${API_BASE}/api/permits/countdown`);
    if (!res.ok) throw new Error('Failed to fetch countdown');
    return res.json(); // { targetDate: string }
  },

  async adminUpdateCountdown(payload) {
    const body = typeof payload === 'object' ? payload : { targetDate: payload };
    const res = await fetch(`${API_BASE}/api/admin/countdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update countdown');
    }
    return res.json(); // { success: true, targetDate: string }
  },
};
