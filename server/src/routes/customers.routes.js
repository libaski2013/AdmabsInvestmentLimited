import Customer from '../models/Customer.js';

export default async function customerRoutes(fastify) {
  fastify.get('/api/customers', { preHandler: [fastify.authenticate] }, async (request) => {
    const { type, credit } = request.query || {};
    const filter = {};
    if (type) filter.type = type;
    if (credit === 'true') filter.balance = { $gt: 0 };
    return Customer.find(filter).sort({ name: 1 });
  });

  fastify.post('/api/customers', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const customer = await Customer.create(request.body);
    return reply.code(201).send(customer);
  });

  fastify.patch('/api/customers/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const customer = await Customer.findByIdAndUpdate(request.params.id, request.body, { new: true });
    if (!customer) return reply.code(404).send({ error: 'Customer not found' });
    return customer;
  });
}
