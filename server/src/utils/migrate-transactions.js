import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { connectDB, disconnectDB } from '../config/db.js';
import Branch from '../models/Branch.js';
import Outlet from '../models/Outlet.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Sale from '../models/Sale.js';
import MigrationRun from '../models/MigrationRun.js';

const gunzip = promisify(zlib.gunzip);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, '../../data/legacy-transactions');
const legacySystem = 'shop.admabsgh.com';
const migrationKey = 'legacy-transactions-2026-09-09-v1';
const apply = process.argv.includes('--apply');
const round = value => Math.round(Number(value || 0) * 100) / 100;
const amount = value => round(Number(String(value || '').replace(/,/g, '')) || 0);
const normalize = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const headers = rows.shift()?.map(value => value.trim()) || [];
  return rows.filter(values => values.some(value => value.trim())).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

async function readReport(name) {
  const buffer = await gunzip(await fs.readFile(path.join(dataDir, `${name}.csv.gz`)));
  return parseCsv(buffer.toString('latin1'));
}

function parseDate(value) {
  const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match || Number(match[3]) < 2000) return null;
  return new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4]), Number(match[5])));
}

function parseItems(value) {
  return String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const match = line.match(/\s*\((-?\d+(?:\.\d+)?)\)\s*$/);
    return { name: match ? line.slice(0, match.index).trim() : line, qty: match ? Number(match[1]) : 1 };
  });
}

function findLocation(label, locations, fallback) {
  const key = normalize(label);
  const aliases = [
    ['abosey', 'abosey okai'], ['makro', 'makro'], ['krapa', 'krapa'], ['buoho', 'buoho'],
    ['tamale', 'tamale'], ['newtown', 'newtown'], ['amarmoley', 'amarmoley'], ['container', 'container'],
    ['kasoa', 'kasoa'], ['head office', 'head office'], ['admabs', 'head office'], ['online', 'head office'],
  ];
  const alias = aliases.find(([needle]) => key.includes(needle));
  if (alias) return locations.find(location => normalize(location.branch.name).includes(alias[1])) || fallback;
  return locations.find(location => key.includes(normalize(location.branch.name).replace('sales point', '').trim())) || fallback;
}

function paymentMethod(value) {
  return ({ cash: 'Cash', cheque: 'Cheque', other: 'Other', 'gift card': 'Gift Card', deposit: 'Deposit' }[normalize(value)] || String(value || 'Other'));
}

function allocateItems(rawItems, total, location, productIndexes) {
  const items = rawItems.length ? rawItems : [{ name: 'Legacy transaction', qty: total < 0 ? -1 : 1 }];
  const resolved = items.map(item => {
    const key = normalize(item.name);
    const product = productIndexes.byLocation.get(`${location?.outlet?._id || ''}|${key}`) || productIndexes.byName.get(key);
    return { ...item, product, weight: Math.max(0.01, Math.abs(item.qty) * Math.max(0.01, Number(product?.price || 1))) };
  });
  const totalWeight = resolved.reduce((sum, item) => sum + item.weight, 0);
  return resolved.map(item => ({
    product: item.product?._id,
    name: item.name,
    category: item.product?.category || 'Tyre',
    price: round(Math.abs(total) * (item.weight / totalWeight) / Math.max(0.01, Math.abs(item.qty))),
    cost: round(Number(item.product?.cost || 0)),
    qty: item.qty,
  }));
}

function uniqueRows(rows, refField, prefix) {
  const counts = new Map();
  return rows.map((row, index) => {
    const reference = String(row[refField] || `${prefix}-${index + 1}`).trim();
    const occurrence = (counts.get(reference) || 0) + 1;
    counts.set(reference, occurrence);
    return { ...row, _index: index, _reference: reference, _occurrence: occurrence };
  });
}

