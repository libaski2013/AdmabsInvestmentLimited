import Customer from '../models/Customer.js';

export default async function customerRoutes(fastify) {
  fastify.get('/api/customers', { preHandler: [fastify.authenticate] }, async (request) => {
    const { type, credit } = request.query || {};
    const filter = { active: { $ne: false }, ...fastify.scopeFilter(request) };
    if (type) filter.type = type;
    if (credit === 'true') filter.balance = { $gt: 0 };
    return Customer.find(filter).sort({ name: 1 });
  });

  fastify.post('/api/customers', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = { ...request.body };
    if (!['ceo', 'gm'].includes(request.user.role)) {
      body.branch = request.user.branchIds?.[0]; body.outlet = request.user.outletIds?.[0];
    }
    const customer = await Customer.create(body);
    return reply.code(201).send(customer);
  });

  fastify.patch('/api/customers/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const customer = await Customer.findOneAndUpdate({ _id: request.params.id, ...fastify.scopeFilter(request) }, request.body, { new: true });
    if (!customer) return reply.code(404).send({ error: 'Customer not found' });
    return customer;
  });

  fastify.delete('/api/customers/:id', { preHandler: [fastify.authenticate, fastify.requireRole('ceo', 'gm')] }, async (request, reply) => {
    const customer = await Customer.findByIdAndUpdate(request.params.id, { active: false }, { new: true });
    if (!customer) return reply.code(404).send({ error: 'Customer not found' });
    return reply.code(204).send();
  });
}
