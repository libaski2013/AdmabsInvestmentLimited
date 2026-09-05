import User from '../models/User.js';
import PayrollRun from '../models/PayrollRun.js';

const allowed = ['super_admin', 'ceo', 'gm', 'finance', 'accountant'];
export default async function payrollRoutes(fastify) {
  const guard = [fastify.authenticate, fastify.requirePermission('payroll.manage', ...allowed)];
  fastify.get('/api/payroll/employees', { preHandler: guard }, async () =>
    User.find({ active: true, role: { $ne: 'super_admin' } }).select('name username employeeNumber phone role jobTitle department basicSalary branch outlets').populate('branch', 'name').sort({ name: 1 }).lean());
  fastify.patch('/api/payroll/employees/:id', { preHandler: guard }, async (request, reply) => {
    const updates = Object.fromEntries(['jobTitle','department','phone','basicSalary'].filter(k => k in (request.body || {})).map(k => [k, request.body[k]]));
    const employee = await User.findByIdAndUpdate(request.params.id, updates, { new: true, runValidators: true }).select('-passwordHash');
    if (!employee) return reply.code(404).send({ error: 'Employee not found' }); return employee;
  });
  fastify.get('/api/payroll/runs', { preHandler: guard }, async () => PayrollRun.find().populate('createdBy approvedBy', 'name').sort({ period: -1 }).limit(36));
  fastify.post('/api/payroll/runs', { preHandler: guard }, async (request, reply) => {
    const period = String(request.body?.period || ''); if (!/^\d{4}-\d{2}$/.test(period)) return reply.code(400).send({ error: 'Period must be YYYY-MM' });
    const employees = await User.find({ active: true, role: { $ne: 'super_admin' }, basicSalary: { $gt: 0 } }).lean();
    const lines = employees.map(e => ({ employee:e._id, employeeNumber:e.employeeNumber, name:e.name, jobTitle:e.jobTitle || e.role, basicSalary:e.basicSalary, allowances:0, deductions:0, netPay:e.basicSalary }));
    try { const run = await PayrollRun.create({ period, lines, grossTotal:lines.reduce((s,x)=>s+x.basicSalary,0), netTotal:lines.reduce((s,x)=>s+x.netPay,0), createdBy:request.user.id }); return reply.code(201).send(run); }
    catch (e) { return reply.code(400).send({ error:e.code===11000?'Payroll already exists for this period':e.message }); }
  });
  fastify.patch('/api/payroll/runs/:id', { preHandler: guard }, async (request, reply) => {
    const status=request.body?.status; if(!['approved','paid'].includes(status)) return reply.code(400).send({error:'Status must be approved or paid'});
    const update={status,approvedBy:request.user.id,approvedAt:new Date()}; if(status==='paid') update['lines.$[].status']='paid',update['lines.$[].paidAt']=new Date();
    const run=await PayrollRun.findByIdAndUpdate(request.params.id,update,{new:true}); if(!run)return reply.code(404).send({error:'Payroll run not found'}); return run;
  });
}
