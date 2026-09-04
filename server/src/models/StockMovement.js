import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
  outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', index: true },
  type: { type: String, enum: ['receipt', 'adjustment', 'transfer_in', 'transfer_out'], default: 'receipt' },
  quantity: { type: Number, required: true },
  quantityBefore: { type: Number, required: true },
  quantityAfter: { type: Number, required: true },
  reference: String,
  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default mongoose.model('StockMovement', stockMovementSchema);
