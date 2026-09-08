import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, required: true }, // Tyres & Batteries | Filling Station | Supermarket | Administration
    manager: { type: String },
    staffCount: { type: Number, default: 0 },
    code: { type: String, uppercase: true, trim: true },
    address: { type: String },
    city: { type: String },
    region: { type: String },
    phone: { type: String },
    divisions: [{ type: String, enum: ['tyres', 'fuel', 'supermarket', 'warehouse', 'head_office'] }],
    legacySource: { system: String, id: String, importedAt: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Branch', branchSchema);
