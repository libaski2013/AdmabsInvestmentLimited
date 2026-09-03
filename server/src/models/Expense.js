import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true }, // Vehicle | Admin | Entertainment | Utilities | Facilities
    branch: { type: String },
    submittedBy: { type: String },
    hasReceipt: { type: Boolean, default: false },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
);

export default mongoose.model('Expense', expenseSchema);
