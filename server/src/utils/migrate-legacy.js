import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import DemoBatch from '../models/DemoBatch.js';
import Branch from '../models/Branch.js';
import Outlet from '../models/Outlet.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Sale from '../models/Sale.js';
import Expense from '../models/Expense.js';
import Approval from '../models/Approval.js';
import JournalEntry from '../models/JournalEntry.js';
import CashReconciliation from '../models/CashReconciliation.js';
import FuelTank from '../models/FuelTank.js';
import FuelPump from '../models/FuelPump.js';
import FuelShift from '../models/FuelShift.js';
import FuelDip from '../models/FuelDip.js';
import FuelDelivery from '../models/FuelDelivery.js';
import MigrationRun from '../models/MigrationRun.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(currentDir, '../../data/admabs-legacy-inventory-by-warehouse.json');
const apply = process.argv.includes('--apply');
const models = { JournalEntry, FuelDip, FuelShift, FuelDelivery, FuelPump, FuelTank, CashReconciliation, Sale, PurchaseOrder, Expense, Approval, Product, Customer, Supplier, User, Outlet, Branch };
const legacySystem = 'shop.admabsgh.com';
const migrationKey = 'legacy-inventory-2026-09-08';

const number = value => Number(String(value || '').replace(/[^0-9.-]/g, '')) || 0;
const codeFor = (name, id) => `${name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 18)}-${id}`.toUpperCase();
const categoryFor = product => {
  const source = String(product.category || '').toLowerCase();
  if (source.includes('batter')) return 'Battery';
  if (source.includes('rim')) return 'Rim';
  if (source.includes('lubric')) return 'Lubricant';
  if (source.includes('service')) return 'Service';
  if (source.includes('tyre') || source.includes('tire') || /\d{3}[-/]\d{2}[-r/]?\d{2}/i.test(product.name || '')) return 'Tyre';
  return 'Service';
};
const divisionFor = name => /warehouse|container/i.test(name) ? 'warehouse' : 'tyres';

async function backupCollections() {
  const backup = { createdAt: new Date().toISOString(), reason: 'Before legacy ADMABS inventory migration', collections: {} };
  for (const [name, Model] of Object.entries({ DemoBatch, ...models })) backup.collections[name] = await Model.find().lean();
  const backupDir = path.resolve(currentDir, '../../backups');
  await fs.mkdir(backupDir, { recursive: true });
  const output = path.join(backupDir, `pre-legacy-migration-${Date.now()}.json`);
  await fs.writeFile(output, JSON.stringify(backup));
  return output;
}

async function deleteTrackedDemoBatches() {
  const batches = await DemoBatch.find({ status: { $ne: 'deleted' } });
  const deleted = {};
  for (const batch of batches) {
    for (const [name, Model] of Object.entries(models)) {
      const ids = batch.recordIds?.[name] || [];
      if (!ids.length) continue;
      const result = await Model.deleteMany({ _id: { $in: ids } });
      deleted[name] = (deleted[name] || 0) + result.deletedCount;
    }
    batch.status = 'deleted';
    batch.deletedAt = new Date();
    await batch.save();
  }
  return { batches: batches.length, records: deleted };
}

async function deleteOriginalSeedData() {
  const demoBranches = await Branch.find({ name: { $in: ['Harare Main', 'Bulawayo Branch', 'Fuel Station Harare', 'Harare Supermarket', 'Head Office'] }, 'legacySource.system': { $ne: legacySystem } }).select('_id').lean();
  const branchIds = demoBranches.map(branch => branch._id);
  const filters = {
    Branch: { _id: { $in: branchIds } },
    Outlet: { branch: { $in: branchIds } },
    Product: { $or: [{ branch: { $in: branchIds } }, { code: { $in: ['TY-001','TY-002','TY-003','TY-004','BA-001','BA-002','SV-001','SV-002','SV-003','SV-004','LU-001','FU-001','FU-002','SM-001','SM-002','SM-003','SM-004','SM-005'] } }] },
    User: { $or: [{ branch: { $in: branchIds } }, { name: { $in: ['Chido Admabs','Farai Manager','Tendai Moyo','Blessing Chirwa','Rudo Chikwanda','Simba Ncube'] }, role: { $ne: 'super_admin' } }] },
    Customer: { name: { $in: ['John Mutasa','Zimra Fleet Account','Econet Wireless Ltd','Tendai Chikumba'] } },
    Supplier: { name: { $in: ['Bridgestone Zimbabwe','TotalEnergies','Banner Batteries','OK Distributors'] } },
    PurchaseOrder: { poNumber: 'PO-0439' },
    Sale: { invoiceNumber: { $regex: /^INV-20(4[1-9]|[5-7][0-9])$/ } },
    Expense: { $or: [{ branch: { $in: ['Gweru','Head Office','Harare Main','Bulawayo'] } }, { submittedBy: { $in: ['Tendai Moyo','Blessing Chirwa','CEO','Simba Ncube'] } }] },
    Approval: { $or: [{ description: { $regex: /Econet Wireless|PO-0439|Dairiboard Zimbabwe|Tafara N\.|Vehicle service — delivery van/ } }, { requestedBy: { $in: ['Tendai Moyo','Nyasha Sithole','Rudo Chikwanda','Simba Ncube'] } }] },
  };
  const deleted = {};
  for (const [name, filter] of Object.entries(filters)) {
    const result = await models[name].deleteMany(filter);
    if (result.deletedCount) deleted[name] = result.deletedCount;
  }
  return deleted;
}

