import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import '../models/Outlet.js';

export default async function authRoutes(fastify) {
  fastify.post('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body || {};
    if (!username || !password) {
      return reply.code(400).send({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ username: username.toLowerCase().trim(), active: true });
    if (!user) return reply.code(401).send({ error: 'Invalid username or password' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return reply.code(401).send({ error: 'Invalid username or password' });

    const branchIds = [...new Set([user.branch, ...(user.branches || [])].filter(Boolean).map(String))];
    const outletIds = (user.outlets || []).map(String);
    const token = fastify.jwt.sign(
      { id: user._id.toString(), role: user.role, name: user.name, branchIds, outletIds, permissions: user.permissions || [] },
      { expiresIn: '12h' }
    );
    user.lastLoginAt = new Date();
    await user.save();
    await user.populate([{ path: 'branches', select: 'name code divisions' }, { path: 'outlets', select: 'name code division branch' }, { path: 'branch', select: 'name code divisions' }]);
    return { token, user: { id: user._id, name: user.name, role: user.role, username: user.username, branch: user.branch, branches: user.branches, outlets: user.outlets, permissions: user.permissions || [] } };
  });

  fastify.get('/api/auth/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = await User.findById(request.user.id).select('-passwordHash');
    return { user };
  });
}
