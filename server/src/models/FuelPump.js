import mongoose from 'mongoose';

const nozzleSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, trim: true },
  label: { type: String, required: true },
  meterReading: { type: Number, default: 0, min: 0 },
  active: { type: Boolean, default: true },
}, { _id: false });

const fuelPumpSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, trim: true },
  name: { type: String, required: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', index: true },
  tank: { type: mongoose.Schema.Types.ObjectId, ref: 'FuelTank', required: true },
  product: { type: String, enum: ['petrol', 'diesel', 'premium', 'lpg'], required: true },
  pricePerLitre: { type: Number, required: true, min: 0 },
  nozzles: { type: [nozzleSchema], validate: value => value.length > 0 },
  status: { type: String, enum: ['active', 'maintenance', 'offline'], default: 'active' },
}, { timestamps: true });

fuelPumpSchema.index({ branch: 1, outlet: 1, code: 1 }, { unique: true });
export default mongoose.model('FuelPump', fuelPumpSchema);
