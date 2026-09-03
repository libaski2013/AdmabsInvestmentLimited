import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, required: true }, // Tyre | Battery | Lubricant | Grocery | Service
    qty: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 5 },
    price: { type: Number, required: true },
    cost: { type: Number, default: 0 },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    icon: { type: String, default: '📦' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Product', productSchema);
