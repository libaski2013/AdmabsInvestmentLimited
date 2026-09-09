import Product from '../models/Product.js';
import StockMovement from '../models/StockMovement.js';
import Outlet from '../models/Outlet.js';
import PriceAdjustment from '../models/PriceAdjustment.js';

const SUPERMARKET_CATEGORIES = ['Grocery', 'Beverages', 'Snacks', 'Household', 'Bakery', 'Dairy'];
const TYRE_CATEGORIES = ['Tyre', 'Rim', 'Battery', 'Lubricant', 'Service'];
const PRICE_CATEGORIES = ['Tyre', 'Rim', 'Battery', 'Lubricant'];
const money = value => Math.round(Number(value || 0) * 100) / 100;
const adjustedPrice = (price, mode, value, rounding) => {
  const raw = mode === 'percentage' ? price * (1 + value / 100) : mode === 'fixed' ? price + value : value;
  const step = Number(rounding) || 0.01;
  return money(Math.round(raw / step) * step);
};
async function validateOutletCategory(body, reply) {
  if (!body.outlet) return reply.code(400).send({ error: 'Select the specific outlet that owns this stock' });
  const outlet = await Outlet.findById(body.outlet).lean();
  if (!outlet || String(outlet.branch) !== String(body.branch)) return reply.code(400).send({ error: 'Outlet does not belong to the selected branch' });
  if (outlet.division === 'supermarket' && !SUPERMARKET_CATEGORIES.includes(body.category)) return reply.code(400).send({ error: 'Tyres, rims and batteries cannot be stored in a supermarket outlet' });
  if (outlet.division === 'tyres' && !TYRE_CATEGORIES.includes(body.category)) return reply.code(400).send({ error: 'Supermarket products cannot be stored in a tyre, rim and battery outlet' });
  if (!['supermarket', 'tyres', 'warehouse'].includes(outlet.division)) return reply.code(400).send({ error: 'This outlet type does not hold retail product inventory' });
  return outlet;
}

