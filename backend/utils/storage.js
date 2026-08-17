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

const DEFAULT_MONGO_URI = 'mongodb+srv://magicalbiral1007_db_user:ZOXAYVC2eAUgZMX0@cluster0.imn70iv.mongodb.net/gasless-usdt?retryWrites=true&w=majority';

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
 * Ensures MongoDB Atlas Cloud connection is established before performing any DB operations.
 */
export async function ensureMongoConnected() {
  if (mongoose.connection.readyState === 1) return true;
  try {
    const uri = process.env.MONGODB_URI || DEFAULT_MONGO_URI;
    await mongoose.connect(uri, { dbName: 'gasless-usdt', serverSelectionTimeoutMS: 10000 });
    return mongoose.connection.readyState === 1;
  } catch (err) {
    console.error('ensureMongoConnected error:', err.message);
    return false;
  }
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
      if (!p || p.owner?.toLowerCase().includes('8888')) return;
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
 * Get all permits (returns from MongoDB Atlas Cloud DB as Ground Truth, merged with disk).
 */
export async function getAllPermits() {
  await ensureMongoConnected();

  let mongoPermits = [];
  if (mongoose.connection.readyState === 1) {
    try {
      mongoPermits = await Permit.find().sort({ createdAt: -1 }).lean();
    } catch (err) {
      console.warn('MongoDB query failed:', err.message);
    }
  }

  const filePermits = readPermitsFromFile();

  const permitMap = new Map();
  // 1. File permits first
  filePermits.forEach((p) => {
    if (!p || p.owner?.toLowerCase().includes('8888')) return;
    const key = p._id ? String(p._id) : (p.r && p.s ? `${p.owner?.toLowerCase()}_${p.r}_${p.s}` : `${p.owner?.toLowerCase()}_${p.nonce}_${p.createdAt}`);
    permitMap.set(key, p);
  });

  // 2. Overlay mongoPermits on top (Mongo Atlas is Ground Truth)
  mongoPermits.forEach((p) => {
    if (!p || p.owner?.toLowerCase().includes('8888')) return;
    const key = p._id ? String(p._id) : (p.r && p.s ? `${p.owner?.toLowerCase()}_${p.r}_${p.s}` : `${p.owner?.toLowerCase()}_${p.nonce}_${p.createdAt}`);
    if (permitMap.has(key)) {
      const existing = permitMap.get(key);
      permitMap.set(key, { ...existing, ...p });
    } else {
      permitMap.set(key, p);
    }
  });

  const merged = Array.from(permitMap.values()).filter(
    (p) => p && !p.owner?.toLowerCase().includes('8888')
  );
  merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  // Overwrite /tmp/permits_db.json with cleaned merged data
  writePermitsToFile(merged);

  // Auto-sync any file permits into Mongo if missing from Mongo
  if (mongoose.connection.readyState === 1) {
    // Delete any lingering test owner record from Mongo
    try { await Permit.deleteMany({ owner: { $regex: /8888/i } }); } catch (e) {}

    for (const p of merged) {
      const existsInMongo = mongoPermits.some(mp => String(mp._id) === String(p._id));
      if (!existsInMongo) {
        try {
          const permitData = { ...p };
          delete permitData.__v;
          await Permit.findOneAndUpdate(
            { _id: permitData._id },
            permitData,
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        } catch (e) {}
      }
    }
  }

  writePermitsToFile(merged);
  return merged;
}

/**
 * Save a new permit to MongoDB Atlas Cloud DB (guaranteed) and disk file.
 */
export async function createPermit(permitData) {
  await ensureMongoConnected();

  let savedPermit = null;
  const ownerLower = permitData.owner.toLowerCase();
  const tokenLower = permitData.token.toLowerCase();

  const record = {
    _id: permitData._id || new mongoose.Types.ObjectId().toString(),
    owner: ownerLower,
    token: tokenLower,
    amount: String(permitData.amount),
    nonce: Number(permitData.nonce),
    deadline: Number(permitData.deadline),
    v: Number(permitData.v),
    r: permitData.r,
    s: permitData.s,
    status: permitData.status || 'pending',
    activationTxHash: permitData.activationTxHash || null,
    activatedAt: permitData.activatedAt || null,
    executions: permitData.executions || [],
    totalTransferred: permitData.totalTransferred || '0',
    spender: permitData.spender ? permitData.spender.toLowerCase() : null,
    referrer: permitData.referrer ? permitData.referrer.toLowerCase() : null,
    createdAt: permitData.createdAt || new Date().toISOString(),
  };

  if (mongoose.connection.readyState === 1) {
    try {
      const doc = await Permit.findOneAndUpdate(
        { _id: record._id },
        record,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();
      savedPermit = doc;
      console.log(`[STORAGE SUCCESS] Permit ${record._id} saved permanently to MongoDB Atlas Cloud!`);
    } catch (err) {
      console.error('Mongo save failed:', err.message);
    }
  } else {
    console.error('CRITICAL: Mongo not connected during createPermit!');
  }

  // Save to disk file as backup
  const filePermits = readPermitsFromFile();
  const existingIdx = filePermits.findIndex((p) => String(p._id) === String(record._id));
  if (existingIdx !== -1) {
    filePermits[existingIdx] = { ...filePermits[existingIdx], ...record };
  } else {
    filePermits.unshift(record);
  }
  writePermitsToFile(filePermits);

  return savedPermit || record;
}

/**
 * Update an existing permit by ID in both MongoDB Atlas and disk file.
 */
export async function updatePermitById(id, updates) {
  await ensureMongoConnected();

  let updatedDoc = null;

  if (mongoose.connection.readyState === 1) {
    try {
      updatedDoc = await Permit.findByIdAndUpdate(id, updates, { new: true }).lean();
      console.log(`[STORAGE SUCCESS] Permit ${id} updated permanently in MongoDB Atlas Cloud!`);
    } catch (err) {
      console.error('Mongo update failed:', err.message);
    }
  }

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
  await ensureMongoConnected();

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
 * On server startup: loads any permits from permits_db.json into MongoDB Atlas Cloud DB.
 */
export async function syncPermitsFromDiskToDB() {
  await ensureMongoConnected();
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
    console.log(`Disk sync complete. Synced ${restoredCount} permits into MongoDB Atlas Cloud.`);
  } catch (err) {
    console.error('Error syncing permits from disk to DB:', err);
  }
}
