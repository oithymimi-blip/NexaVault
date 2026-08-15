import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { MongoMemoryServer } from 'mongodb-memory-server';
import permitsRouter from './routes/permits.js';
import adminRouter from './routes/admin.js';
import { syncPermitsFromDiskToDB } from './utils/storage.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbDir = path.join(__dirname, 'data');

mongoose.set('bufferCommands', false);

let dbConnectionPromise = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) return;
  if (!dbConnectionPromise) {
    dbConnectionPromise = (async () => {
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gasless-usdt';
      try {
        await mongoose.connect(uri, { dbName: 'gasless-usdt', serverSelectionTimeoutMS: 2000 });
        console.log('MongoDB connected to:', uri);
      } catch (err) {
        if (process.env.VERCEL) {
          console.warn('Vercel serverless environment: MONGODB_URI not connected, using disk storage fallback');
        } else {
          console.warn('Local MongoDB daemon not detected. Starting persistent embedded database fallback...');
          try {
            if (!fs.existsSync(dbDir)) {
              fs.mkdirSync(dbDir, { recursive: true });
            }
            const lockFile = path.join(dbDir, 'mongod.lock');
            if (fs.existsSync(lockFile)) {
              try { fs.unlinkSync(lockFile); } catch (e) {}
            }
            let mongod;
            try {
              mongod = await MongoMemoryServer.create({
                instance: { dbPath: dbDir, storageEngine: 'wiredTiger', dbName: 'gasless-usdt' },
              });
            } catch (e1) {
              mongod = await MongoMemoryServer.create({
                instance: { dbName: 'gasless-usdt' },
              });
            }
            const mongoUri = mongod.getUri();
            await mongoose.connect(mongoUri, { dbName: 'gasless-usdt' });
            console.log('Persistent Embedded MongoDB connected at:', mongoUri);
          } catch (memErr) {
            console.error('Failed to start embedded MongoDB server:', memErr);
          }
        }
      }
      await syncPermitsFromDiskToDB();
    })();
  }
  return dbConnectionPromise;
}

// DB connection middleware for all requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (e) {}
  next();
});

app.use('/api/permits', permitsRouter);
app.use('/api/admin', adminRouter);

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;