async function migrate() {
  const [rawSales, rawPayments, rawPurchases, rawReturns, rawProducts] = await Promise.all([
    readReport('sales_report'), readReport('payments_report'), readReport('purchase_report'), readReport('returns_report'), readReport('products_report'),
  ]);
  const salesRows = rawSales.filter(row => row.Date && row['Reference No']);
  const paymentRows = rawPayments.filter(row => row['payment reference']);
  const purchaseRows = rawPurchases.filter(row => row.Date && row['Reference No']);
  const returnRows = rawReturns.filter(row => row.Date && row['Reference No']);
  const productSummaryRows = rawProducts.filter(row => row['Product Code'] && row['Product Name']);
  const sales = uniqueRows(salesRows, 'Reference No', 'SALE');
  const purchases = uniqueRows(purchaseRows, 'Reference No', 'PO');
  const returns = uniqueRows(returnRows, 'Reference No', 'RETURN');
  const summary = {
    mode: apply ? 'apply' : 'validation-only',
    sourceRows: { sales: sales.length, payments: paymentRows.length, purchases: purchases.length, returns: returns.length, products: productSummaryRows.length },
    controls: {
      salesTotal: round(sales.reduce((sum, row) => sum + amount(row['Grand Total']), 0)),
      salesPaid: round(sales.reduce((sum, row) => sum + amount(row.Paid), 0)),
      salesBalance: round(sales.reduce((sum, row) => sum + amount(row.Balance), 0)),
      purchaseTotal: round(purchases.reduce((sum, row) => sum + amount(row['Grand Total']), 0)),
      paymentTotal: round(paymentRows.reduce((sum, row) => sum + amount(row.Amount), 0)),
      returnTotal: round(returns.reduce((sum, row) => sum + amount(row['Grand Total']), 0)),
      invalidDates: [...sales, ...purchases, ...returns, ...paymentRows].filter(row => !parseDate(row.Date)).length,
    },
  };
  const saleRefs = new Set(sales.map(row => row._reference));
  const purchaseRefs = new Set(purchases.map(row => row._reference));
  summary.controls.unmatchedSalePayments = paymentRows.filter(row => row['Sale Reference'] && !saleRefs.has(row['Sale Reference'].trim())).length;
  summary.controls.unmatchedPurchasePayments = paymentRows.filter(row => row['purchase reference'] && !purchaseRefs.has(row['purchase reference'].trim())).length;
  if (!apply) return summary;

  await connectDB({ info: message => console.log(message) });
  try {
    const previous = await MigrationRun.findOne({ key: migrationKey, status: 'completed' }).lean();
    if (previous && !process.argv.includes('--force')) return { ...summary, skipped: true, previous: previous.summary };
    await MigrationRun.findOneAndUpdate({ key: migrationKey }, { $set: { source: legacySystem, status: 'running', error: null } }, { upsert: true });
    if (summary.controls.unmatchedSalePayments || summary.controls.unmatchedPurchasePayments) throw new Error('Payment references do not reconcile to the supplied transaction exports');

    const [branches, outlets, users, products] = await Promise.all([
      Branch.find({ 'legacySource.system': legacySystem }).lean(), Outlet.find({ 'legacySource.system': legacySystem }).lean(),
      User.find({ 'legacySource.system': legacySystem }).lean(), Product.find({ 'legacySource.system': legacySystem }).lean(),
    ]);
    const locations = branches.map(branch => ({ branch, outlet: outlets.find(outlet => String(outlet.branch) === String(branch._id)) })).filter(item => item.outlet);
    const fallback = locations.find(item => /head office/i.test(item.branch.name)) || locations[0];
    const staffByBiller = new Map();
    for (const user of users) if (user.legacySource?.biller) staffByBiller.set(normalize(user.legacySource.biller), user);
    const productIndexes = { byName: new Map(), byLocation: new Map() };
    for (const product of products) { const key = normalize(product.name); productIndexes.byName.set(key, product); productIndexes.byLocation.set(`${product.outlet}|${key}`, product); }
    const importedAt = new Date();

    const customerStats = new Map();
    for (const row of [...sales, ...returns]) {
      const name = String(row.Customer || 'Walk-in Customer').trim() || 'Walk-in Customer'; const key = normalize(name);
      const date = parseDate(row.Date); const location = findLocation(row.Biller, locations, fallback);
      const stat = customerStats.get(key) || { name, balance: 0, visits: 0, lastVisit: null, location };
      stat.balance = round(stat.balance + (row.Balance !== undefined ? amount(row.Balance) : 0));
      if (row.Paid !== undefined && amount(row['Grand Total']) > 0) stat.visits++;
      if (date && (!stat.lastVisit || date > stat.lastVisit)) { stat.lastVisit = date; stat.location = location; }
      customerStats.set(key, stat);
    }
    await Customer.bulkWrite([...customerStats].map(([key, stat]) => ({ updateOne: {
      filter: { 'legacySource.system': legacySystem, 'legacySource.nameKey': key },
      update: { $set: { name: stat.name, balance: stat.balance, visits: stat.visits, lastVisit: stat.lastVisit, branch: stat.location?.branch?._id, outlet: stat.location?.outlet?._id, active: true, legacySource: { system: legacySystem, nameKey: key, importedAt } } }, upsert: true,
    } })), { ordered: false });
    const customers = new Map((await Customer.find({ 'legacySource.system': legacySystem }).lean()).map(customer => [customer.legacySource.nameKey, customer]));

    const supplierStats = new Map();
    for (const row of purchases) { const name = String(row.Supplier || 'Legacy Supplier').trim() || 'Legacy Supplier'; const key = normalize(name); const stat = supplierStats.get(key) || { name, balance: 0, orders: 0 }; stat.balance = round(stat.balance + amount(row.Balance)); stat.orders++; supplierStats.set(key, stat); }
    await Supplier.bulkWrite([...supplierStats].map(([key, stat]) => ({ updateOne: {
      filter: { 'legacySource.system': legacySystem, 'legacySource.nameKey': key }, update: { $set: { name: stat.name, type: 'Automotive', balance: stat.balance, ordersCount: stat.orders, legacySource: { system: legacySystem, nameKey: key, importedAt } } }, upsert: true,
    } })), { ordered: false });
    const suppliers = new Map((await Supplier.find({ 'legacySource.system': legacySystem }).lean()).map(supplier => [supplier.legacySource.nameKey, supplier]));

    const paymentsBySale = new Map(), paymentsByPurchase = new Map();
    for (const row of paymentRows) {
      const entry = { method: paymentMethod(row['Paid by']), amount: amount(row.Amount), reference: row['payment reference'], paidAt: parseDate(row.Date) || undefined, type: row.Type };
      const saleRef = String(row['Sale Reference'] || '').trim(), purchaseRef = String(row['purchase reference'] || '').trim();
      if (saleRef) { const list = paymentsBySale.get(saleRef) || []; list.push(entry); paymentsBySale.set(saleRef, list); }
      if (purchaseRef) { const list = paymentsByPurchase.get(purchaseRef) || []; list.push(entry); paymentsByPurchase.set(purchaseRef, list); }
    }

    const purchaseOps = purchases.map(row => {
      const date = parseDate(row.Date) || importedAt; const location = findLocation(row.Warehouse, locations, fallback); const total = amount(row['Grand Total']); const parsed = parseItems(row['Product (Qty)']);
      const rawPayments = paymentsByPurchase.get(row._reference) || []; const listed = round(rawPayments.reduce((sum, payment) => sum + payment.amount, 0)); const reported = amount(row.Paid);
      const payments = rawPayments.map(({ type, ...payment }) => payment); if (round(reported - listed) !== 0) payments.push({ method: 'Legacy paid balance', amount: round(reported - listed), reference: 'Imported paid total', paidAt: date });
      const weighted = allocateItems(parsed, total, location, productIndexes);
      return { updateOne: { filter: { 'legacySource.system': legacySystem, 'legacySource.id': `${row._reference}|${row._index}` }, update: { $set: {
        poNumber: row._occurrence === 1 ? row._reference : `${row._reference}-DUP-${row._occurrence}`,
        supplier: suppliers.get(normalize(row.Supplier))._id, branch: location?.branch?._id, outlet: location?.outlet?._id,
        items: weighted.map(item => ({ description: item.name, qty: Math.abs(item.qty), unitCost: item.price })), amount: total, paid: reported, balance: amount(row.Balance), payments,
        status: normalize(row.Status) === 'received' ? 'delivered' : 'approved', postedAt: date,
        legacySource: { system: legacySystem, id: `${row._reference}|${row._index}`, warehouse: row.Warehouse, importedAt }, createdAt: date, updatedAt: date,
      } }, upsert: true, timestamps: false } };
    });
    for (let i = 0; i < purchaseOps.length; i += 1000) await PurchaseOrder.bulkWrite(purchaseOps.slice(i, i + 1000), { ordered: false, timestamps: false });

    const firstPositive = new Map();
    for (const row of sales) if (amount(row['Grand Total']) >= 0 && !firstPositive.has(row._reference)) firstPositive.set(row._reference, row);
    const saleOps = sales.map(row => {
      const date = parseDate(row.Date) || importedAt; const total = amount(row['Grand Total']); const location = findLocation(row.Biller, locations, fallback); const negative = total < 0;
      const cashier = staffByBiller.get(normalize(row.Biller)); const customer = customers.get(normalize(row.Customer || 'Walk-in Customer'));
      const sourcePayments = (paymentsBySale.get(row._reference) || []).filter(payment => negative ? payment.type === 'returned' : payment.type === 'received');
      const listed = round(sourcePayments.reduce((sum, payment) => sum + payment.amount, 0)); const reportedPaid = amount(row.Paid); const balance = amount(row.Balance);
      const payments = sourcePayments.map(({ type, paidAt, ...payment }) => payment);
      if (round(reportedPaid - listed) !== 0) payments.push({ method: 'Legacy paid balance', amount: round(reportedPaid - listed), reference: 'Imported paid total' });
      if (balance !== 0) payments.push({ method: 'Customer Credit', amount: balance, reference: 'Imported outstanding balance' });
      const suffix = negative ? `-REV-${row._occurrence}` : row._occurrence > 1 ? `-DUP-${row._occurrence}` : '';
      const items = allocateItems(parseItems(row['Product (Qty)']), total, location, productIndexes);
      return { updateOne: { filter: { 'legacySource.system': legacySystem, 'legacySource.rowKey': `sale:${row._index}` }, update: { $set: {
        invoiceNumber: `${row._reference}${suffix}`, branch: location?.branch?._id, outlet: location?.outlet?._id, cashier: cashier?._id, customer: customer?._id,
        items, subtotal: total, tax: 0, total, payments, paymentMethod: payments.find(payment => payment.method !== 'Customer Credit')?.method || (balance ? 'Customer Credit' : 'Cash'),
        discount: 0, taxRate: 0, channel: normalize(row.Biller).includes('online') ? 'online' : 'pos', status: 'posted', dailyApprovalStatus: 'approved', postedAt: date,
        notes: negative ? `Legacy reversal of ${row._reference}` : 'Imported from legacy sales history',
        legacySource: { system: legacySystem, rowKey: `sale:${row._index}`, reference: row._reference, biller: row.Biller, paymentStatus: row['Payment Status'], importedAt, itemPricing: 'allocated_from_transaction_total' }, createdAt: date, updatedAt: date,
      } }, upsert: true, timestamps: false } };
    });
    for (let i = 0; i < saleOps.length; i += 1000) await Sale.bulkWrite(saleOps.slice(i, i + 1000), { ordered: false, timestamps: false });

    const importedSales = await Sale.find({ 'legacySource.system': legacySystem }).select('_id legacySource.reference legacySource.rowKey total').lean();
    const positiveByRef = new Map(); for (const sale of importedSales) if (sale.total >= 0 && !positiveByRef.has(sale.legacySource.reference)) positiveByRef.set(sale.legacySource.reference, sale);
    const reversalOps = importedSales.filter(sale => sale.total < 0 && positiveByRef.has(sale.legacySource.reference)).map(sale => ({ updateOne: { filter: { _id: sale._id }, update: { $set: { reversalOf: positiveByRef.get(sale.legacySource.reference)._id } } } }));
    if (reversalOps.length) await Sale.bulkWrite(reversalOps, { ordered: false });

    const returnOps = returns.map(row => {
      const date = parseDate(row.Date) || importedAt; const location = findLocation(row.Biller, locations, fallback); const total = -Math.abs(amount(row['Grand Total'])); const customer = customers.get(normalize(row.Customer || 'Walk-in Customer'));
      return { updateOne: { filter: { 'legacySource.system': legacySystem, 'legacySource.rowKey': `return:${row._index}` }, update: { $set: {
        invoiceNumber: row._occurrence === 1 ? row._reference : `${row._reference}-DUP-${row._occurrence}`, branch: location?.branch?._id, outlet: location?.outlet?._id, customer: customer?._id,
        items: [{ name: 'Legacy sales return', category: 'Tyre', price: Math.abs(total), cost: 0, qty: -1 }], subtotal: total, tax: 0, total, payments: [], paymentMethod: 'Legacy Return', discount: 0, taxRate: 0, channel: 'pos', status: 'posted', dailyApprovalStatus: 'approved', postedAt: date,
        notes: 'Imported legacy return', legacySource: { system: legacySystem, rowKey: `return:${row._index}`, reference: row._reference, biller: row.Biller, paymentStatus: 'Returned', importedAt, itemPricing: 'return_total' }, createdAt: date, updatedAt: date,
      } }, upsert: true, timestamps: false } };
    });
    if (returnOps.length) await Sale.bulkWrite(returnOps, { ordered: false, timestamps: false });

    summary.imported = { customers: customerStats.size, suppliers: supplierStats.size, sales: sales.length, purchases: purchases.length, returns: returns.length, payments: paymentRows.length, linkedReversals: reversalOps.length };
    await MigrationRun.findOneAndUpdate({ key: migrationKey }, { $set: { status: 'completed', summary } });
    return summary;
  } catch (error) {
    await MigrationRun.findOneAndUpdate({ key: migrationKey }, { $set: { status: 'failed', error: error.message } }, { upsert: true });
    throw error;
  } finally { await disconnectDB(); }
}

migrate().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
