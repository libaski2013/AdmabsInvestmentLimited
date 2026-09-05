import mongoose from 'mongoose';

const shiftScheduleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  division: { type: String, enum: ['fuel', 'supermarket'], required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', required: true, index: true },
  workShift: { type: String, enum: ['day', 'night'], required: true },
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  daysOfWeek: [{ type: Number, min: 0, max: 6 }],
  assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  earlyStartMinutes: { type: Number, default: 30, min: 0, max: 240 },
  lateStartMinutes: { type: Number, default: 120, min: 0, max: 720 },
  active: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

shiftScheduleSchema.index({ outlet: 1, division: 1, active: 1 });
export default mongoose.model('ShiftSchedule', shiftScheduleSchema);
