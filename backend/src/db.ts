import mongoose from 'mongoose';
import { logger } from './utils/logger';

const MONGODB_URI = process.env.MONGODB_URI ?? '';

export const connectDB = async () => {
  if (!MONGODB_URI) {
    logger.warn('MONGODB_URI is not set. Skipping MongoDB connection.');
    return;
  }

  try {
    logger.info('Attempting to connect to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      family: 4,
    });
    logger.info('Connected to MongoDB');
  } catch (err: any) {
    logger.error(`MongoDB Connection Error: ${err.message}`);
    logger.warn('MongoDB not available. Running in limited mode.');
  }
};
