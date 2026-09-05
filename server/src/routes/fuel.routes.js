import FuelTank from '../models/FuelTank.js';
import FuelPump from '../models/FuelPump.js';
import FuelShift from '../models/FuelShift.js';
import FuelDip from '../models/FuelDip.js';
import FuelDelivery from '../models/FuelDelivery.js';
import JournalEntry from '../models/JournalEntry.js';
import '../models/Branch.js';
import Outlet from '../models/Outlet.js';
import '../models/User.js';

const managerRoles = ['super_admin', 'ceo', 'gm', 'branch', 'sub_manager'];
const makeNumber = prefix => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
const round = value => Math.round(Number(value || 0) * 100) / 100;

function requestedScope(request, body = {}) {
  const global = ['super_admin', 'ceo', 'gm'].includes(request.user.role);
  const branch = body.branch || request.user.branchIds?.[0];
  const outlet = body.outlet || request.user.outletIds?.[0] || undefined;
  if (!branch) throw new Error('Select a branch before saving this record');
  if (!global && !request.user.branchIds?.includes(String(branch))) throw new Error('Branch is outside your assignment');
  if (!global && outlet && request.user.outletIds?.length && !request.user.outletIds.includes(String(outlet))) throw new Error('Outlet is outside your assignment');
  return { branch, outlet };
}

