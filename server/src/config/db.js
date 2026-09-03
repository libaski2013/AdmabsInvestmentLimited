import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let memoryServer = null;

export async function connectDB(log) {
  mongoose.set('strictQuery', true);

  const uri = process.env.MONGODB_URI?.trim();

  if (uri) {
    await mongoose.connect(uri);
    log.info('Connected to MongoDB (MONGODB_URI)');
    return;
  }

  // No URI configured — spin up a local, file-backed MongoDB so the app
  // works out of the box without any manual database setup. Data persists
  // across restarts in server/.mongo-data.
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const dbPath = path.join(__dirname, '..', '..', '.mongo-data');
  fs.mkdirSync(dbPath, { recursive: true });

  memoryServer = await MongoMemoryServer.create({
    instance: {
      dbPath,
      storageEngine: 'wiredTiger',
      port: 27117,
    },
  });

  const localUri = memoryServer.getUri('admabs');
  await mongoose.connect(localUri);
  log.info(`Connected to local MongoDB at ${localUri} (data persisted in server/.mongo-data)`);
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
