import mongoose from 'mongoose';

// Tracks next available nonce (bitPos) for each user (wordPos always 0)
const nonceSchema = new mongoose.Schema({
  owner: { type: String, required: true, lowercase: true, unique: true },
  nextNonce: { type: Number, default: 0 },
});

export default mongoose.model('Nonce', nonceSchema);
