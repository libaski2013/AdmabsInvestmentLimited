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
  },
  { timestamps: true }
);

export default mongoose.model('Customer', customerSchema);
