import mongoose from 'mongoose';

const appSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  branchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
  outletIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Outlet' }],
  loggedInAt: { type: Date, default: Date.now, required: true },
  lastSeenAt: { type: Date, default: Date.now, required: true, index: true },
  loggedOutAt: Date,
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  ipAddress: String,
  userAgent: String,
}, { timestamps: true });

appSessionSchema.index({ user: 1, loggedOutAt: 1, lastSeenAt: -1 });
export default mongoose.model('AppSession', appSessionSchema);
