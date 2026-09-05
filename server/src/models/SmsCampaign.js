import mongoose from 'mongoose';

const smsCampaignSchema = new mongoose.Schema({
  audience: { type: String, enum: ['employees', 'customers', 'both'], required: true },
  message: { type: String, required: true, maxlength: 480 },
  recipients: [{ name: String, phone: String, type: String }],
  recipientCount: { type: Number, default: 0 },
  status: { type: String, enum: ['queued', 'sent', 'failed'], default: 'queued' },
  providerReference: String, error: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, sentAt: Date,
}, { timestamps: true });

export default mongoose.model('SmsCampaign', smsCampaignSchema);
