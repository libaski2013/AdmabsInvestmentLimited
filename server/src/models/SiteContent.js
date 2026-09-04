import mongoose from 'mongoose';

const siteContentSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  logoUrl: String,
  heroImageUrl: String,
  companyName: { type: String, default: 'ADMABS Investment Company Limited' },
  announcement: { type: String, default: 'Serving drivers and businesses across Ghana' },
  heroEyebrow: { type: String, default: 'Road-ready. Business-ready.' },
  heroTitle: { type: String, default: 'Confidence for every kilometre.' },
  heroText: { type: String, default: 'Quality tyres, dependable batteries and precision fitting—available through Admabs branches and delivered to customers across Ghana.' },
  aboutTitle: { type: String, default: 'A growing network of connected branches' },
  aboutText: { type: String, default: 'Admabs operates tyre, rim and battery outlets alongside selected filling-station and supermarket locations.' },
  phone: String,
  email: String,
  address: String,
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('SiteContent', siteContentSchema);
