import bcrypt from 'bcryptjs';
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

const models = { JournalEntry, FuelDip, FuelShift, FuelDelivery, FuelPump, FuelTank, CashReconciliation, Sale, PurchaseOrder, Expense, Approval, Product, Customer, Supplier, User, Outlet, Branch };
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = list => list[rand(0, list.length - 1)];
const dateAgo = days => new Date(Date.now() - rand(0, days) * 86400000 - rand(0, 86399) * 1000);
const ids = docs => docs.map(doc => doc._id);

export default async function demoRoutes(fastify) {
  const access = { preHandler: [fastify.authenticate, fastify.requireRole('ceo')] };
  fastify.get('/api/demo/batches', access, async () => DemoBatch.find().sort({ createdAt: -1 }).lean());

  fastify.post('/api/demo/seed', access, async (request, reply) => {
    if (await DemoBatch.exists({ status: { $in: ['creating', 'ready'] } })) return reply.code(409).send({ error: 'Demo data already exists. Delete the current demo batch before generating another.' });
    const code = `DEMO-${Date.now()}`;
    const batch = await DemoBatch.create({ code, label: request.body?.label || 'ADMABS full company demonstration', createdBy: request.user.id });
    const recordIds = {};
    try {
      const branchNames = ['Accra Central','Tema Industrial','Kumasi Main','Takoradi Harbour','Tamale Central','Cape Coast','Sunyani Main','Ho Central','Koforidua','Techiman'];
      const branches = await Branch.insertMany(branchNames.map((name,i) => ({ name: `[DEMO] ${name}`, code:`D${i+1}`, type:i%3===0?'Filling Station':i%3===1?'Tyres & Batteries':'Supermarket', manager:`Demo Manager ${i+1}`, staffCount:10, region:pick(['Greater Accra','Ashanti','Bono','Northern','Western']), divisions:i%3===0?['fuel','supermarket']:i%3===1?['tyres']:['supermarket'], active:true })));
      recordIds.Branch=ids(branches);
      const outlets = await Outlet.insertMany(branches.flatMap((b,i) => {
        const base=[{code:`D${i+1}-TY`,name:`[DEMO] ${branchNames[i]} Tyres`,division:'tyres'}];
        if(i%3===0)base.push({code:`D${i+1}-FS`,name:`[DEMO] ${branchNames[i]} Fuel`,division:'fuel'},{code:`D${i+1}-SM`,name:`[DEMO] ${branchNames[i]} Supermarket`,division:'supermarket'});
        else if(i%3===2)base.push({code:`D${i+1}-SM`,name:`[DEMO] ${branchNames[i]} Supermarket`,division:'supermarket'});
        return base.map(x=>({...x,branch:b._id,active:true}));
      })); recordIds.Outlet=ids(outlets);
      const passwordHash=await bcrypt.hash('Demo@12345',8); const roles=['gm','finance','accountant','branch','sub_manager','staff','cashier','fuel','storekeeper','procurement'];
      const users=await User.insertMany(Array.from({length:100},(_,i)=>{const outlet=outlets[i%outlets.length];return {name:`[DEMO] Staff Member ${i+1}`,username:`demo.${code.toLowerCase()}.${i+1}`,passwordHash,role:roles[i%roles.length],branch:outlet.branch,branches:[outlet.branch],outlets:[outlet._id],employeeNumber:`DEM-${String(i+1).padStart(4,'0')}`,active:true}})); recordIds.User=ids(users);
      const categories=['Tyre','Rim','Battery','Grocery','Beverages','Snacks','Household','Bakery','Dairy'];
      const names={Tyre:['Michelin Primacy','Bridgestone Turanza','Goodyear EfficientGrip','Continental CrossContact'],Rim:['Apex Alloy Rim','RoadPro Sport Rim','Titan Steel Rim'],Battery:['Bosch S4 Battery','Exide Premium','Amaron GO'],Grocery:['Premium Rice','Cooking Oil','Canned Tomatoes'],Beverages:['Mineral Water','Fruit Juice','Malt Drink'],Snacks:['Plantain Chips','Biscuits','Groundnuts'],Household:['Washing Powder','Tissue Roll','Dish Soap'],Bakery:['Fresh Bread','Cake Slice','Meat Pie'],Dairy:['Fresh Milk','Yoghurt','Butter']};
      const products=await Product.insertMany(Array.from({length:300},(_,i)=>{const category=categories[i%categories.length],outlet=outlets[i%outlets.length],cost=rand(10,1800);return {code:`${code}-SKU-${i+1}`,name:`[DEMO] ${pick(names[category])} ${i+1}`,category,qty:rand(5,120),reorderLevel:rand(3,15),cost,price:Math.round(cost*(1+rand(15,45)/100)),branch:outlet.branch,outlet:outlet._id,websiteVisible:['Tyre','Rim','Battery'].includes(category),description:`Demonstration ${category.toLowerCase()} inventory item`,active:true}})); recordIds.Product=ids(products);
      const customers=await Customer.insertMany(Array.from({length:200},(_,i)=>{const outlet=outlets[i%outlets.length];return {name:`[DEMO] ${i%5===0?'Corporate Fleet':'Customer'} ${i+1}`,type:i%5===0?'Corporate':i%7===0?'Fleet':'Retail',phone:`+233 20 000 ${String(i).padStart(4,'0')}`,email:`demo.customer${i+1}@example.com`,balance:i%6===0?rand(100,8000):0,loyaltyPoints:rand(0,3000),visits:rand(1,30),lastVisit:dateAgo(120),branch:outlet.branch,outlet:outlet._id,active:true}})); recordIds.Customer=ids(customers);
      const suppliers=await Supplier.insertMany(Array.from({length:30},(_,i)=>({name:`[DEMO] Supplier ${i+1}`,type:pick(['Tyre','Fuel','Battery','Grocery']),balance:rand(0,50000),ordersCount:rand(1,30)}))); recordIds.Supplier=ids(suppliers);
      const pos=await PurchaseOrder.insertMany(Array.from({length:120},(_,i)=>{const amount=rand(1000,50000);return {poNumber:`${code}-PO-${i+1}`,supplier:suppliers[i%suppliers.length]._id,items:[{description:`Demo stock order ${i+1}`,qty:rand(2,50),unitCost:Math.round(amount/10)}],amount,status:pick(['pending','approved','delivered']),createdAt:dateAgo(180)}})); recordIds.PurchaseOrder=ids(pos);
      const sales=await Sale.insertMany(Array.from({length:600},(_,i)=>{const product=products[i%products.length],qty=rand(1,3),subtotal=product.price*qty,tax=Math.round(subtotal*.15*100)/100,total=subtotal+tax,method=pick(['Cash','Card','Mobile Money','Bank Transfer']);return {invoiceNumber:`${code}-INV-${i+1}`,branch:product.branch,outlet:product.outlet,cashier:users[i%users.length]._id,customer:customers[i%customers.length]._id,items:[{product:product._id,name:product.name,category:product.category,price:product.price,cost:product.cost,qty}],subtotal,tax,total,paymentMethod:method,payments:[{method,amount:total}],taxRate:.15,channel:i%12===0?'online':'pos',status:'posted',postedAt:dateAgo(180),createdAt:dateAgo(180)}})); recordIds.Sale=ids(sales);
      const journals=await JournalEntry.insertMany(sales.map((s,i)=>({number:`${code}-JE-${i+1}`,date:s.createdAt,description:`Demo sale ${s.invoiceNumber}`,source:'sale',sourceId:s._id,branch:s.branch,outlet:s.outlet,createdBy:users[i%users.length]._id,lines:[{accountCode:'1000',accountName:'Cash and Payment Clearing',debit:s.total,credit:0},{accountCode:'4000',accountName:'Sales Revenue and VAT',debit:0,credit:s.total}],status:'posted'}))); recordIds.JournalEntry=ids(journals);
      const expenses=await Expense.insertMany(Array.from({length:200},(_,i)=>{const outlet=outlets[i%outlets.length];return {description:`[DEMO] ${pick(['Utilities','Vehicle fuel','Maintenance','Stationery','Security'])} expense ${i+1}`,amount:rand(50,5000),category:pick(['Vehicle','Admin','Utilities','Facilities']),branch:`[DEMO] ${branchNames[i%10]}`,branchRef:outlet.branch,outlet:outlet._id,submittedBy:users[i%users.length].name,hasReceipt:i%3!==0,status:pick(['pending','approved','approved','rejected']),createdAt:dateAgo(180)}})); recordIds.Expense=ids(expenses);
      const approvals=await Approval.insertMany(Array.from({length:200},(_,i)=>({type:pick(['Discount','Purchase Order','Credit Sale','Fuel Shortage','Expense']),description:`[DEMO] Approval request ${i+1}`,requestedBy:users[i%users.length].name,amount:rand(100,20000),priority:pick(['low','medium','high']),status:pick(['pending','approved','rejected']),createdAt:dateAgo(120)}))); recordIds.Approval=ids(approvals);
      const reconciliations=await CashReconciliation.insertMany(Array.from({length:120},(_,i)=>{const outlet=outlets[i%outlets.length],expected=rand(2000,25000),variance=rand(-200,200),day=new Date();day.setHours(0,0,0,0);day.setDate(day.getDate()-Math.floor(i/outlets.length));return {number:`${code}-REC-${i+1}`,businessDate:day,branch:outlet.branch,outlet:outlet._id,expected:{cash:expected*.5,card:expected*.2,mobileMoney:expected*.2,bank:expected*.1,credit:0,total:expected},counted:{cash:expected*.5+variance,card:expected*.2,mobileMoney:expected*.2,bank:expected*.1,credit:0,total:expected+variance},variance,stockBookValue:rand(50000,250000),stockCountValue:rand(50000,250000),stockVariance:rand(-2000,2000),explanation:'[DEMO] End-of-day control record',status:pick(['submitted','approved','queried']),submittedBy:users[i%users.length]._id}})); recordIds.CashReconciliation=ids(reconciliations);
      const fuelOutlets=outlets.filter(o=>o.division==='fuel'); const tanks=await FuelTank.insertMany(fuelOutlets.flatMap((o,i)=>['petrol','diesel'].map((product,j)=>({code:`${code}-T${i+1}${j+1}`,name:`[DEMO] ${product} tank ${i+1}`,branch:o.branch,outlet:o._id,product,capacityLitres:45000,currentLitres:rand(8000,42000),reorderLevelLitres:9000,active:true,lastDipAt:dateAgo(2)})))); recordIds.FuelTank=ids(tanks);
      const pumps=await FuelPump.insertMany(tanks.flatMap((t,i)=>[1,2].map(n=>({code:`${code}-P${i+1}${n}`,name:`[DEMO] Pump ${i+1}-${n}`,branch:t.branch,outlet:t.outlet,tank:t._id,product:t.product,pricePerLitre:t.product==='petrol'?15.9:16.4,nozzles:[{code:`N${n}`,label:`Nozzle ${n}`,meterReading:rand(10000,90000),active:true}],status:'active'})))); recordIds.FuelPump=ids(pumps);
      const shifts=await FuelShift.insertMany(Array.from({length:200},(_,i)=>{const p=pumps[i%pumps.length],litres=rand(80,900),price=p.pricePerLitre,expected=Math.round(litres*price*100)/100,variance=rand(-100,100);return {number:`${code}-FS-${i+1}`,branch:p.branch,outlet:p.outlet,attendant:users[i%users.length]._id,pump:p._id,nozzleCode:p.nozzles[0].code,product:p.product,openedAt:dateAgo(90),closedAt:dateAgo(80),openingMeter:p.nozzles[0].meterReading-litres,closingMeter:p.nozzles[0].meterReading,litresSold:litres,pricePerLitre:price,expectedAmount:expected,payments:{cash:expected+variance,card:0,mobileMoney:0,credit:0},actualCollected:expected+variance,cashVariance:variance,status:pick(['submitted','approved','queried'])}})); recordIds.FuelShift=ids(shifts);
      const deliveries=await FuelDelivery.insertMany(Array.from({length:100},(_,i)=>{const t=tanks[i%tanks.length],dispatched=rand(8000,20000),received=dispatched-rand(0,120);return {number:`${code}-FD-${i+1}`,deliveryNote:`${code}-DN-${i+1}`,supplier:suppliers[i%suppliers.length].name,tankerRegistration:`DEMO-${i+100}`,branch:t.branch,outlet:t.outlet,tank:t._id,product:t.product,orderedLitres:dispatched,dispatchedLitres:dispatched,receivedLitres:received,varianceLitres:received-dispatched,sealNumbers:[`S${i}A`,`S${i}B`],sealsIntact:i%10!==0,receivedAt:dateAgo(120),status:'received',recordedBy:users[i%users.length]._id}})); recordIds.FuelDelivery=ids(deliveries);
      const dips=await FuelDip.insertMany(Array.from({length:120},(_,i)=>{const t=tanks[i%tanks.length],book=rand(6000,40000),variance=rand(-150,150);return {number:`${code}-DIP-${i+1}`,branch:t.branch,outlet:t.outlet,tank:t._id,measuredAt:dateAgo(120),openingLitres:book+rand(100,800),deliveriesLitres:rand(0,15000),pumpSalesLitres:rand(100,1500),theoreticalClosingLitres:book,closingDipLitres:book+variance,varianceLitres:variance,variancePercent:Math.round(variance/book*10000)/100,status:pick(['pending','approved','queried']),recordedBy:users[i%users.length]._id}})); recordIds.FuelDip=ids(dips);
      batch.status='ready'; batch.recordIds=recordIds; batch.counts=Object.fromEntries(Object.entries(recordIds).map(([k,v])=>[k,v.length])); await batch.save();
      return reply.code(201).send({ id:batch._id, code, status:batch.status, counts:batch.counts, total:Object.values(batch.counts).reduce((s,n)=>s+n,0) });
    } catch (error) { batch.status='failed';batch.recordIds=recordIds;batch.error=error.message;await batch.save();return reply.code(500).send({error:`Demo generation stopped: ${error.message}`,batchId:batch._id}); }
  });

  fastify.delete('/api/demo/batches/:id', access, async (request, reply) => {
    const batch=await DemoBatch.findById(request.params.id); if(!batch||batch.status==='deleted')return reply.code(404).send({error:'Active demo batch not found'});
    batch.status='deleting';await batch.save();
    for(const [name,Model] of Object.entries(models)){const list=batch.recordIds?.[name]||[];if(list.length)await Model.deleteMany({_id:{$in:list}});}
    batch.status='deleted';batch.deletedAt=new Date();batch.deletedBy=request.user.id;await batch.save();
    return {id:batch._id,status:'deleted',deletedCounts:batch.counts};
  });
}
