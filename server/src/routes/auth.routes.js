import bcrypt from 'bcryptjs';
import User from '../models/User.js';

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

    const token = fastify.jwt.sign(
      { id: user._id.toString(), role: user.role, name: user.name },
      { expiresIn: '12h' }
    );

    return { token, user: { id: user._id, name: user.name, role: user.role, username: user.username } };
  });

  fastify.get('/api/auth/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = await User.findById(request.user.id).select('-passwordHash');
    return { user };
  });
}
