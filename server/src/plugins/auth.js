import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';

export default fp(async (fastify) => {
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  });

  fastify.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.decorate('requireRole', (...roles) => {
    return async (request, reply) => {
      if (!request.user || !roles.includes(request.user.role)) {
        reply.code(403).send({ error: 'Forbidden' });
      }
    };
  });
});
