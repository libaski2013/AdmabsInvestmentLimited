import mongoose from 'mongoose';

const approvalSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // Discount | Purchase Order | Credit Sale | Fuel Shortage | Expense
    description: { type: String, required: true },
    requestedBy: { type: String, required: true },
    amount: { type: Number, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
);

export default mongoose.model('Approval', approvalSchema);
