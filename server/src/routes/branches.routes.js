import Branch from '../models/Branch.js';
import Outlet from '../models/Outlet.js';
import User from '../models/User.js';
import Product from '../models/Product.js';

const OUTLET_BLUEPRINTS = {
  tyres: { suffix: 'AUTO', label: 'Tyres, Rims, Batteries & Services' },
  supermarket: { suffix: 'MART', label: 'Supermarket' },
  fuel: { suffix: 'FUEL', label: 'Filling Station' },
  warehouse: { suffix: 'WH', label: 'Warehouse' },
  head_office: { suffix: 'HQ', label: 'Head Office' },
};

async function syncDivisionOutlets(branch) {
  const selected = new Set(branch.divisions || []);
  const existing = await Outlet.find({ branch: branch._id });
  for (const [division, blueprint] of Object.entries(OUTLET_BLUEPRINTS)) {
    const matches = existing.filter(outlet => outlet.division === division);
    if (selected.has(division)) {
      if (matches.length) await Outlet.updateMany({ _id: { $in: matches.map(outlet => outlet._id) } }, { active: true });
      else await Outlet.create({
        code: `${blueprint.suffix}-${String(branch._id).slice(-6)}`,
        name: `${branch.name} — ${blueprint.label}`,
        branch: branch._id,
        division,
        active: true,
        allowCreditSales: division === 'tyres',
      });
    } else if (matches.length) {
      await Outlet.updateMany({ _id: { $in: matches.map(outlet => outlet._id) } }, { active: false });
    }
  }
  return Outlet.find({ branch: branch._id, active: true }).sort({ division: 1 });
}

export default async function branchRoutes(fastify) {
  fastify.get('/api/branches', { preHandler: [fastify.authenticate] }, async () => {
    return Branch.find().sort({ name: 1 });
  });

  fastify.post(
    '/api/branches',
    { preHandler: [fastify.authenticate, fastify.requirePermission('branches.manage')] },
    async (request, reply) => {
      const branch = await Branch.create(request.body);
      const outlets = await syncDivisionOutlets(branch);
      return reply.code(201).send({ ...branch.toObject(), outlets });
    }
  );

  fastify.patch('/api/branches/:id', { preHandler: [fastify.authenticate, fastify.requirePermission('branches.manage')] }, async (request, reply) => {
    const branch = await Branch.findByIdAndUpdate(request.params.id, request.body, { new: true, runValidators: true });
    if (!branch) return reply.code(404).send({ error: 'Branch not found' });
    const outlets = await syncDivisionOutlets(branch);
    return { ...branch.toObject(), outlets };
  });

  fastify.delete('/api/branches/:id', { preHandler: [fastify.authenticate, fastify.requirePermission('branches.manage')] }, async (request, reply) => {
    const [staff, stock] = await Promise.all([User.countDocuments({ $or: [{ branch: request.params.id }, { branches: request.params.id }] }), Product.countDocuments({ branch: request.params.id, active: true })]);
    if (staff || stock) return reply.code(409).send({ error: `Move ${staff} staff account(s) and ${stock} active stock item(s) before deleting this branch` });
    const branch = await Branch.findByIdAndDelete(request.params.id);
    if (!branch) return reply.code(404).send({ error: 'Branch not found' });
    await Outlet.deleteMany({ branch: request.params.id });
    return reply.code(204).send();
  });

  fastify.get('/api/outlets', { preHandler: [fastify.authenticate] }, async request => {
    const filter = ['super_admin', 'ceo', 'gm'].includes(request.user.role) ? {} : request.user.outletIds?.length ? { _id: { $in: request.user.outletIds } } : { branch: { $in: request.user.branchIds || [] } };
    return Outlet.find({ ...filter, active: true }).populate('branch', 'name code').sort({ name: 1 });
  });

  fastify.post('/api/outlets', { preHandler: [fastify.authenticate, fastify.requirePermission('branches.manage')] }, async (request, reply) => {
    const outlet = await Outlet.create(request.body);
    return reply.code(201).send(outlet);
  });

  fastify.patch('/api/outlets/:id', { preHandler: [fastify.authenticate, fastify.requirePermission('branches.manage')] }, async (request, reply) => {
    const outlet = await Outlet.findByIdAndUpdate(request.params.id, request.body, { new: true, runValidators: true });
    if (!outlet) return reply.code(404).send({ error: 'Outlet not found' });
    return outlet;
  });
}
