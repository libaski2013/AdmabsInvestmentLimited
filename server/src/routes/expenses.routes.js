import Expense from '../models/Expense.js';

export default async function expenseRoutes(fastify) {
  fastify.get('/api/expenses', { preHandler: [fastify.authenticate] }, async () => {
    return Expense.find().sort({ createdAt: -1 });
  });

  fastify.post('/api/expenses', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const expense = await Expense.create({ ...request.body, submittedBy: request.user.name });
    return reply.code(201).send(expense);
  });

  fastify.patch('/api/expenses/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { status } = request.body || {};
    const expense = await Expense.findByIdAndUpdate(request.params.id, { status }, { new: true });
    if (!expense) return reply.code(404).send({ error: 'Expense not found' });
    return expense;
  });
}
