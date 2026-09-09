import mongoose from 'mongoose';

const taxFilingSchema = new mongoose.Schema({
  year: { type: Number, required: true, unique: true, index: true },
  periodStart: Date,
  periodEnd: Date,
  filingDueDate: Date,
  taxableIncome: { type: Number, default: 0, min: 0 },
  taxRate: { type: Number, default: 0.25, min: 0, max: 1 },
  taxDue: { type: Number, default: 0, min: 0 },
  amountPaid: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['draft', 'prepared', 'filed', 'paid', 'overdue'], default: 'draft' },
  tin: String,
  filingReference: String,
  notes: String,
  filedAt: Date,
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('TaxFiling', taxFilingSchema);