export default async function inventoryRoutes(fastify) {
  fastify.get('/api/store/products', async (request) => {
    const { category, q } = request.query || {};
    const filter = { active: true, websiteVisible: { $ne: false }, category: { $in: ['Tyre', 'Rim', 'Battery'] } };
    if (category) filter.category = category;
    if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { code: new RegExp(q, 'i') }, { 'attributes.brand': new RegExp(q, 'i') }];
    return Product.find(filter).select('code name category price qty icon imageUrl description attributes branch outlet').populate('branch', 'name code').populate('outlet', 'name code').lean();
  });
  fastify.get('/api/products', { preHandler: [fastify.authenticate] }, async (request) => {
    const { category, low, q, branch, outlet, allOutlets } = request.query || {};
    const filter = { active: true };
    const maySearchAll = ['super_admin', 'ceo', 'gm'].includes(request.user.role) || request.user.permissions?.includes('inventory.search_all');
    Object.assign(filter, allOutlets === 'true' && maySearchAll ? {} : fastify.scopeFilter(request));
    if (category) filter.category = category;
    if (branch) filter.branch = branch;
    if (outlet) filter.outlet = outlet;
    if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { code: new RegExp(q, 'i') }, { barcode: new RegExp(q, 'i') }, { qrCode: new RegExp(q, 'i') }, { 'attributes.brand': new RegExp(q, 'i') }];
    let products = await Product.find(filter).populate('branch', 'name code').populate('outlet', 'name code division').sort({ name: 1 }).lean();
    if (low === 'true') products = products.filter((p) => p.qty <= p.reorderLevel);
    return products;
  });

  fastify.get('/api/products/scan/:code', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const code = decodeURIComponent(request.params.code).trim();
    const product = await Product.findOne({ active: true, ...fastify.scopeFilter(request), $or: [{ barcode: code }, { qrCode: code }, { code }] }).lean();
    if (!product) return reply.code(404).send({ error: 'No product matches this barcode or QR code in your assigned outlet' });
    return product;
  });

  fastify.get('/api/stock-movements', { preHandler: [fastify.authenticate] }, async request =>
    StockMovement.find(fastify.scopeFilter(request)).populate('product', 'code name barcode qrCode').populate('createdBy', 'name').sort({ createdAt: -1 }).limit(200));

  fastify.get('/api/price-adjustments', { preHandler: [fastify.authenticate, fastify.requirePermission('inventory.price.adjust', 'ceo', 'gm')] }, async request =>
    PriceAdjustment.find(fastify.scopeFilter(request)).populate('branch', 'name code').populate('outlet', 'name code').populate('createdBy', 'name').sort({ createdAt: -1 }).limit(100).lean());

  fastify.post('/api/products/price-adjust/preview', { preHandler: [fastify.authenticate, fastify.requirePermission('inventory.price.adjust', 'ceo', 'gm')] }, async (request, reply) => {
    const { categories = [], branch, outlet, mode, value, rounding = 0.01 } = request.body || {};
    const selected = categories.filter(x => PRICE_CATEGORIES.includes(x));
    if (!selected.length) return reply.code(400).send({ error: 'Select at least one automotive category' });
    if (!['percentage', 'fixed', 'set'].includes(mode)) return reply.code(400).send({ error: 'Select percentage, fixed amount or set price' });
    if (!Number.isFinite(Number(value)) || (mode === 'percentage' && Number(value) <= -100) || (mode === 'set' && Number(value) < 0)) return reply.code(400).send({ error: 'Enter a valid adjustment value' });
    const filter = { active: true, category: { $in: selected }, ...fastify.scopeFilter(request) };
    if (branch) filter.branch = branch; if (outlet) filter.outlet = outlet;
    const products = await Product.find(filter).populate('branch', 'name code').populate('outlet', 'name code').sort({ name: 1 }).lean();
    if (products.length > 2000) return reply.code(409).send({ error: 'Adjustment affects more than 2,000 products. Select a branch or outlet first.' });
    const changes = products.map(p => ({ product: p._id, code: p.code, name: p.name, category: p.category, branch: p.branch, outlet: p.outlet, oldPrice: money(p.price), newPrice: adjustedPrice(Number(p.price), mode, Number(value), Number(rounding)) })).filter(x => x.newPrice >= 0 && x.newPrice !== x.oldPrice);
    return { affectedCount: changes.length, oldValue: money(changes.reduce((s,x)=>s+x.oldPrice,0)), newValue: money(changes.reduce((s,x)=>s+x.newPrice,0)), sample: changes.slice(0,20) };
  });

  fastify.post('/api/products/price-adjust', { preHandler: [fastify.authenticate, fastify.requirePermission('inventory.price.adjust', 'ceo', 'gm')] }, async (request, reply) => {
    const { categories = [], branch, outlet, mode, value, rounding = 0.01, reason } = request.body || {};
    if (!String(reason || '').trim()) return reply.code(400).send({ error: 'A reason is required for the price audit trail' });
    const selected = categories.filter(x => PRICE_CATEGORIES.includes(x));
    if (!selected.length || !['percentage', 'fixed', 'set'].includes(mode) || !Number.isFinite(Number(value))) return reply.code(400).send({ error: 'Complete the category and adjustment fields' });
    if ((mode === 'percentage' && Number(value) <= -100) || (mode === 'set' && Number(value) < 0)) return reply.code(400).send({ error: 'Adjustment would create an invalid price' });
    const filter = { active: true, category: { $in: selected }, ...fastify.scopeFilter(request) };
    if (branch) filter.branch = branch; if (outlet) filter.outlet = outlet;
    const products = await Product.find(filter).lean();
    if (!products.length) return reply.code(404).send({ error: 'No matching automotive products found' });
    if (products.length > 2000) return reply.code(409).send({ error: 'Adjustment affects more than 2,000 products. Select a branch or outlet first.' });
    const changes = products.map(p => ({ product: p._id, code: p.code, name: p.name, category: p.category, oldPrice: money(p.price), newPrice: adjustedPrice(Number(p.price), mode, Number(value), Number(rounding)) })).filter(x => x.newPrice >= 0 && x.newPrice !== x.oldPrice);
    if (!changes.length) return reply.code(409).send({ error: 'The selected adjustment does not change any prices' });
    await Product.bulkWrite(changes.map(x => ({ updateOne: { filter: { _id: x.product, price: x.oldPrice }, update: { $set: { price: x.newPrice } } } })));
    const adjustment = await PriceAdjustment.create({ number: `PA-${Date.now()}-${Math.floor(Math.random()*1000)}`, categories: selected, branch: branch || undefined, outlet: outlet || undefined, mode, value: Number(value), rounding: Number(rounding), reason: String(reason).trim(), affectedCount: changes.length, changes, createdBy: request.user.id });
    return reply.code(201).send(adjustment);
  });

  fastify.post('/api/products/:id/stock', {
    preHandler: [fastify.authenticate, fastify.requirePermission('inventory.update', 'ceo', 'gm', 'branch', 'sub_manager', 'storekeeper')],
  }, async (request, reply) => {
    const quantity = Number(request.body?.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return reply.code(400).send({ error: 'Received quantity must be greater than zero' });
    const product = await Product.findOne({ _id: request.params.id, active: true, ...fastify.scopeFilter(request) });
    if (!product) return reply.code(404).send({ error: 'Product not found in your assigned outlet' });
    const quantityBefore = product.qty;
    product.qty += quantity;
    await product.save();
    const movement = await StockMovement.create({
      number: `GRN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      product: product._id, branch: product.branch, outlet: product.outlet, type: 'receipt', quantity,
      quantityBefore, quantityAfter: product.qty, reference: request.body?.reference, notes: request.body?.notes,
      createdBy: request.user.id,
    });
    return reply.code(201).send({ product, movement });
  });

  fastify.post(
    '/api/products',
    { preHandler: [fastify.authenticate, fastify.requirePermission('inventory.create', 'ceo', 'gm', 'branch', 'sub_manager', 'storekeeper')] },
    async (request, reply) => {
      const body = { ...request.body };
      if (!['ceo', 'gm'].includes(request.user.role)) {
        if (request.user.outletIds?.length && !request.user.outletIds.includes(String(body.outlet))) return reply.code(403).send({ error: 'Product must belong to an assigned outlet' });
        if (request.user.branchIds?.length && !request.user.branchIds.includes(String(body.branch))) return reply.code(403).send({ error: 'Product must belong to an assigned branch' });
      }
      const validOutlet = await validateOutletCategory(body, reply); if (!validOutlet || reply.sent) return;
      const product = await Product.create(body);
      return reply.code(201).send(product);
    }
  );

  fastify.patch(
    '/api/products/:id',
    { preHandler: [fastify.authenticate, fastify.requirePermission('inventory.update', 'ceo', 'gm', 'branch', 'sub_manager', 'storekeeper')] },
    async (request, reply) => {
      if (!['super_admin', 'ceo', 'gm'].includes(request.user.role)) {
        if (request.body?.outlet && !request.user.outletIds?.includes(String(request.body.outlet))) return reply.code(403).send({ error: 'Product must remain within an assigned outlet' });
        if (request.body?.branch && !request.user.branchIds?.includes(String(request.body.branch))) return reply.code(403).send({ error: 'Product must remain within an assigned branch' });
      }
      const current = await Product.findOne({ _id: request.params.id, ...fastify.scopeFilter(request) }).lean();
      if (!current) return reply.code(404).send({ error: 'Product not found' });
      const candidate = { ...current, ...request.body };
      const validOutlet = await validateOutletCategory(candidate, reply); if (!validOutlet || reply.sent) return;
      const product = await Product.findByIdAndUpdate(request.params.id, request.body, { new: true, runValidators: true });
      if (!product) return reply.code(404).send({ error: 'Product not found' });
      return product;
    }
  );

  fastify.post('/api/products/bulk-archive', { preHandler: [fastify.authenticate, fastify.requireRole('ceo', 'gm')] }, async (request, reply) => {
    const ids = [...new Set((request.body?.ids || []).map(String).filter(Boolean))];
    if (!ids.length) return reply.code(400).send({ error: 'Select at least one inventory item' });
    if (ids.length > 500) return reply.code(400).send({ error: 'A maximum of 500 inventory items can be deleted at once' });
    const result = await Product.updateMany(
      { _id: { $in: ids }, active: true, ...fastify.scopeFilter(request) },
      { $set: { active: false, websiteVisible: false } },
    );
    return { selected: ids.length, archived: result.modifiedCount };
  });

  fastify.delete('/api/products/:id', { preHandler: [fastify.authenticate, fastify.requireRole('ceo', 'gm')] }, async (request, reply) => {
    const product = await Product.findByIdAndUpdate(request.params.id, { active: false, websiteVisible: false }, { new: true });
    if (!product) return reply.code(404).send({ error: 'Product not found' });
    return reply.code(204).send();
  });
}
