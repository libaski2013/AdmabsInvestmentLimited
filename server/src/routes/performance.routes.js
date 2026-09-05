import User from '../models/User.js';
import Sale from '../models/Sale.js';
import FuelShift from '../models/FuelShift.js';
import EmployeeReward from '../models/EmployeeReward.js';

const globalRoles=['super_admin','ceo','gm'];
const dates=request=>{const end=request.query?.end?new Date(`${request.query.end}T23:59:59.999Z`):new Date(),start=request.query?.start?new Date(`${request.query.start}T00:00:00.000Z`):new Date(end.getFullYear(),end.getMonth(),1);return {start,end};};
export default async function performanceRoutes(fastify){
  fastify.get('/api/performance',{preHandler:[fastify.authenticate]},async request=>{
    const {start,end}=dates(request),scope=fastify.scopeFilter(request),personal=!globalRoles.includes(request.user.role)&&!['branch','sub_manager'].includes(request.user.role);
    const [sales,shifts]=await Promise.all([
      Sale.find({...scope,...(personal?{cashier:request.user.id}:{}),status:'posted',createdAt:{$gte:start,$lte:end}}).select('cashier total dailyApprovalStatus').lean(),
      FuelShift.find({...scope,...(personal?{attendant:request.user.id}:{}),openedAt:{$gte:start,$lte:end},status:{$in:['submitted','approved']}}).select('attendant litresSold actualCollected cashVariance status').lean(),
    ]);
    const userFilter=globalRoles.includes(request.user.role)?{active:true,role:{$ne:'super_admin'}}:personal?{_id:request.user.id}:{$or:[{branch:{$in:request.user.branchIds||[]}},{branches:{$in:request.user.branchIds||[]}},{outlets:{$in:request.user.outletIds||[]}}]};
    const employees=await User.find(userFilter).select('name employeeNumber role jobTitle branch').populate('branch','name').lean(),ids=employees.map(x=>x._id);
    const rewards=await EmployeeReward.find({periodStart:{$lte:end},periodEnd:{$gte:start},...(!globalRoles.includes(request.user.role)?{employee:{$in:ids}}:{})}).populate('employee','name employeeNumber role jobTitle branch').sort({createdAt:-1}).lean();
    const metrics=employees.map(employee=>{const ownSales=sales.filter(x=>String(x.cashier)===String(employee._id)),ownShifts=shifts.filter(x=>String(x.attendant)===String(employee._id));const revenue=ownSales.reduce((s,x)=>s+x.total,0),fuelCollections=ownShifts.reduce((s,x)=>s+x.actualCollected,0),variance=ownShifts.reduce((s,x)=>s+Math.abs(x.cashVariance||0),0),approved=ownSales.filter(x=>x.dailyApprovalStatus==='approved').length+ownShifts.filter(x=>x.status==='approved').length,total=ownSales.length+ownShifts.length,score=total?Math.max(0,Math.min(100,Math.round(approved/total*45+Math.min(35,total*2)+Math.max(0,20-Math.min(20,variance/10))))):null;return {employee,salesCount:ownSales.length,revenue,fuelShiftCount:ownShifts.length,fuelLitres:ownShifts.reduce((s,x)=>s+x.litresSold,0),fuelCollections,variance,approvedCount:approved,score,rating:score===null?'Not Rated':score>=85?'Outstanding':score>=70?'Very Good':score>=55?'Good':'Needs Improvement'};}).sort((a,b)=>(b.score??-1)-(a.score??-1));
    return {start,end,metrics,rewards};
  });
  fastify.post('/api/performance/rewards',{preHandler:[fastify.authenticate,fastify.requirePermission('performance.manage','ceo','gm')]},async(request,reply)=>{const {employee,periodStart,periodEnd,title,amount=0,points=0,notes}=request.body||{};if(!employee||!title||!periodStart||!periodEnd)return reply.code(400).send({error:'Employee, period and reward title are required'});const reward=await EmployeeReward.create({employee,periodStart,periodEnd,title,amount:Number(amount),points:Number(points),notes,createdBy:request.user.id});return reply.code(201).send(reward);});
  fastify.patch('/api/performance/rewards/:id',{preHandler:[fastify.authenticate,fastify.requirePermission('performance.manage','ceo','gm')]},async(request,reply)=>{const status=request.body?.status;if(!['approved','paid','cancelled'].includes(status))return reply.code(400).send({error:'Invalid reward status'});const reward=await EmployeeReward.findByIdAndUpdate(request.params.id,{status,...(status==='paid'?{paidAt:new Date()}:{})},{new:true});if(!reward)return reply.code(404).send({error:'Reward not found'});return reward;});
}
