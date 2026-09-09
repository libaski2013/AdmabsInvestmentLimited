import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import '../models/Outlet.js';
import AppSession from '../models/AppSession.js';
import { randomUUID } from 'node:crypto';

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
    const sessionId = randomUUID();
    const now = new Date();
    const token = fastify.jwt.sign(
      { id: user._id.toString(), role: user.role, name: user.name, branchIds, outletIds, permissions: user.permissions || [], sessionId },
      { expiresIn: '12h' }
    );
    await AppSession.create({ sessionId, user: user._id, branchIds, outletIds, loggedInAt: now, lastSeenAt: now, expiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000), ipAddress: request.ip, userAgent: String(request.headers['user-agent'] || '').slice(0, 500) });
    user.lastLoginAt = now;
    await user.save();
    await user.populate([{ path: 'branches', select: 'name code divisions' }, { path: 'outlets', select: 'name code division branch runs24Hours' }, { path: 'branch', select: 'name code divisions' }]);
    return { token, serverTime: now.toISOString(), timeZone: 'Africa/Accra', user: { id: user._id, name: user.name, role: user.role, username: user.username, avatarUrl: user.avatarUrl, branch: user.branch, branches: user.branches, outlets: user.outlets, permissions: user.permissions || [] } };
  });

  fastify.get('/api/auth/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = await User.findById(request.user.id).select('-passwordHash').populate([{ path: 'branches', select: 'name code divisions' }, { path: 'outlets', select: 'name code division branch runs24Hours' }, { path: 'branch', select: 'name code divisions' }]);
    return { user };
  });
}
