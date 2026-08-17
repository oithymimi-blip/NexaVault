import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Permit from '../models/Permit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isVercel = Boolean(process.env.VERCEL);
const dataDir = isVercel ? '/tmp' : path.join(__dirname, '..', 'data');
const jsonFilePath = isVercel ? path.join('/tmp', 'permits_db.json') : path.join(__dirname, '..', 'data', 'permits_db.json');
const bundledJsonPath = path.join(__dirname, '..', 'data', 'permits_db.json');

try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Seed /tmp file on Vercel from bundled permits_db.json if it exists
  if (!fs.existsSync(jsonFilePath)) {
    let initialData = '[]';
    if (fs.existsSync(bundledJsonPath)) {
      try { initialData = fs.readFileSync(bundledJsonPath, 'utf8'); } catch (e) {}
    }
    fs.writeFileSync(jsonFilePath, initialData, 'utf8');
  }
} catch (fsErr) {
  console.warn('Storage path init warning:', fsErr.message);
}

/**
 * Reads all permits from disk safely, merging bundled git records with /tmp records.
 */
export function readPermitsFromFile() {
  try {
    let filePermits = [];
    if (fs.existsSync(jsonFilePath)) {
      const raw = fs.readFileSync(jsonFilePath, 'utf8');
      if (raw.trim()) filePermits = JSON.parse(raw);
    }

    let bundledPermits = [];
    if (isVercel && fs.existsSync(bundledJsonPath)) {
      try {
        const rawBundled = fs.readFileSync(bundledJsonPath, 'utf8');
        if (rawBundled.trim()) bundledPermits = JSON.parse(rawBundled);
      } catch (e) {}
    }

    const permitMap = new Map();
    [...bundledPermits, ...filePermits].forEach((p) => {
      const key = p._id ? String(p._id) : (p.r && p.s ? `${p.owner?.toLowerCase()}_${p.r}_${p.s}` : `${p.owner?.toLowerCase()}_${p.nonce}_${p.createdAt}`);
      if (!permitMap.has(key)) {
        permitMap.set(key, p);
      } else {
        const existing = permitMap.get(key);
        permitMap.set(key, { ...existing, ...p });
      }
    });

    return Array.from(permitMap.values());
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
  // Ensure DB connection is active before querying
  if (mongoose.connection.readyState !== 1) {
    try {
      const uri = process.env.MONGODB_URI || 'mongodb+srv://magicalbiral1007_db_user:ZOXAYVC2eAUgZMX0@cluster0.imn70iv.mongodb.net/gasless-usdt?retryWrites=true&w=majority';
      await mongoose.connect(uri, { dbName: 'gasless-usdt', serverSelectionTimeoutMS: 5000 });
    } catch (e) {
      console.warn('DB connection check in getAllPermits:', e.message);
    }
  }

  let mongoPermits = [];
  if (mongoose.connection.readyState === 1) {
    try {
      mongoPermits = await Permit.find().sort({ createdAt: -1 }).lean();
    } catch (err) {
      console.warn('MongoDB query failed, falling back to disk file:', err.message);
    }
  }

  const filePermits = readPermitsFromFile();

  // Smart Priority Merge:
  // mongoPermits represents Cloud Ground Truth.
  // filePermits provides fallback for any local permits created offline.
  const permitMap = new Map();

  // 1. Put file permits first
  filePermits.forEach((p) => {
    if (!p) return;
    const key = p._id ? String(p._id) : (p.r && p.s ? `${p.owner?.toLowerCase()}_${p.r}_${p.s}` : `${p.owner?.toLowerCase()}_${p.nonce}_${p.createdAt}`);
    permitMap.set(key, p);
  });

  // 2. Overlay mongoPermits on top so MongoDB Atlas ALWAYS overrides filePermits with Ground Truth data
  mongoPermits.forEach((p) => {
    if (!p) return;
    const key = p._id ? String(p._id) : (p.r && p.s ? `${p.owner?.toLowerCase()}_${p.r}_${p.s}` : `${p.owner?.toLowerCase()}_${p.nonce}_${p.createdAt}`);
    if (permitMap.has(key)) {
      const existing = permitMap.get(key);
      permitMap.set(key, { ...existing, ...p });
    } else {
      permitMap.set(key, p);
    }
  });

  const merged = Array.from(permitMap.values());
  merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  // Sync any file permits into Mongo if missing from Mongo
  if (mongoose.connection.readyState === 1) {
    for (const p of merged) {
      const existsInMongo = mongoPermits.some(mp => String(mp._id) === String(p._id));
      if (!existsInMongo) {
        try {
          const permitData = { ...p };
          delete permitData.__v;
          await Permit.create(permitData);
        } catch (e) {}
      }
    }
  }

  writePermitsToFile(merged);
  return merged;
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
      let existing = null;
      if (p._id) {
        try { existing = await Permit.findById(p._id); } catch (e) {}
      }
      if (!existing && p.r && p.s) {
        existing = await Permit.findOne({ r: p.r, s: p.s });
      }

      if (!existing) {
        const permitData = { ...p };
        if (!permitData._id) permitData._id = new mongoose.Types.ObjectId().toString();
        delete permitData.__v;
        await Permit.create(permitData);
        restoredCount++;
      } else {
        // Protect Mongo ground truth: Only update if disk has higher status priority or new executions
        const statusPriority = { executed: 3, activated: 2, pending: 1 };
        const mongoPriority = statusPriority[existing.status] || 0;
        const diskPriority = statusPriority[p.status] || 0;

        if (diskPriority > mongoPriority) {
          existing.status = p.status;
        }
        if (p.activationTxHash && !existing.activationTxHash) {
          existing.activationTxHash = p.activationTxHash;
        }
        if (p.activatedAt && !existing.activatedAt) {
          existing.activatedAt = p.activatedAt;
        }
        if (p.executions && p.executions.length > (existing.executions || []).length) {
          existing.executions = p.executions;
          existing.totalTransferred = p.totalTransferred || existing.totalTransferred;
        }
        await existing.save();
      }
    }
    console.log(`Disk sync complete. Synced ${restoredCount} new permits into MongoDB.`);
  } catch (err) {
    console.error('Error syncing permits from disk to DB:', err);
  }
}
