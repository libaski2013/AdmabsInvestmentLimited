import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    category: { type: String },
    price: { type: Number, required: true },
    cost: { type: Number, default: 0 },
    qty: { type: Number, required: true },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', index: true },
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    items: [saleItemSchema],
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
    paymentMethod: { type: String, default: 'Cash' },
    payments: [{ method: { type: String, required: true }, amount: { type: Number, required: true }, reference: String }],
    discount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0.15 },
    channel: { type: String, enum: ['pos', 'online', 'quotation'], default: 'pos' },
    status: { type: String, enum: ['draft', 'suspended', 'posted', 'returned', 'voided'], default: 'posted' },
    dailyApprovalStatus: { type: String, enum: ['pending', 'approved', 'queried'], default: 'pending', index: true },
    dailyApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dailyApprovedAt: Date,
    postedAt: { type: Date, default: Date.now },
    reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    notes: String,
  },
  { timestamps: true }
);

export default mongoose.model('Sale', saleSchema);
