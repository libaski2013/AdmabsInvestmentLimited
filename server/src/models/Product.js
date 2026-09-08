import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true },
    category: { type: String, required: true }, // Tyre | Rim | Battery | Lubricant | Grocery | Service
    qty: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 5 },
    price: { type: Number, required: true },
    cost: { type: Number, default: 0 },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', index: true },
    barcode: { type: String, trim: true },
    qrCode: { type: String, trim: true },
    unit: { type: String, default: 'each' },
    attributes: {
      brand: String, model: String, tyreSize: String, width: Number, profile: Number,
      rimSize: Number, loadIndex: String, speedRating: String, vehicleType: String,
      dotDate: String, voltage: Number, ampHours: Number, cca: Number,
      batteryType: String, warrantyMonths: Number, serialTracked: Boolean,
    },
    icon: { type: String, default: '📦' },
    imageUrl: String,
    websiteVisible: { type: Boolean, default: true },
    description: String,
    legacySource: {
      system: String,
      productId: String,
      warehouseId: String,
      warehouseName: String,
      importedAt: Date,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// The same SKU may be held independently by several outlets.
productSchema.index({ outlet: 1, code: 1 }, { unique: true });
productSchema.index({ 'legacySource.system': 1, 'legacySource.warehouseId': 1, 'legacySource.productId': 1 }, { sparse: true });

export default mongoose.model('Product', productSchema);
