import mongoose from 'mongoose';

const outletSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  division: { type: String, enum: ['tyres', 'fuel', 'supermarket', 'warehouse', 'head_office'], required: true },
  active: { type: Boolean, default: true },
  allowCreditSales: { type: Boolean, default: false },
  taxRate: { type: Number, default: 0.15, min: 0, max: 1 },
  runs24Hours: { type: Boolean, default: false },
}, { timestamps: true });

outletSchema.index({ branch: 1, division: 1 });
export default mongoose.model('Outlet', outletSchema);
