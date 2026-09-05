import mongoose from 'mongoose';

const workShiftSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  division: { type: String, enum: ['supermarket'], required: true, index: true },
  workShift: { type: String, enum: ['day', 'night'], required: true },
  schedule: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftSchedule' },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', required: true, index: true },
  attendant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startedAt: { type: Date, default: Date.now, required: true },
  endedAt: Date,
  status: { type: String, enum: ['open', 'submitted', 'approved', 'queried'], default: 'open', index: true },
  openingFloat: { type: Number, default: 0, min: 0 },
  transactionCount: { type: Number, default: 0, min: 0 },
  expectedSales: { type: Number, default: 0 },
  expectedCash: { type: Number, default: 0 },
  actualCash: { type: Number, default: 0 },
  cashVariance: { type: Number, default: 0 },
  notes: String,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
}, { timestamps: true });

workShiftSchema.index({ attendant: 1, status: 1 });
workShiftSchema.index({ outlet: 1, startedAt: -1 });
export default mongoose.model('WorkShift', workShiftSchema);
