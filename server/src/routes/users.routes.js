import User from '../models/User.js';

export default async function userRoutes(fastify) {
  fastify.get(
    '/api/users',
    { preHandler: [fastify.authenticate, fastify.requireRole('ceo', 'gm')] },
    async () => {
      return User.find().select('-passwordHash').populate('branch', 'name').sort({ name: 1 });
    }
  );
}