export default async function fuelRoutes(fastify) {
  const auth = { preHandler: [fastify.authenticate] };
  const manage = { preHandler: [fastify.authenticate, fastify.requireRole(...managerRoles)] };

  fastify.get('/api/fuel/overview', auth, async request => {
    const scope = fastify.scopeFilter(request);
    const [tanks, pumps, shifts, dips, deliveries] = await Promise.all([
      FuelTank.find(scope).sort({ code: 1 }).populate('branch outlet').lean(),
      FuelPump.find(scope).sort({ code: 1 }).populate('tank', 'code name').lean(),
      FuelShift.find(scope).sort({ openedAt: -1 }).limit(100).populate('pump', 'code name').populate('attendant', 'name').lean(),
      FuelDip.find(scope).sort({ measuredAt: -1 }).limit(50).populate('tank', 'code name product').populate('recordedBy', 'name').lean(),
      FuelDelivery.find(scope).sort({ receivedAt: -1 }).limit(50).populate('tank', 'code name product').populate('recordedBy', 'name').lean(),
    ]);
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const today = shifts.filter(s => new Date(s.openedAt) >= since && ['submitted', 'approved'].includes(s.status));
    return {
      tanks, pumps, shifts, dips, deliveries,
      metrics: {
        litresOnHand: round(tanks.reduce((sum, t) => sum + t.currentLitres, 0)),
        litresSoldToday: round(today.reduce((sum, s) => sum + s.litresSold, 0)),
        expectedRevenueToday: round(today.reduce((sum, s) => sum + s.expectedAmount, 0)),
        collectionVarianceToday: round(today.reduce((sum, s) => sum + s.cashVariance, 0)),
        openShifts: shifts.filter(s => s.status === 'open').length,
        lowTanks: tanks.filter(t => t.currentLitres <= t.reorderLevelLitres).length,
      },
    };
  });

  fastify.post('/api/fuel/tanks', manage, async (request, reply) => {
    try {
      const scope = requestedScope(request, request.body);
      const tank = await FuelTank.create({ ...request.body, ...scope });
      return reply.code(201).send(tank);
    } catch (error) { return reply.code(400).send({ error: error.message }); }
  });

  fastify.post('/api/fuel/pumps', manage, async (request, reply) => {
    try {
      const scope = requestedScope(request, request.body);
      const tank = await FuelTank.findOne({ _id: request.body.tank, ...fastify.scopeFilter(request) });
      if (!tank) return reply.code(404).send({ error: 'Tank not found in your assignment' });
      const pump = await FuelPump.create({ ...request.body, ...scope, product: tank.product });
      return reply.code(201).send(pump);
    } catch (error) { return reply.code(400).send({ error: error.message }); }
  });

  fastify.post('/api/fuel/shifts/open', auth, async (request, reply) => {
    const pump = await FuelPump.findOne({ _id: request.body?.pump, ...fastify.scopeFilter(request) });
    if (!pump || pump.status !== 'active') return reply.code(404).send({ error: 'Active pump not found in your assignment' });
    const workShift = new Date().getHours() >= 18 || new Date().getHours() < 6 ? 'night' : 'day';
    const outlet = pump.outlet ? await Outlet.findById(pump.outlet).select('runs24Hours').lean() : null;
    if (workShift === 'night' && !outlet?.runs24Hours) return reply.code(409).send({ error: 'This filling-station outlet is not configured for 24-hour operation' });
    const nozzle = pump.nozzles.find(n => n.code === String(request.body?.nozzleCode || '').toUpperCase() && n.active);
    if (!nozzle) return reply.code(400).send({ error: 'Select an active nozzle' });
    const existing = await FuelShift.findOne({ pump: pump._id, nozzleCode: nozzle.code, status: 'open' });
    if (existing) return reply.code(409).send({ error: 'This nozzle already has an open shift' });
    const openingMeter = Number(request.body?.openingMeter ?? nozzle.meterReading);
    if (openingMeter < nozzle.meterReading) return reply.code(400).send({ error: 'Opening meter cannot be below the saved meter reading' });
    const shift = await FuelShift.create({
      number: makeNumber('FS'), branch: pump.branch, outlet: pump.outlet, attendant: request.user.id,
      pump: pump._id, nozzleCode: nozzle.code, product: pump.product, openingMeter,
      pricePerLitre: Number(request.body?.pricePerLitre ?? pump.pricePerLitre), workShift, notes: request.body?.notes,
    });
    return reply.code(201).send(shift);
  });

  fastify.patch('/api/fuel/shifts/:id/close', auth, async (request, reply) => {
    const shift = await FuelShift.findOne({ _id: request.params.id, status: 'open', ...fastify.scopeFilter(request) });
    if (!shift) return reply.code(404).send({ error: 'Open shift not found' });
    if (String(shift.attendant) !== request.user.id && !managerRoles.includes(request.user.role)) return reply.code(403).send({ error: 'Only the attendant or manager can close this shift' });
    const closingMeter = Number(request.body?.closingMeter);
    const testLitres = Number(request.body?.testLitres || 0);
    if (!Number.isFinite(closingMeter) || closingMeter < shift.openingMeter) return reply.code(400).send({ error: 'Closing meter must be at or above the opening meter' });
    const litresSold = round(closingMeter - shift.openingMeter - testLitres);
    if (litresSold < 0) return reply.code(400).send({ error: 'Test litres cannot exceed metered litres' });
    const payments = ['cash', 'card', 'mobileMoney', 'credit'].reduce((out, key) => ({ ...out, [key]: round(request.body?.payments?.[key]) }), {});
    const expectedAmount = round(litresSold * shift.pricePerLitre);
    const actualCollected = round(Object.values(payments).reduce((sum, value) => sum + value, 0));
    Object.assign(shift, { closingMeter, testLitres, litresSold, expectedAmount, payments, actualCollected,
      cashVariance: round(actualCollected - expectedAmount), varianceReason: request.body?.varianceReason,
      closedAt: new Date(), status: 'submitted', notes: request.body?.notes || shift.notes });
    await shift.save();
    await FuelPump.updateOne({ _id: shift.pump, 'nozzles.code': shift.nozzleCode }, { $set: { 'nozzles.$.meterReading': closingMeter } });
    return shift;
  });

  fastify.patch('/api/fuel/shifts/:id/review', manage, async (request, reply) => {
    const status = request.body?.status;
    if (!['approved', 'queried'].includes(status)) return reply.code(400).send({ error: 'Status must be approved or queried' });
    const shift = await FuelShift.findOne({ _id: request.params.id, status: { $in: ['submitted', 'queried'] }, ...fastify.scopeFilter(request) });
    if (!shift) return reply.code(404).send({ error: 'Submitted shift not found' });
    if (status === 'approved' && !shift.journal) {
      const variance = round(shift.cashVariance);
      const lines = [{ accountCode: '1100', accountName: 'Cash and payment clearing', debit: shift.actualCollected, credit: 0 }];
      if (variance < 0) lines.push({ accountCode: '6190', accountName: 'Fuel collection shortages', debit: Math.abs(variance), credit: 0 });
      lines.push({ accountCode: '4100', accountName: 'Fuel sales', debit: 0, credit: shift.expectedAmount });
      if (variance > 0) lines.push({ accountCode: '4190', accountName: 'Fuel collection overages', debit: 0, credit: variance });
      const journal = await JournalEntry.create({ number: makeNumber('JE-FUEL'), description: `Fuel shift ${shift.number}`,
        source: 'sale', sourceId: shift._id, branch: shift.branch, outlet: shift.outlet, lines, createdBy: request.user.id });
      shift.journal = journal._id;
    }
    shift.status = status; shift.approvedBy = request.user.id; shift.approvedAt = status === 'approved' ? new Date() : undefined;
    shift.varianceReason = request.body?.reason || shift.varianceReason;
    await shift.save();
    return shift;
  });

  fastify.post('/api/fuel/dips', auth, async (request, reply) => {
    const tank = await FuelTank.findOne({ _id: request.body?.tank, ...fastify.scopeFilter(request) });
    if (!tank) return reply.code(404).send({ error: 'Tank not found in your assignment' });
    const measuredAt = request.body?.measuredAt ? new Date(request.body.measuredAt) : new Date();
    const from = tank.lastDipAt || tank.createdAt;
    const [deliveryAgg, salesAgg] = await Promise.all([
      FuelDelivery.aggregate([{ $match: { tank: tank._id, receivedAt: { $gt: from, $lte: measuredAt }, status: { $ne: 'rejected' } } }, { $group: { _id: null, litres: { $sum: '$receivedLitres' } } }]),
      FuelShift.aggregate([{ $match: { pump: { $in: await FuelPump.find({ tank: tank._id }).distinct('_id') }, closedAt: { $gt: from, $lte: measuredAt }, status: { $in: ['submitted', 'approved'] } } }, { $group: { _id: null, litres: { $sum: '$litresSold' } } }]),
    ]);
    const deliveriesLitres = round(deliveryAgg[0]?.litres);
    const pumpSalesLitres = round(salesAgg[0]?.litres);
    const openingLitres = round(tank.currentLitres);
    const theoreticalClosingLitres = round(openingLitres + deliveriesLitres - pumpSalesLitres);
    const closingDipLitres = Number(request.body?.closingDipLitres);
    if (!Number.isFinite(closingDipLitres) || closingDipLitres < 0 || closingDipLitres > tank.capacityLitres) return reply.code(400).send({ error: 'Closing dip must be within tank capacity' });
    const varianceLitres = round(closingDipLitres - theoreticalClosingLitres);
    const dip = await FuelDip.create({ number: makeNumber('DIP'), branch: tank.branch, outlet: tank.outlet, tank: tank._id,
      measuredAt, openingLitres, deliveriesLitres, pumpSalesLitres, theoreticalClosingLitres, closingDipLitres,
      varianceLitres, variancePercent: theoreticalClosingLitres ? round(varianceLitres / theoreticalClosingLitres * 100) : 0,
      waterLevelMm: request.body?.waterLevelMm, temperatureC: request.body?.temperatureC,
      notes: request.body?.notes, recordedBy: request.user.id });
    tank.currentLitres = closingDipLitres; tank.lastDipAt = measuredAt; await tank.save();
    return reply.code(201).send(dip);
  });

  fastify.patch('/api/fuel/dips/:id/review', manage, async (request, reply) => {
    const status = request.body?.status;
    if (!['approved', 'queried'].includes(status)) return reply.code(400).send({ error: 'Status must be approved or queried' });
    const dip = await FuelDip.findOneAndUpdate({ _id: request.params.id, ...fastify.scopeFilter(request) },
      { status, approvedBy: request.user.id, approvedAt: status === 'approved' ? new Date() : undefined, notes: request.body?.notes }, { new: true });
    if (!dip) return reply.code(404).send({ error: 'Dip not found' });
    return dip;
  });

  fastify.post('/api/fuel/deliveries', auth, async (request, reply) => {
    const tank = await FuelTank.findOne({ _id: request.body?.tank, ...fastify.scopeFilter(request) });
    if (!tank) return reply.code(404).send({ error: 'Tank not found in your assignment' });
    const receivedLitres = Number(request.body?.receivedLitres);
    const dispatchedLitres = Number(request.body?.dispatchedLitres);
    if (!Number.isFinite(receivedLitres) || !Number.isFinite(dispatchedLitres)) return reply.code(400).send({ error: 'Dispatched and received litres are required' });
    const delivery = await FuelDelivery.create({ ...request.body, number: makeNumber('FD'), branch: tank.branch, outlet: tank.outlet,
      tank: tank._id, product: tank.product, receivedLitres, dispatchedLitres,
      varianceLitres: round(receivedLitres - dispatchedLitres), recordedBy: request.user.id });
    return reply.code(201).send(delivery);
  });
}
