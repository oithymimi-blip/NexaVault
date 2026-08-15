import { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { ethers } from 'ethers';

// ── Shared context ──────────────────────────────────────────────────────────
const MetaMaskContext = createContext(null);

const BSC_CHAIN_ID = '0x38'; // 56 decimal

async function switchToBSC() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BSC_CHAIN_ID }],
    });
  } catch (err) {
    if (err.code === 4902) {
      // BSC not yet added to the wallet — add it first
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: BSC_CHAIN_ID,
          chainName: 'BNB Smart Chain',
          nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
          rpcUrls: ['https://bsc-dataseed.binance.org/'],
          blockExplorerUrls: ['https://bscscan.com/'],
        }],
      });
    } else {
      throw err;
    }
  }
}

// ── Provider (wrap your app with this once) ─────────────────────────────────
export function MetaMaskProvider({ children }) {
  const [provider, setProvider] = useState(null);
  const [signer,   setSigner]   = useState(null);
  const [account,  setAccount]  = useState(null);
  const [chainId,  setChainId]  = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) throw new Error('No wallet detected. Please install MetaMask.');
    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      await switchToBSC();
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const userSigner = await browserProvider.getSigner();
      const network    = await browserProvider.getNetwork();
      setProvider(browserProvider);
      setSigner(userSigner);
      setAccount(accounts[0]);
      setChainId(Number(network.chainId));
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      setAccount(accounts[0] || null);
      if (!accounts[0]) { setProvider(null); setSigner(null); setChainId(null); }
    };
    const handleChainChanged = () => window.location.reload();

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged',    handleChainChanged);

    // Auto-restore if already authorised
    window.ethereum.request({ method: 'eth_accounts' }).then(async (accounts) => {
      if (accounts.length > 0) {
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        const userSigner = await browserProvider.getSigner();
        const network    = await browserProvider.getNetwork();
        setProvider(browserProvider);
        setSigner(userSigner);
        setAccount(accounts[0]);
        setChainId(Number(network.chainId));
      }
    }).catch(console.error);

    return () => {
      window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener?.('chainChanged',    handleChainChanged);
    };
  }, []);

  return (
    <MetaMaskContext.Provider value={{ provider, signer, account, chainId, isConnecting, connectWallet }}>
      {children}
    </MetaMaskContext.Provider>
  );
}

// ── Hook (all components share the same state via context) ──────────────────
export function useMetaMask() {
  const ctx = useContext(MetaMaskContext);
  if (!ctx) throw new Error('useMetaMask must be used inside <MetaMaskProvider>');
  return ctx;
}
