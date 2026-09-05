import mongoose from 'mongoose';

const fuelShiftSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', index: true },
  attendant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pump: { type: mongoose.Schema.Types.ObjectId, ref: 'FuelPump', required: true },
  nozzleCode: { type: String, required: true },
  product: { type: String, required: true },
  openedAt: { type: Date, default: Date.now },
  workShift: { type: String, enum: ['day', 'night'], default: 'day', index: true },
  closedAt: Date,
  openingMeter: { type: Number, required: true, min: 0 },
  closingMeter: { type: Number, min: 0 },
  litresSold: { type: Number, default: 0 },
  testLitres: { type: Number, default: 0, min: 0 },
  pricePerLitre: { type: Number, required: true, min: 0 },
  expectedAmount: { type: Number, default: 0 },
  payments: {
    cash: { type: Number, default: 0, min: 0 }, card: { type: Number, default: 0, min: 0 },
    mobileMoney: { type: Number, default: 0, min: 0 }, credit: { type: Number, default: 0, min: 0 },
  },
  actualCollected: { type: Number, default: 0 },
  cashVariance: { type: Number, default: 0 },
  varianceReason: String,
  status: { type: String, enum: ['open', 'submitted', 'approved', 'queried'], default: 'open', index: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  journal: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
  notes: String,
}, { timestamps: true });

fuelShiftSchema.index({ branch: 1, outlet: 1, openedAt: -1 });
export default mongoose.model('FuelShift', fuelShiftSchema);
