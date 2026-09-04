import mongoose from 'mongoose';

const lineSchema = new mongoose.Schema({
  accountCode: { type: String, required: true },
  accountName: { type: String, required: true },
  debit: { type: Number, default: 0, min: 0 },
  credit: { type: Number, default: 0, min: 0 },
}, { _id: false });

const journalEntrySchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  date: { type: Date, required: true, default: Date.now, index: true },
  description: { type: String, required: true },
  source: { type: String, enum: ['sale', 'purchase', 'expense', 'payment', 'manual', 'reversal'], required: true },
  sourceId: mongoose.Schema.Types.ObjectId,
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
  outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', index: true },
  lines: { type: [lineSchema], validate: value => value.length >= 2 },
  status: { type: String, enum: ['draft', 'posted', 'reversed'], default: 'posted' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
}, { timestamps: true });

journalEntrySchema.pre('validate', function validateBalance(next) {
  const debit = this.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const credit = this.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  if (Math.abs(debit - credit) > 0.005 || debit <= 0) return next(new Error('Journal entry debits and credits must balance'));
  next();
});

export default mongoose.model('JournalEntry', journalEntrySchema);
