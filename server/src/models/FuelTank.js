import mongoose from 'mongoose';

const fuelTankSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', index: true },
  product: { type: String, enum: ['petrol', 'diesel', 'premium', 'lpg'], required: true },
  capacityLitres: { type: Number, required: true, min: 1 },
  currentLitres: { type: Number, default: 0, min: 0 },
  reorderLevelLitres: { type: Number, default: 0, min: 0 },
  active: { type: Boolean, default: true },
  lastDipAt: Date,
}, { timestamps: true });

fuelTankSchema.index({ branch: 1, outlet: 1, code: 1 }, { unique: true });
export default mongoose.model('FuelTank', fuelTankSchema);
