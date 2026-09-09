import mongoose from 'mongoose';

const ROLES = ['super_admin', 'ceo', 'gm', 'finance', 'accountant', 'branch', 'sub_manager', 'staff', 'cashier', 'fuel', 'storekeeper', 'procurement', 'technician', 'driver', 'auditor'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    branches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
    outlets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Outlet' }],
    permissions: [{ type: String, trim: true }],
    employeeNumber: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    jobTitle: { type: String, trim: true },
    department: { type: String, trim: true },
    basicSalary: { type: Number, default: 0, min: 0 },
    lastLoginAt: { type: Date },
    active: { type: Boolean, default: true },
    requiresPasswordReset: { type: Boolean, default: false },
    legacySource: {
      system: String,
      id: String,
      importedAt: Date,
      group: String,
      biller: String,
      warehouse: String,
    },
  },
  { timestamps: true }
);

export const ROLE_LIST = ROLES;
export default mongoose.model('User', userSchema);
