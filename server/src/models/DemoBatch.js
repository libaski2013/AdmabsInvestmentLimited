import mongoose from 'mongoose';

const demoBatchSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  status: { type: String, enum: ['creating', 'ready', 'deleting', 'deleted', 'failed'], default: 'creating' },
  recordIds: { type: mongoose.Schema.Types.Mixed, default: {} },
  counts: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletedAt: Date,
  error: String,
}, { timestamps: true });

export default mongoose.model('DemoBatch', demoBatchSchema);
