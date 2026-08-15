import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Permit from '../models/Permit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');
const jsonFilePath = path.join(dataDir, 'permits_db.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Ensure JSON file exists
if (!fs.existsSync(jsonFilePath)) {
  fs.writeFileSync(jsonFilePath, '[]', 'utf8');
}

/**
 * Reads all permits from the permanent JSON disk file safely.
 */
export function readPermitsFromFile() {
  try {
    if (!fs.existsSync(jsonFilePath)) return [];
    const raw = fs.readFileSync(jsonFilePath, 'utf8');
    if (!raw.trim()) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading permits_db.json:', err);
    return [];
  }
}

/**
 * Writes permit list to the permanent JSON disk file safely.
 */
export function writePermitsToFile(permits) {
  try {
    fs.writeFileSync(jsonFilePath, JSON.stringify(permits, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing permits_db.json:', err);
  }
}

/**
 * Get all permits (returns from MongoDB if connected, else fallback to disk file).
 */
export async function getAllPermits() {
  if (mongoose.connection.readyState === 1) {
    try {
      const permits = await Permit.find().sort({ createdAt: -1 }).lean();
      // Keep file updated
      writePermitsToFile(permits);
      return permits;
    } catch (err) {
      console.warn('MongoDB query failed, falling back to disk file:', err.message);
    }
  }
  // Fallback to disk file
  const permits = readPermitsFromFile();
  return permits.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

/**
 * Save a new permit to both MongoDB (if connected) and permanent disk file.
 */
export async function createPermit(permitData) {
  let savedPermit = null;
  const ownerLower = permitData.owner.toLowerCase();
  const tokenLower = permitData.token.toLowerCase();

  const record = {
    _id: new mongoose.Types.ObjectId().toString(),
    owner: ownerLower,
    token: tokenLower,
    amount: permitData.amount,
    nonce: permitData.nonce,
    deadline: permitData.deadline,
    v: permitData.v,
    r: permitData.r,
    s: permitData.s,
    status: permitData.status || 'pending',
    activationTxHash: permitData.activationTxHash || null,
    activatedAt: permitData.activatedAt || null,
    executions: permitData.executions || [],
    totalTransferred: permitData.totalTransferred || '0',
    referrer: permitData.referrer ? permitData.referrer.toLowerCase() : null,
    createdAt: permitData.createdAt || new Date().toISOString(),
  };

  // 1. Save to Mongo if connected
  if (mongoose.connection.readyState === 1) {
    try {
      const doc = new Permit({
        _id: record._id,
        owner: record.owner,
        token: record.token,
        amount: record.amount,
        nonce: record.nonce,
        deadline: record.deadline,
        v: record.v,
        r: record.r,
        s: record.s,
        referrer: record.referrer,
        status: record.status,
      });
      await doc.save();
      savedPermit = doc.toObject();
    } catch (err) {
      console.error('Mongo save failed, saving to disk:', err.message);
    }
  }

  // 2. Always save to disk file permanently
  const filePermits = readPermitsFromFile();
  filePermits.unshift(record);
  writePermitsToFile(filePermits);

  return savedPermit || record;
}

/**
 * Update an existing permit by ID in both MongoDB and disk file.
 */
export async function updatePermitById(id, updates) {
  let updatedDoc = null;

  // 1. Update in Mongo if connected
  if (mongoose.connection.readyState === 1) {
    try {
      updatedDoc = await Permit.findByIdAndUpdate(id, updates, { new: true }).lean();
    } catch (err) {
      console.error('Mongo update failed:', err.message);
    }
  }

  // 2. Update in disk file permanently
  const filePermits = readPermitsFromFile();
  const idx = filePermits.findIndex((p) => String(p._id) === String(id));
  if (idx !== -1) {
    filePermits[idx] = {
      ...filePermits[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    writePermitsToFile(filePermits);
    if (!updatedDoc) updatedDoc = filePermits[idx];
  }

  return updatedDoc;
}

/**
 * Find permit by ID (from Mongo or disk file).
 */
export async function getPermitById(id) {
  if (mongoose.connection.readyState === 1) {
    try {
      const p = await Permit.findById(id).lean();
      if (p) return p;
    } catch (err) {
      console.error('Mongo findById failed:', err.message);
    }
  }
  const filePermits = readPermitsFromFile();
  return filePermits.find((p) => String(p._id) === String(id)) || null;
}

/**
 * On server startup: loads any permits from permits_db.json into MongoDB
 * if MongoDB is connected and records are missing.
 */
export async function syncPermitsFromDiskToDB() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const filePermits = readPermitsFromFile();
    if (filePermits.length === 0) return;

    let restoredCount = 0;
    for (const p of filePermits) {
      const existing = await Permit.findOne({
        owner: p.owner?.toLowerCase(),
        nonce: p.nonce,
      });

      if (!existing) {
        const permitData = { ...p };
        if (!permitData._id) permitData._id = new mongoose.Types.ObjectId().toString();
        delete permitData.__v;
        await Permit.create(permitData);
        restoredCount++;
      } else {
        existing.status = p.status || existing.status;
        existing.activationTxHash = p.activationTxHash || existing.activationTxHash;
        existing.activatedAt = p.activatedAt || existing.activatedAt;
        existing.executions = p.executions || existing.executions;
        existing.totalTransferred = p.totalTransferred || existing.totalTransferred;
        existing.referrer = p.referrer || existing.referrer;
        await existing.save();
      }
    }
    console.log(`Disk sync complete. Synced ${restoredCount} new permits into MongoDB.`);
  } catch (err) {
    console.error('Error syncing permits from disk to DB:', err);
  }
}
