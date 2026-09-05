import User from '../models/User.js';
import Customer from '../models/Customer.js';
import SmsCampaign from '../models/SmsCampaign.js';

export default async function smsRoutes(fastify) {
  const guard=[fastify.authenticate,fastify.requirePermission('sms.manage','ceo','gm')];
  fastify.get('/api/sms/campaigns',{preHandler:guard},async request=>SmsCampaign.find(['super_admin','ceo','gm'].includes(request.user.role)?{}:{createdBy:request.user.id}).populate('createdBy','name').sort({createdAt:-1}).limit(100));
  fastify.post('/api/sms/campaigns',{preHandler:guard},async(request,reply)=>{
    const {audience,message}=request.body||{}; if(!['employees','customers','both'].includes(audience)||!String(message||'').trim())return reply.code(400).send({error:'Audience and message are required'});
    const recipients=[];
    const global=['super_admin','ceo','gm'].includes(request.user.role), branchIds=request.user.branchIds||[], outletIds=request.user.outletIds||[];
    const staffScope=global?{}:{$or:[{branch:{$in:branchIds}},{branches:{$in:branchIds}},{outlets:{$in:outletIds}}]};
    if(audience!=='customers'){const users=await User.find({active:true,phone:{$nin:[null,'']},...staffScope}).select('name phone').lean();recipients.push(...users.map(x=>({name:x.name,phone:x.phone,type:'employee'})));}
    if(audience!=='employees'){const customers=await Customer.find({active:{$ne:false},phone:{$nin:[null,'']},...fastify.scopeFilter(request)}).select('name phone').lean();recipients.push(...customers.map(x=>({name:x.name,phone:x.phone,type:'customer'})));}
    const unique=[...new Map(recipients.map(x=>[x.phone,x])).values()];
    const campaign=await SmsCampaign.create({audience,message:String(message).trim(),recipients:unique,recipientCount:unique.length,createdBy:request.user.id,status:'queued'});
    return reply.code(201).send(campaign);
  });
}
