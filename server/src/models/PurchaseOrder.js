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
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', required: true, index: true },
    items: [lineItemSchema],
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'approved', 'delivered'], default: 'pending' },
  },
  { timestamps: true }
);

export default mongoose.model('PurchaseOrder', purchaseOrderSchema);
