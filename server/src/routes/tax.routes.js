import TaxFiling from '../models/TaxFiling.js';

const canManage = request => ['super_admin', 'ceo'].includes(request.user.role) || request.user.permissions?.includes('tax.manage');
const normalized = (body, userId) => {
  const taxableIncome = Math.max(0, Number(body.taxableIncome || 0));
  const taxRate = Math.max(0, Math.min(1, Number(body.taxRate ?? 0.25)));
  return { ...body, year: Number(body.year), taxableIncome, taxRate, taxDue: Math.round(taxableIncome * taxRate * 100) / 100, amountPaid: Math.max(0, Number(body.amountPaid || 0)), updatedBy: userId, filedAt: body.status === 'filed' || body.status === 'paid' ? (body.filedAt || new Date()) : undefined };
};

export default async function taxRoutes(fastify) {
  fastify.get('/api/tax-filings', { preHandler: [fastify.authenticate] }, async () => TaxFiling.find().populate('updatedBy', 'name').sort({ year: -1 }).lean());
  fastify.post('/api/tax-filings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (!canManage(request)) return reply.code(403).send({ error: 'Annual tax filing access has not been granted' });
    try { return reply.code(201).send(await TaxFiling.create(normalized(request.body || {}, request.user.id))); }
    catch (error) { return reply.code(400).send({ error: error.code === 11000 ? 'A tax record already exists for this year' : error.message }); }
  });
  fastify.patch('/api/tax-filings/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (!canManage(request)) return reply.code(403).send({ error: 'Annual tax filing access has not been granted' });
    const filing = await TaxFiling.findByIdAndUpdate(request.params.id, normalized(request.body || {}, request.user.id), { new: true, runValidators: true });
    if (!filing) return reply.code(404).send({ error: 'Tax filing record not found' });
    return filing;
  });
}
