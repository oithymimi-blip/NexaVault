import { useMetaMask } from '../hooks/useMetaMask';
import toast from 'react-hot-toast';

const BSC_CHAIN_ID = '0x38';

async function switchToBSC() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BSC_CHAIN_ID }],
    });
  } catch (err) {
    if (err.code === 4902) {
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

export default function WalletConnect() {
  const { account, chainId, isConnecting, connectWallet } = useMetaMask();

  const isBSC = chainId === 56;
  const shortAddress = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : '';

  const handleConnect = async () => {
    try {
      await connectWallet();
    } catch (err) {
      toast.error(err.message || 'Failed to connect wallet');
    }
  };

  const handleSwitchNetwork = async () => {
    try {
      await switchToBSC();
    } catch (err) {
      toast.error(err.message || 'Failed to switch network');
    }
  };

  return (
    <div className="flex items-center gap-3">
      {account ? (
        isBSC ? (
          /* Connected + correct network → show address */
          <div className="flex items-center gap-2 bg-[#0d0120]/90 border border-purple-800/60 px-4 py-2 rounded-full backdrop-blur shadow-md">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-semibold font-mono text-purple-100">{shortAddress}</span>
          </div>
        ) : (
          /* Connected but wrong network → clickable switch button */
          <button
            onClick={handleSwitchNetwork}
            className="flex items-center gap-2 bg-slate-900/90 border border-rose-500/50 px-4 py-2 rounded-full backdrop-blur shadow-md cursor-pointer hover:bg-rose-500/10 hover:border-rose-400 transition-all"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse" />
            <span className="text-sm font-semibold text-rose-400">Switch to BSC</span>
          </button>
        )
      ) : (
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white font-bold px-6 py-2.5 rounded-full shadow-lg hover:shadow-purple-500/30 hover:scale-105 transition-all disabled:opacity-50"
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      )}
    </div>
  );
}
