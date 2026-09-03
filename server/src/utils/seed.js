import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Sale from '../models/Sale.js';
import Expense from '../models/Expense.js';
import Approval from '../models/Approval.js';

const log = console;

async function seed() {
  await connectDB(log);

  console.log('Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Branch.deleteMany({}),
    Product.deleteMany({}),
    Customer.deleteMany({}),
    Supplier.deleteMany({}),
    PurchaseOrder.deleteMany({}),
    Sale.deleteMany({}),
    Expense.deleteMany({}),
    Approval.deleteMany({}),
  ]);

  console.log('Seeding branches...');
  const branches = await Branch.insertMany([
    { name: 'Harare Main', type: 'Tyres & Batteries', manager: 'Tendai Moyo', staffCount: 28 },
    { name: 'Bulawayo Branch', type: 'Tyres & Batteries', manager: 'Simba Ncube', staffCount: 18 },
    { name: 'Fuel Station Harare', type: 'Filling Station', manager: 'Charles Dube', staffCount: 14 },
    { name: 'Harare Supermarket', type: 'Supermarket', manager: 'Rudo Chikwanda', staffCount: 22 },
    { name: 'Head Office', type: 'Administration', manager: 'CEO', staffCount: 8 },
  ]);
  const [harareMain] = branches;

  console.log('Seeding users...');
  const roleAccounts = [
    { name: 'Chido Admabs', username: 'ceo', role: 'ceo' },
    { name: 'Farai Manager', username: 'gm', role: 'gm' },
    { name: 'Tendai Moyo', username: 'branch', role: 'branch' },
    { name: 'Blessing Chirwa', username: 'finance', role: 'finance' },
    { name: 'Rudo Chikwanda', username: 'staff', role: 'staff' },
    { name: 'Simba Ncube', username: 'fuel', role: 'fuel' },
  ];
  for (const acc of roleAccounts) {
    const passwordHash = await bcrypt.hash(acc.username, 10); // demo: password === username
    await User.create({ ...acc, passwordHash, branch: harareMain._id });
  }

  console.log('Seeding products...');
  const products = await Product.insertMany([
    { code: 'TY-001', name: 'Michelin 205/55R16', category: 'Tyre', qty: 3, reorderLevel: 10, price: 125, cost: 88, icon: '🛞' },
    { code: 'TY-002', name: 'Bridgestone 195/65R15', category: 'Tyre', qty: 24, reorderLevel: 8, price: 102, cost: 72, icon: '🛞' },
    { code: 'TY-003', name: 'Goodyear 215/65R16', category: 'Tyre', qty: 14, reorderLevel: 8, price: 115, cost: 80, icon: '🛞' },
    { code: 'TY-004', name: 'Continental 205/60R16', category: 'Tyre', qty: 20, reorderLevel: 8, price: 132, cost: 92, icon: '🛞' },
    { code: 'BA-001', name: 'Battery 12V 60Ah', category: 'Battery', qty: 15, reorderLevel: 5, price: 89, cost: 58, icon: '🔋' },
    { code: 'BA-002', name: 'Battery 12V 90Ah', category: 'Battery', qty: 7, reorderLevel: 5, price: 128, cost: 84, icon: '🔋' },
    { code: 'SV-001', name: 'Tyre Fitting', category: 'Service', qty: 9999, reorderLevel: 0, price: 15, cost: 5, icon: '🔧' },
    { code: 'SV-002', name: 'Wheel Balancing', category: 'Service', qty: 9999, reorderLevel: 0, price: 12, cost: 4, icon: '⚖️' },
    { code: 'SV-003', name: 'Wheel Alignment', category: 'Service', qty: 9999, reorderLevel: 0, price: 25, cost: 8, icon: '🎯' },
    { code: 'SV-004', name: 'Puncture Repair', category: 'Service', qty: 9999, reorderLevel: 0, price: 8, cost: 3, icon: '🔧' },
    { code: 'LU-001', name: 'Engine Oil 5W-30 4L', category: 'Lubricant', qty: 42, reorderLevel: 12, price: 26, cost: 18, icon: '🛢️' },
    { code: 'FU-001', name: 'Petrol 93 (per litre)', category: 'Fuel', qty: 20000, reorderLevel: 2000, price: 1.55, cost: 1.3, icon: '⛽' },
    { code: 'FU-002', name: 'Diesel (per litre)', category: 'Fuel', qty: 15000, reorderLevel: 2000, price: 1.4, cost: 1.18, icon: '⛽' },
    { code: 'SM-001', name: 'Bread (Proton)', category: 'Grocery', qty: 5, reorderLevel: 20, price: 1.2, cost: 0.8, icon: '🍞' },
    { code: 'SM-002', name: 'Fresh Milk 2L', category: 'Grocery', qty: 30, reorderLevel: 15, price: 2.4, cost: 1.7, icon: '🥛' },
  ]);
  const byCode = Object.fromEntries(products.map((p) => [p.code, p]));

  console.log('Seeding customers...');
  await Customer.insertMany([
    { name: 'John Mutasa', type: 'Retail', phone: '+263 77 123 4567', balance: 0, loyaltyPoints: 1240, visits: 12, lastVisit: new Date() },
    { name: 'Zimra Fleet Account', type: 'Fleet', phone: '+263 24 234 5678', balance: 4800, loyaltyPoints: 0, visits: 18, lastVisit: new Date() },
    { name: 'Econet Wireless Ltd', type: 'Corporate', phone: '+263 78 345 6789', balance: 12400, loyaltyPoints: 0, visits: 24, lastVisit: new Date() },
    { name: 'Tendai Chikumba', type: 'Retail', phone: '+263 71 456 7890', balance: 320, loyaltyPoints: 880, visits: 1, lastVisit: new Date() },
  ]);

  console.log('Seeding suppliers...');
  const suppliers = await Supplier.insertMany([
    { name: 'Bridgestone Zimbabwe', type: 'Tyre', balance: 12400, ordersCount: 8 },
    { name: 'TotalEnergies', type: 'Fuel', balance: 34200, ordersCount: 12 },
    { name: 'Banner Batteries', type: 'Battery', balance: 5400, ordersCount: 3 },
    { name: 'OK Distributors', type: 'Grocery', balance: 8800, ordersCount: 15 },
  ]);

  console.log('Seeding a purchase order...');
  await PurchaseOrder.create({
    poNumber: 'PO-0439',
    supplier: suppliers[2]._id,
    items: [{ description: 'Battery 12V 60Ah', qty: 20, unitCost: 58 }],
    amount: 1160,
    status: 'pending',
  });

  console.log('Seeding sales across the last 5 months...');
  const now = new Date();
  const salesToInsert = [];
  let invoiceCounter = 2041;
  for (let m = 4; m >= 0; m--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    // A handful of bulk transactions per month to build up realistic revenue.
    const monthlyMix = [
      { code: 'TY-002', qty: 40 + m * 3 },
      { code: 'BA-002', qty: 25 + m * 2 },
      { code: 'FU-001', qty: 8000 + m * 400 },
      { code: 'FU-002', qty: 6000 + m * 300 },
      { code: 'SM-002', qty: 300 + m * 20 },
      { code: 'SV-001', qty: 30 + m * 2 },
    ];
    for (const line of monthlyMix) {
      const product = byCode[line.code];
      const day = 3 + Math.floor(Math.random() * 20);
      const createdAt = new Date(monthDate.getFullYear(), monthDate.getMonth(), day, 9 + Math.floor(Math.random() * 8));
      const price = product.price;
      const subtotal = +(price * line.qty).toFixed(2);
      const tax = +(subtotal * 0.15).toFixed(2);
      salesToInsert.push({
        invoiceNumber: `INV-${invoiceCounter++}`,
        items: [
          {
            product: product._id,
            name: product.name,
            category: product.category,
            price,
            cost: product.cost,
            qty: line.qty,
          },
        ],
        subtotal,
        tax,
        total: +(subtotal + tax).toFixed(2),
        paymentMethod: 'Cash',
        status: 'posted',
        createdAt,
      });
    }
  }
  await Sale.insertMany(salesToInsert);

  console.log('Seeding expenses...');
  await Expense.insertMany([
    { description: 'Delivery van fuel — Gweru run', amount: 35, category: 'Vehicle', branch: 'Gweru', submittedBy: 'Tendai Moyo', hasReceipt: true, status: 'approved' },
    { description: 'Stationery & printing', amount: 28, category: 'Admin', branch: 'Head Office', submittedBy: 'Blessing Chirwa', hasReceipt: true, status: 'pending' },
    { description: 'Lunch — visiting auditors', amount: 85, category: 'Entertainment', branch: 'Head Office', submittedBy: 'CEO', hasReceipt: true, status: 'approved' },
    { description: 'Vehicle service — delivery van', amount: 280, category: 'Vehicle', branch: 'Harare Main', submittedBy: 'Tendai Moyo', hasReceipt: true, status: 'pending' },
    { description: 'Internet data bundles', amount: 45, category: 'Utilities', branch: 'Bulawayo', submittedBy: 'Simba Ncube', hasReceipt: false, status: 'pending' },
  ]);

  console.log('Seeding approvals...');
  await Approval.insertMany([
    { type: 'Discount', description: '28% discount — Econet Wireless fleet order', requestedBy: 'Tendai Moyo', amount: 1840, priority: 'high' },
    { type: 'Purchase Order', description: 'PO-0439 — Banner Batteries $1,160', requestedBy: 'Nyasha Sithole', amount: 1160, priority: 'high' },
    { type: 'Credit Sale', description: 'Credit limit increase — Dairiboard Zimbabwe', requestedBy: 'Rudo Chikwanda', amount: 3000, priority: 'medium' },
    { type: 'Fuel Shortage', description: 'Shift variance: Tafara N. — $18 short', requestedBy: 'Simba Ncube', amount: 18, priority: 'high' },
    { type: 'Expense', description: 'Vehicle service — delivery van', requestedBy: 'Tendai Moyo', amount: 280, priority: 'low' },
  ]);

  console.log('Seed complete. Demo logins (username / password):');
  for (const acc of roleAccounts) console.log(`  ${acc.username} / ${acc.username}  (${acc.role})`);

  await disconnectDB();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
