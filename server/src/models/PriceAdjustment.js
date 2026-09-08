import mongoose from 'mongoose';

const changeSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  code: String,
  name: String,
  category: String,
  oldPrice: Number,
  newPrice: Number,
}, { _id: false });

const priceAdjustmentSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  categories: [{ type: String, enum: ['Tyre', 'Rim', 'Battery', 'Lubricant'] }],
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
  outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', index: true },
  mode: { type: String, enum: ['percentage', 'fixed', 'set'], required: true },
  value: { type: Number, required: true },
  rounding: { type: Number, default: 0.01 },
  reason: { type: String, required: true },
  affectedCount: { type: Number, required: true },
  changes: [changeSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default mongoose.model('PriceAdjustment', priceAdjustmentSchema);