async function migrate() {
  const source = JSON.parse(await fs.readFile(dataPath, 'utf8'));
  const rows = source.inventories.flatMap(group => group.products).filter(product => product.code && product.name);
  const summary = {
    mode: apply ? 'apply' : 'validation-only',
    sourceExportedAt: source.exportedAt,
    warehouses: source.warehouses.length,
    productRows: rows.length,
    quantityOnHand: rows.reduce((sum, product) => sum + number(product.quantity), 0),
    categories: rows.reduce((result, product) => ({ ...result, [categoryFor(product)]: (result[categoryFor(product)] || 0) + 1 }), {}),
  };
  if (!apply) return summary;

  const log = { info: message => console.log(message) };
  await connectDB(log);
  try {
    const previous = await MigrationRun.findOne({ key: migrationKey, status: 'completed' }).lean();
    if (previous && !process.argv.includes('--force')) return { ...summary, skipped: true, previous: previous.summary };
    await MigrationRun.findOneAndUpdate({ key: migrationKey }, { $set: { source: legacySystem, sourceExportedAt: source.exportedAt, status: 'running', error: null } }, { upsert: true });
    summary.backup = await backupCollections();
    summary.demoDeletion = await deleteTrackedDemoBatches();
    summary.originalSeedDeletion = await deleteOriginalSeedData();

    // Remove the superseded global code-only unique index, if an older deployment created it.
    const indexes = await Product.collection.indexes();
    if (indexes.some(index => index.name === 'code_1' && index.unique)) await Product.collection.dropIndex('code_1');
    await Product.syncIndexes();

    const importedAt = new Date();
    const locationMap = new Map();
    for (const warehouse of source.warehouses) {
      const division = divisionFor(warehouse.name);
      const branchCode = codeFor(warehouse.name, warehouse.id);
      const branch = await Branch.findOneAndUpdate(
        { 'legacySource.system': legacySystem, 'legacySource.id': warehouse.id },
        { $set: { name: warehouse.name, code: branchCode, type: division === 'warehouse' ? 'Warehouse' : 'Tyres & Batteries', divisions: [division], active: true, legacySource: { system: legacySystem, id: warehouse.id, importedAt } } },
        { upsert: true, new: true, runValidators: true }
      );
      const outlet = await Outlet.findOneAndUpdate(
        { 'legacySource.system': legacySystem, 'legacySource.id': warehouse.id },
        { $set: { code: `${branchCode}-${division === 'warehouse' ? 'WH' : 'AUTO'}`, name: warehouse.name, branch: branch._id, division, active: true, allowCreditSales: division === 'tyres', legacySource: { system: legacySystem, id: warehouse.id, importedAt } } },
        { upsert: true, new: true, runValidators: true }
      );
      locationMap.set(warehouse.id, { branch, outlet });
    }

    const existingImports = await Product.find({ 'legacySource.system': legacySystem }).select('legacySource').lean();
    const existingKeys = new Set(existingImports.map(product => `${product.legacySource?.warehouseId}|${product.legacySource?.productId}`));
    const operations = rows.map(product => {
      const location = locationMap.get(product.warehouseId);
      if (!location) throw new Error(`No mapped location for legacy warehouse ${product.warehouseId}`);
      const category = categoryFor(product);
      const filter = { 'legacySource.system': legacySystem, 'legacySource.warehouseId': product.warehouseId, 'legacySource.productId': product.legacyId };
      return { updateOne: { filter, update: { $set: {
        code: product.code.trim(), name: product.name.trim(), category,
        qty: number(product.quantity), reorderLevel: number(product.alertQuantity),
        price: number(product.price), cost: number(product.cost),
        branch: location.branch._id, outlet: location.outlet._id,
        barcode: product.code.trim(), unit: product.unit || 'each',
        attributes: { brand: product.brand || undefined },
        imageUrl: /no_image\.png$/i.test(product.image) ? undefined : product.image,
        websiteVisible: ['Tyre', 'Rim', 'Battery'].includes(category),
        description: `Imported from ${product.warehouseName}; legacy product ${product.legacyId}`,
        legacySource: { system: legacySystem, productId: product.legacyId, warehouseId: product.warehouseId, warehouseName: product.warehouseName, importedAt },
        active: true,
      } }, upsert: true } };
    });
    await Product.bulkWrite(operations, { ordered: false });
    const updated = rows.filter(product => existingKeys.has(`${product.warehouseId}|${product.legacyId}`)).length;
    const created = rows.length - updated;
    summary.imported = { branches: locationMap.size, outlets: locationMap.size, productsCreated: created, productsUpdated: updated };
    await MigrationRun.findOneAndUpdate({ key: migrationKey }, { $set: { status: 'completed', summary } });
    return summary;
  } catch (error) {
    await MigrationRun.findOneAndUpdate({ key: migrationKey }, { $set: { status: 'failed', error: error.message } }, { upsert: true });
    throw error;
  } finally {
    await disconnectDB();
  }
}

migrate().then(result => {
  console.log(JSON.stringify(result, null, 2));
  if (!apply) console.log('Validation passed. Run npm run migrate:legacy:apply to back up, delete tracked demo batches and import.');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
