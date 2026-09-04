import JournalEntry from '../models/JournalEntry.js';

const nextNumber = () => `JE-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

export default async function accountingRoutes(fastify) {
  fastify.get('/api/accounting/journals', { preHandler: [fastify.authenticate] }, async request => {
    return JournalEntry.find(fastify.scopeFilter(request)).sort({ date: -1 }).limit(250).lean();
  });

  fastify.post('/api/accounting/journals', {
    preHandler: [fastify.authenticate, fastify.requirePermission('accounting.journal.create', 'ceo', 'finance', 'accountant')],
  }, async (request, reply) => {
    const { date, description, lines, branch, outlet } = request.body || {};
    if (!description || !Array.isArray(lines)) return reply.code(400).send({ error: 'Description and journal lines are required' });
    const entry = await JournalEntry.create({ number: nextNumber(), date: date || new Date(), description, lines, branch, outlet, source: 'manual', createdBy: request.user.id });
    return reply.code(201).send(entry);
  });
}
