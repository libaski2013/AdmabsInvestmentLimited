import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { connectDB } from './config/db.js';
import authPlugin from './plugins/auth.js';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/users.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import branchRoutes from './routes/branches.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import customerRoutes from './routes/customers.routes.js';
import supplierRoutes from './routes/suppliers.routes.js';
import procurementRoutes from './routes/procurement.routes.js';
import posRoutes from './routes/pos.routes.js';
import expenseRoutes from './routes/expenses.routes.js';
import approvalRoutes from './routes/approvals.routes.js';

const fastify = Fastify({ logger: true });

await connectDB(fastify.log);

await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
});
await fastify.register(authPlugin);

await fastify.register(authRoutes);
await fastify.register(userRoutes);
await fastify.register(dashboardRoutes);
await fastify.register(branchRoutes);
await fastify.register(inventoryRoutes);
await fastify.register(customerRoutes);
await fastify.register(supplierRoutes);
await fastify.register(procurementRoutes);
await fastify.register(posRoutes);
await fastify.register(expenseRoutes);
await fastify.register(approvalRoutes);

fastify.get('/api/health', async () => ({ ok: true }));

fastify.get('/', async () => ({
  service: 'ADMABS backend API',
  status: 'running',
  app: 'https://admabs-web-production.up.railway.app',
  health: '/api/health',
}));

const port = Number(process.env.PORT) || 4000;
fastify
  .listen({ port, host: '0.0.0.0' })
  .then(() => fastify.log.info(`ADMABS backend listening on port ${port}`))
  .catch((err) => {
    fastify.log.error(err);
    process.exit(1);
  });
