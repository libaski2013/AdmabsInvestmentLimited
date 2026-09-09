import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    qty: { type: Number, required: true },
    unitCost: { type: Number, required: true },
  },
  { _id: false }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, unique: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', index: true },
    items: [lineItemSchema],
    amount: { type: Number, required: true },
    paid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    payments: [{ method: String, amount: Number, reference: String, paidAt: Date }],
    status: { type: String, enum: ['pending', 'approved', 'delivered'], default: 'pending' },
    postedAt: Date,
    legacySource: { system: String, id: String, warehouse: String, importedAt: Date },
  },
  { timestamps: true }
);

export default mongoose.model('PurchaseOrder', purchaseOrderSchema);
