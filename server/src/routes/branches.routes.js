import Branch from '../models/Branch.js';
import Outlet from '../models/Outlet.js';
import User from '../models/User.js';
import Product from '../models/Product.js';

export default async function branchRoutes(fastify) {
  fastify.get('/api/branches', { preHandler: [fastify.authenticate] }, async () => {
    return Branch.find().sort({ name: 1 });
  });

  fastify.post(
    '/api/branches',
    { preHandler: [fastify.authenticate, fastify.requirePermission('branches.manage')] },
    async (request, reply) => {
      const branch = await Branch.create(request.body);
      return reply.code(201).send(branch);
    }
  );

  fastify.patch('/api/branches/:id', { preHandler: [fastify.authenticate, fastify.requirePermission('branches.manage')] }, async (request, reply) => {
    const branch = await Branch.findByIdAndUpdate(request.params.id, request.body, { new: true, runValidators: true });
    if (!branch) return reply.code(404).send({ error: 'Branch not found' });
    return branch;
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
    return Outlet.find(filter).populate('branch', 'name code').sort({ name: 1 });
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
