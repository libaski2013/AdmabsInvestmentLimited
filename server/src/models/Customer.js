import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['Retail', 'Fleet', 'Corporate'], default: 'Retail' },
    phone: { type: String },
    balance: { type: Number, default: 0 },
    loyaltyPoints: { type: Number, default: 0 },
    visits: { type: Number, default: 0 },
    lastVisit: { type: Date },
    email: String,
    location: { type: String, trim: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', index: true },
    active: { type: Boolean, default: true },
    legacySource: { system: String, nameKey: { type: String, index: true }, importedAt: Date },
  },
  { timestamps: true }
);

export default mongoose.model('Customer', customerSchema);
