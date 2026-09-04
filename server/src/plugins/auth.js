import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';

export default fp(async (fastify) => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
  }
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET,
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

  fastify.decorate('requirePermission', (permission, ...fallbackRoles) => async (request, reply) => {
    const user = request.user;
    if (!user || (!user.permissions?.includes(permission) && !fallbackRoles.includes(user.role))) {
      return reply.code(403).send({ error: 'You do not have permission for this action' });
    }
  });

  fastify.decorate('scopeFilter', (request, branchField = 'branch', outletField = 'outlet') => {
    if (['ceo', 'gm'].includes(request.user.role)) return {};
    const filter = {};
    const branchIds = request.user.branchIds || [];
    const outletIds = request.user.outletIds || [];
    if (outletIds.length) filter[outletField] = { $in: outletIds };
    else if (branchIds.length) filter[branchField] = { $in: branchIds };
    else filter._id = null;
    return filter;
  });
});
