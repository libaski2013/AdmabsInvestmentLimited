import mongoose from 'mongoose';

const payrollLineSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  employeeNumber: String, name: String, jobTitle: String,
  basicSalary: { type: Number, default: 0 }, allowances: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 }, netPay: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' }, paidAt: Date,
}, { _id: true });

const payrollRunSchema = new mongoose.Schema({
  period: { type: String, required: true, unique: true },
  lines: [payrollLineSchema],
  grossTotal: { type: Number, default: 0 }, deductionsTotal: { type: Number, default: 0 }, netTotal: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'approved', 'paid'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, approvedAt: Date,
}, { timestamps: true });

export default mongoose.model('PayrollRun', payrollRunSchema);
