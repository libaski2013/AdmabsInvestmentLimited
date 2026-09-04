import mongoose from 'mongoose';

const fuelDeliverySchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  deliveryNote: { type: String, required: true, trim: true },
  supplier: { type: String, required: true },
  tankerRegistration: String,
  driver: String,
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', index: true },
  tank: { type: mongoose.Schema.Types.ObjectId, ref: 'FuelTank', required: true },
  product: { type: String, required: true },
  orderedLitres: { type: Number, required: true, min: 0 },
  dispatchedLitres: { type: Number, required: true, min: 0 },
  receivedLitres: { type: Number, required: true, min: 0 },
  varianceLitres: Number,
  sealNumbers: [String],
  sealsIntact: { type: Boolean, default: true },
  receivedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['received', 'approved', 'rejected'], default: 'received' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: String,
}, { timestamps: true });

export default mongoose.model('FuelDelivery', fuelDeliverySchema);
