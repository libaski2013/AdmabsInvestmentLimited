import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String }, // Tyre | Fuel | Battery | Grocery
    balance: { type: Number, default: 0 },
    ordersCount: { type: Number, default: 0 },
    legacySource: { system: String, nameKey: { type: String, index: true }, importedAt: Date },
  },
  { timestamps: true }
);

export default mongoose.model('Supplier', supplierSchema);
