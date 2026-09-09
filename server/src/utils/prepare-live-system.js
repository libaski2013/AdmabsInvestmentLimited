import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import DemoBatch from '../models/DemoBatch.js';
import MigrationRun from '../models/MigrationRun.js';
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

const currentDir=path.dirname(fileURLToPath(import.meta.url));
const sourcePath=path.resolve(currentDir,'../../data/admabs-legacy-inventory-by-warehouse.json');
const key='prepare-live-system-2026-09-09-v1';
const legacySystem='shop.admabsgh.com';
const models={JournalEntry,FuelDip,FuelShift,FuelDelivery,FuelPump,FuelTank,CashReconciliation,Sale,PurchaseOrder,Expense,Approval,Product,Customer,Supplier,User,Outlet,Branch};
const codeFor=(name,id)=>`${name.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').slice(0,18)}-${id}`.toUpperCase();
const divisionFor=name=>/warehouse|container/i.test(name)?'warehouse':'tyres';

export default async function prepareLiveSystem(log=console){
  const completed=await MigrationRun.findOne({key,status:'completed'}).lean();
  if(completed)return completed.summary;
  await MigrationRun.findOneAndUpdate({key},{$set:{source:legacySystem,status:'running',error:null}},{upsert:true});
  try{
    const batches=await DemoBatch.find().lean();const deleted={};
    for(const batch of batches){for(const [name,Model] of Object.entries(models)){const ids=batch.recordIds?.[name]||[];if(!ids.length)continue;const result=await Model.deleteMany({_id:{$in:ids}});deleted[name]=(deleted[name]||0)+result.deletedCount}}
    const explicit=[
      [Branch,{name:/^\[DEMO\]/i}],[Outlet,{$or:[{name:/^\[DEMO\]/i},{code:/^DEMO-/i}]}],
      [Product,{$or:[{name:/^\[DEMO\]/i},{code:/^DEMO-/i}]}],[User,{$or:[{name:/^\[DEMO\]/i},{username:/^demo\.demo-/i}]}],
      [Customer,{name:/^\[DEMO\]/i}],[Supplier,{name:/^\[DEMO\]/i}],[Sale,{invoiceNumber:/^DEMO-/i}],
      [PurchaseOrder,{poNumber:/^DEMO-/i}],[JournalEntry,{number:/^DEMO-/i}],[CashReconciliation,{number:/^DEMO-/i}],
      [FuelTank,{code:/^DEMO-/i}],[FuelPump,{code:/^DEMO-/i}],[FuelShift,{number:/^DEMO-/i}],
      [FuelDip,{number:/^DEMO-/i}],[FuelDelivery,{number:/^DEMO-/i}],
    ];
    for(const [Model,filter] of explicit){const result=await Model.deleteMany(filter);if(result.deletedCount)deleted[Model.modelName]=(deleted[Model.modelName]||0)+result.deletedCount}
    await DemoBatch.deleteMany({});
    const source=JSON.parse(await fs.readFile(sourcePath,'utf8'));let restored=0;
    for(const warehouse of source.warehouses){const division=divisionFor(warehouse.name),code=codeFor(warehouse.name,warehouse.id),outletCode=`${code}-${division==='warehouse'?'WH':'AUTO'}`,importedAt=new Date();const branch=await Branch.findOneAndUpdate({$or:[{'legacySource.system':legacySystem,'legacySource.id':String(warehouse.id)},{code},{name:warehouse.name}]},{$set:{name:warehouse.name,code,type:division==='warehouse'?'Warehouse':'Tyres & Batteries',divisions:[division],active:true,legacySource:{system:legacySystem,id:String(warehouse.id),importedAt}}},{upsert:true,new:true,runValidators:true});await Outlet.findOneAndUpdate({$or:[{'legacySource.system':legacySystem,'legacySource.id':String(warehouse.id)},{code:outletCode},{name:warehouse.name}]},{$set:{code:outletCode,name:warehouse.name,branch:branch._id,division,active:true,allowCreditSales:division==='tyres',legacySource:{system:legacySystem,id:String(warehouse.id),importedAt}}},{upsert:true,new:true,runValidators:true});restored+=1}
    const summary={demoBatchesRemoved:batches.length,demoRecordsRemoved:deleted,liveBranchesRestored:restored,liveOutletsRestored:restored};
    await MigrationRun.findOneAndUpdate({key},{$set:{status:'completed',summary}});log.info?.(`Live-system preparation completed: ${JSON.stringify(summary)}`);return summary;
  }catch(error){await MigrationRun.findOneAndUpdate({key},{$set:{status:'failed',error:error.message}},{upsert:true});throw error}
}
