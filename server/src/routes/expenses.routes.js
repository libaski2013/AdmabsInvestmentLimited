import Expense from '../models/Expense.js';

export default async function expenseRoutes(fastify) {
  fastify.get('/api/expenses', { preHandler: [fastify.authenticate] }, async (request) => {
    return Expense.find(fastify.scopeFilter(request, 'branchRef', 'outlet')).sort({ createdAt: -1 });
  });

  fastify.post('/api/expenses', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const isCompanyWide = ['super_admin', 'ceo', 'gm'].includes(request.user.role);
    const branchRef = isCompanyWide ? (request.body?.branchRef || request.user.branchIds?.[0]) : request.user.branchIds?.[0];
    const outlet = isCompanyWide ? (request.body?.outlet || request.user.outletIds?.[0]) : request.user.outletIds?.[0];
    if (!isCompanyWide && (!branchRef || !outlet)) return reply.code(400).send({ error: 'A branch and outlet assignment are required' });
    const expense = await Expense.create({ ...request.body, branchRef: branchRef || undefined, outlet: outlet || undefined, submittedBy: request.user.name });
    return reply.code(201).send(expense);
  });

  fastify.patch('/api/expenses/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { status } = request.body || {};
    const expense = await Expense.findOneAndUpdate(
      { _id: request.params.id, ...fastify.scopeFilter(request, 'branchRef', 'outlet') },
      { status },
      { new: true }
    );
    if (!expense) return reply.code(404).send({ error: 'Expense not found' });
    return expense;
  });
}
