import mongoose from 'mongoose';

const allocationSchema = new mongoose.Schema({
  sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
  amount: { type: Number, required: true, min: 0.01 },
}, { _id: false });

const customerPaymentSchema = new mongoose.Schema({
  receiptNumber: { type: String, required: true, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
  outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', index: true },
  amount: { type: Number, required: true, min: 0.01 },
  method: { type: String, enum: ['Cash', 'Card', 'Mobile Money', 'Bank Transfer', 'Cheque'], required: true },
  reference: String,
  notes: String,
  allocations: [allocationSchema],
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receivedAt: { type: Date, default: Date.now, index: true },
  status: { type: String, enum: ['posted', 'voided'], default: 'posted' },
}, { timestamps: true });

export default mongoose.model('CustomerPayment', customerPaymentSchema);
