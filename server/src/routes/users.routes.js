import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import '../models/Outlet.js';

export const PERMISSIONS = [
  'pos.sale.create', 'inventory.create', 'inventory.update', 'customers.manage',
  'procurement.manage', 'expenses.manage', 'accounting.journal.create', 'reports.view',
  'reconciliation.create', 'reconciliation.review', 'website.manage', 'staff.view',
  'staff.manage', 'branches.manage', 'system.settings.manage',
];

export default async function userRoutes(fastify) {
  fastify.get(
    '/api/users',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const adminExists = await User.exists({ role: 'super_admin', active: true });
      const allowed = request.user.role === 'super_admin' || request.user.role === 'gm' || request.user.permissions?.includes('staff.view') || (request.user.role === 'ceo' && !adminExists);
      if (!allowed) return reply.code(403).send({ error: 'Staff Directory access must be granted by the Super Admin' });
      return User.find().select('-passwordHash').populate('branch', 'name').populate('branches', 'name').populate('outlets', 'name division').sort({ name: 1 });
    }
  );

  fastify.get('/api/permissions', { preHandler: [fastify.authenticate, fastify.requireRole('super_admin')] }, async () => PERMISSIONS);

  fastify.post('/api/users', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { password, ...body } = request.body || {};
    if (!password || password.length < 8) return reply.code(400).send({ error: 'Temporary password must contain at least 8 characters' });
    const adminExists = await User.exists({ role: 'super_admin', active: true });
    const bootstrap = request.user.role === 'ceo' && !adminExists && body.role === 'super_admin';
    if (request.user.role !== 'super_admin' && !bootstrap) return reply.code(403).send({ error: 'Only the Super Admin can create staff accounts' });
    if (body.role === 'super_admin' && adminExists) return reply.code(400).send({ error: 'A Super Admin already exists' });
    try {
      const user = await User.create({ ...body, username: String(body.username || '').toLowerCase().trim(), passwordHash: await bcrypt.hash(password, 10) });
      return reply.code(201).send({ ...user.toObject(), passwordHash: undefined });
    } catch (error) { return reply.code(400).send({ error: error.code === 11000 ? 'Username already exists' : error.message }); }
  });

  fastify.patch('/api/users/:id', { preHandler: [fastify.authenticate, fastify.requireRole('super_admin')] }, async (request, reply) => {
    const { password, ...updates } = request.body || {};
    const target = await User.findById(request.params.id);
    if (!target) return reply.code(404).send({ error: 'Staff account not found' });
    if (target.role === 'super_admin' && String(target._id) !== request.user.id) return reply.code(403).send({ error: 'Another Super Admin account cannot be changed' });
    if (target.role === 'super_admin' && updates.role && updates.role !== 'super_admin') return reply.code(400).send({ error: 'The active Super Admin cannot remove their own system-owner role' });
    if (target.role !== 'super_admin' && updates.role === 'super_admin') return reply.code(400).send({ error: 'The Super Admin role cannot be assigned through staff editing' });
    if (password) {
      if (password.length < 8) return reply.code(400).send({ error: 'Password must contain at least 8 characters' });
      updates.passwordHash = await bcrypt.hash(password, 10);
    }
    Object.assign(target, updates); await target.save();
    return User.findById(target._id).select('-passwordHash').populate('branch branches outlets');
  });
}
