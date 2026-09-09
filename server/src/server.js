import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';
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
import payrollRoutes from './routes/payroll.routes.js';
import smsRoutes from './routes/sms.routes.js';
import toolsRoutes from './routes/tools.routes.js';
import performanceRoutes from './routes/performance.routes.js';
import workforceRoutes from './routes/workforce.routes.js';
import taxRoutes from './routes/tax.routes.js';
import MigrationRun from './models/MigrationRun.js';
import prepareLiveSystem from './utils/prepare-live-system.js';

const fastify = Fastify({ logger: true, bodyLimit: 25 * 1024 * 1024 });

await connectDB(fastify.log);
await prepareLiveSystem(fastify.log);

const configuredOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(value => value.trim()).filter(Boolean)
  : [];
const nativeOrigins = new Set(['capacitor://localhost', 'https://localhost', 'http://localhost']);
await fastify.register(cors, {
  origin(origin, callback) {
    const localDevelopment = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
    const allowed = !origin || !configuredOrigins.length || configuredOrigins.includes(origin) || nativeOrigins.has(origin) || localDevelopment;
    callback(null, allowed);
  },
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
await fastify.register(payrollRoutes);
await fastify.register(smsRoutes);
await fastify.register(toolsRoutes);
await fastify.register(performanceRoutes);
await fastify.register(workforceRoutes);
await fastify.register(taxRoutes);

fastify.get('/api/health', async () => {
  const migration = await MigrationRun.findOne({ key: 'legacy-transactions-2026-09-09-v1' }).select('status error').lean();
  const livePreparation = await MigrationRun.findOne({ key: 'prepare-live-system-2026-09-09-v1' }).select('status error summary').lean();
  return {
    ok: true,
    release: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    legacyTransactions: migration?.status || 'pending',
    livePreparation: livePreparation?.status || 'pending',
    ...(livePreparation?.summary ? { liveLocations: livePreparation.summary } : {}),
    ...(migration?.status === 'failed' ? { migrationError: String(migration.error || 'Unknown migration error').slice(0, 300) } : {}),
    ...(livePreparation?.status === 'failed' ? { livePreparationError: String(livePreparation.error || 'Unknown live preparation error').slice(0, 300) } : {}),
  };
});
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
  .then(() => {
    fastify.log.info(`ADMABS backend listening on port ${port}`);
    if (process.env.RUN_LEGACY_MIGRATION !== 'false') {
      const migration = spawn(process.execPath, [path.resolve(currentDir, 'utils/migrate-transactions.js'), '--apply'], { stdio: 'inherit' });
      migration.on('exit', code => code === 0 ? fastify.log.info('Legacy transaction migration completed') : fastify.log.error(`Legacy transaction migration exited with code ${code}`));
    }
  })
  .catch((err) => {
    fastify.log.error(err);
    process.exit(1);
  });
