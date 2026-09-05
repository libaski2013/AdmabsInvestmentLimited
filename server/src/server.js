import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
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
import accountingRoutes from './routes/accounting.routes.js';
import fuelRoutes from './routes/fuel.routes.js';
import siteRoutes from './routes/site.routes.js';
import reconciliationRoutes from './routes/reconciliation.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import demoRoutes from './routes/demo.routes.js';
import payrollRoutes from './routes/payroll.routes.js';
import smsRoutes from './routes/sms.routes.js';
import toolsRoutes from './routes/tools.routes.js';

const fastify = Fastify({ logger: true, bodyLimit: 25 * 1024 * 1024 });

await connectDB(fastify.log);

await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(value => value.trim()) : true,
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
await fastify.register(accountingRoutes);
await fastify.register(fuelRoutes);
await fastify.register(siteRoutes);
await fastify.register(reconciliationRoutes);
await fastify.register(analyticsRoutes);
await fastify.register(demoRoutes);
await fastify.register(payrollRoutes);
await fastify.register(smsRoutes);
await fastify.register(toolsRoutes);

fastify.get('/api/health', async () => ({ ok: true }));
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(currentDir, '../../dist');
await fastify.register(fastifyStatic, { root: webRoot, wildcard: false });
fastify.setNotFoundHandler((request, reply) => {
  if (request.url.startsWith('/api/')) return reply.code(404).send({ error: 'API route not found' });
  return reply.sendFile('index.html');
});

const port = Number(process.env.PORT) || 4000;
fastify
  .listen({ port, host: '0.0.0.0' })
  .then(() => fastify.log.info(`ADMABS backend listening on port ${port}`))
  .catch((err) => {
    fastify.log.error(err);
    process.exit(1);
  });
