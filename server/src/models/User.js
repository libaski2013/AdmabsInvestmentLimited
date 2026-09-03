import mongoose from 'mongoose';

const ROLES = ['ceo', 'gm', 'branch', 'finance', 'staff', 'fuel'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const ROLE_LIST = ROLES;
export default mongoose.model('User', userSchema);
