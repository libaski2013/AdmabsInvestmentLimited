import mongoose from 'mongoose';

const fuelDipSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', index: true },
  tank: { type: mongoose.Schema.Types.ObjectId, ref: 'FuelTank', required: true },
  measuredAt: { type: Date, default: Date.now },
  openingLitres: Number,
  deliveriesLitres: Number,
  pumpSalesLitres: Number,
  theoreticalClosingLitres: Number,
  closingDipLitres: { type: Number, required: true, min: 0 },
  varianceLitres: Number,
  variancePercent: Number,
  waterLevelMm: { type: Number, default: 0, min: 0 },
  temperatureC: Number,
  status: { type: String, enum: ['pending', 'approved', 'queried'], default: 'pending' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  notes: String,
}, { timestamps: true });

export default mongoose.model('FuelDip', fuelDipSchema);
