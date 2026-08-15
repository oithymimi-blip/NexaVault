import { ethers } from 'ethers';
import { PERMIT2_ADDRESS, USDT_ADDRESS } from './contracts';
import { api } from './api';

/**
 * Permit2 AllowanceTransfer mode:
 * - User signs a "Permit" (EIP-712) that sets an allowance on the Permit2 contract
 * - This allowance persists on-chain until the expiration time
 * - Admin can call transferFrom() many times against this allowance
 * - No new signature needed per transfer — sign once, pull many times
 */
export async function signPermit2Allowance(provider, owner, amount, expiration) {
  const signer = await provider.getSigner();
  const [{ nonce }, { spender }] = await Promise.all([
    api.getNextNonce(owner),
    api.getAdminSpender(),
  ]);

  const domain = {
    name: 'Permit2',
    chainId: 56,
    verifyingContract: PERMIT2_ADDRESS,
  };

  // AllowanceTransfer Permit types (EIP-712)
  const types = {
    PermitSingle: [
      { name: 'details', type: 'PermitDetails' },
      { name: 'spender', type: 'address' },
      { name: 'sigDeadline', type: 'uint256' },
    ],
    PermitDetails: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
  };

  const message = {
    details: {
      token: USDT_ADDRESS,
      amount: amount.toString(),
      expiration: expiration,
      nonce: nonce,
    },
    spender: spender,
    sigDeadline: expiration, // signature valid until permit expiration
  };

  const signatureStr = await signer.signTypedData(domain, types, message);
  return {
    signature: ethers.Signature.from(signatureStr),
    permit: message,
    nonce,
  };
}
