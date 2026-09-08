import mongoose from 'mongoose';

const migrationRunSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  source: String,
  sourceExportedAt: Date,
  status: { type: String, enum: ['running', 'completed', 'failed'], required: true },
  summary: mongoose.Schema.Types.Mixed,
  error: String,
}, { timestamps: true });

export default mongoose.model('MigrationRun', migrationRunSchema);
