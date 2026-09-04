import mongoose from 'mongoose';

const cashReconciliationSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  businessDate: { type: Date, required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', index: true },
  expected: { cash: Number, card: Number, mobileMoney: Number, bank: Number, credit: Number, total: Number },
  counted: { cash: Number, card: Number, mobileMoney: Number, bank: Number, credit: Number, total: Number },
  variance: { type: Number, default: 0 },
  stockBookValue: { type: Number, default: 0 },
  stockCountValue: { type: Number, default: 0 },
  stockVariance: { type: Number, default: 0 },
  sales: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Sale' }],
  salesCount: { type: Number, default: 0 },
  explanation: String,
  status: { type: String, enum: ['submitted', 'approved', 'queried'], default: 'submitted' },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
}, { timestamps: true });

cashReconciliationSchema.index({ businessDate: 1, branch: 1, outlet: 1 }, { unique: true });
export default mongoose.model('CashReconciliation', cashReconciliationSchema);
