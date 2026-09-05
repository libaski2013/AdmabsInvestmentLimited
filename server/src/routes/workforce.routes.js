import ShiftSchedule from '../models/ShiftSchedule.js';
import WorkShift from '../models/WorkShift.js';
import AppSession from '../models/AppSession.js';
import Outlet from '../models/Outlet.js';
import Sale from '../models/Sale.js';

const managementRoles = ['super_admin', 'ceo', 'gm', 'branch', 'sub_manager'];
const number = () => `SM-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
const round = value => Math.round(Number(value || 0) * 100) / 100;

function ghanaClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Accra', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const value = type => parts.find(part => part.type === type)?.value;
  return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value('weekday')), minutes: Number(value('hour')) * 60 + Number(value('minute')) };
}

function scheduledNow(schedule, now = new Date()) {
  const { day, minutes } = ghanaClock(now);
  const start = Number(schedule.startTime.slice(0, 2)) * 60 + Number(schedule.startTime.slice(3));
  const end = Number(schedule.endTime.slice(0, 2)) * 60 + Number(schedule.endTime.slice(3));
  const overnight = end <= start;
  const priorDay = (day + 6) % 7;
  const scheduleDay = overnight && minutes < end ? priorDay : day;
  if (!(schedule.daysOfWeek?.length ? schedule.daysOfWeek : [0, 1, 2, 3, 4, 5, 6]).includes(scheduleDay)) return false;
  const adjusted = overnight && minutes < end ? minutes + 1440 : minutes;
  const adjustedEnd = overnight ? end + 1440 : end;
  return adjusted >= start - schedule.earlyStartMinutes && adjusted <= Math.min(adjustedEnd, start + schedule.lateStartMinutes);
}

async function availableSchedule(user, division, outlet) {
  const schedules = await ShiftSchedule.find({ division, outlet, active: true, $or: [{ assignedUsers: { $size: 0 } }, { assignedUsers: user.id }] }).sort({ startTime: 1 });
  return schedules.find(schedule => scheduledNow(schedule));
}

export { availableSchedule };

export default async function workforceRoutes(fastify) {
  const auth = { preHandler: [fastify.authenticate] };
  const scheduleManage = { preHandler: [fastify.authenticate, fastify.requirePermission('shifts.manage', 'super_admin')] };
  const attendanceView = { preHandler: [fastify.authenticate, fastify.requirePermission('attendance.view', 'super_admin', 'ceo')] };

  fastify.get('/api/time', async () => ({ serverTime: new Date().toISOString(), timeZone: 'Africa/Accra', source: 'ADMABS server' }));

  fastify.post('/api/sessions/heartbeat', auth, async request => {
    const now = new Date();
    if (request.user.sessionId) await AppSession.updateOne({ sessionId: request.user.sessionId, loggedOutAt: null }, { lastSeenAt: now });
    return { serverTime: now.toISOString(), timeZone: 'Africa/Accra' };
  });

  fastify.post('/api/auth/logout', auth, async (request, reply) => {
    if (request.user.sessionId) await AppSession.updateOne({ sessionId: request.user.sessionId, loggedOutAt: null }, { loggedOutAt: new Date(), lastSeenAt: new Date() });
    return reply.code(204).send();
  });

  fastify.get('/api/attendance/active', attendanceView, async () => {
    const activeAfter = new Date(Date.now() - 2 * 60 * 1000);
    const sessions = await AppSession.find({ loggedOutAt: null, lastSeenAt: { $gte: activeAfter }, expiresAt: { $gt: new Date() } })
      .populate('user', 'name username role jobTitle').populate('branchIds', 'name code').populate('outletIds', 'name code division').sort({ loggedInAt: -1 }).lean();
    return { serverTime: new Date().toISOString(), activeWindowSeconds: 120, sessions };
  });

  fastify.get('/api/attendance/history', attendanceView, async request => {
    const days = Math.min(90, Math.max(1, Number(request.query?.days || 7)));
    return AppSession.find({ loggedInAt: { $gte: new Date(Date.now() - days * 86400000) } })
      .populate('user', 'name username role jobTitle').populate('branchIds', 'name code').populate('outletIds', 'name code division').sort({ loggedInAt: -1 }).limit(1000).lean();
  });

  fastify.get('/api/shift-schedules', auth, async request => ShiftSchedule.find(fastify.scopeFilter(request)).populate('branch outlet assignedUsers', 'name code division role username').sort({ division: 1, startTime: 1 }).lean());

  fastify.post('/api/shift-schedules', scheduleManage, async (request, reply) => {
    const outlet = await Outlet.findById(request.body?.outlet).lean();
    if (!outlet || !['fuel', 'supermarket'].includes(outlet.division)) return reply.code(400).send({ error: 'Select a fuel or supermarket outlet' });
    if (request.body?.workShift === 'night' && !outlet.runs24Hours) return reply.code(409).send({ error: 'Mark this outlet as 24-hour before adding a night schedule' });
    try {
      const schedule = await ShiftSchedule.create({ ...request.body, branch: outlet.branch, division: outlet.division, daysOfWeek: request.body?.daysOfWeek?.length ? request.body.daysOfWeek : [0, 1, 2, 3, 4, 5, 6], createdBy: request.user.id });
      return reply.code(201).send(schedule);
    } catch (error) { return reply.code(400).send({ error: error.message }); }
  });

  fastify.patch('/api/shift-schedules/:id', scheduleManage, async (request, reply) => {
    const schedule = await ShiftSchedule.findById(request.params.id);
    if (!schedule) return reply.code(404).send({ error: 'Shift schedule not found' });
    Object.assign(schedule, request.body); await schedule.save(); return schedule;
  });

  fastify.get('/api/work-shifts', auth, async request => {
    const filter = fastify.scopeFilter(request);
    if (!managementRoles.includes(request.user.role)) filter.attendant = request.user.id;
    return WorkShift.find(filter).populate('schedule', 'name startTime endTime').populate('attendant', 'name username').populate('branch outlet', 'name code').sort({ startedAt: -1 }).limit(200).lean();
  });

  fastify.post('/api/work-shifts/start', auth, async (request, reply) => {
    const outletId = request.body?.outlet || request.user.outletIds?.[0];
    const outlet = await Outlet.findOne({ _id: outletId, division: 'supermarket', ...fastify.scopeFilter(request) }).lean();
    if (!outlet) return reply.code(404).send({ error: 'Assigned supermarket outlet not found' });
    const existing = await WorkShift.findOne({ attendant: request.user.id, status: 'open' });
    if (existing) return reply.code(409).send({ error: 'Close your current supermarket shift before starting another' });
    const configuredSchedules = await ShiftSchedule.countDocuments({ outlet: outlet._id, division: 'supermarket', active: true });
    const schedule = configuredSchedules ? await availableSchedule(request.user, 'supermarket', outlet._id) : null;
    if (configuredSchedules && !schedule) return reply.code(409).send({ error: 'No scheduled supermarket shift is currently open for you. Ask the Super Admin to check the schedule.' });
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Accra', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
    const workShift = schedule?.workShift || (hour >= 18 || hour < 6 ? 'night' : 'day');
    if (workShift === 'night' && !outlet.runs24Hours) return reply.code(409).send({ error: 'This supermarket outlet is not configured for 24-hour operation' });
    const shift = await WorkShift.create({ number: number(), division: 'supermarket', workShift, schedule: schedule?._id, branch: outlet.branch, outlet: outlet._id, attendant: request.user.id, openingFloat: Number(request.body?.openingFloat || 0) });
    return reply.code(201).send(shift);
  });

  fastify.patch('/api/work-shifts/:id/close', auth, async (request, reply) => {
    const shift = await WorkShift.findOne({ _id: request.params.id, status: 'open', ...fastify.scopeFilter(request) });
    if (!shift) return reply.code(404).send({ error: 'Open supermarket shift not found' });
    if (String(shift.attendant) !== request.user.id && !managementRoles.includes(request.user.role)) return reply.code(403).send({ error: 'Only the attendant or an assigned manager can close this shift' });
    const sales = await Sale.find({ cashier: shift.attendant, outlet: shift.outlet, createdAt: { $gte: shift.startedAt }, status: 'posted' }).lean();
    shift.transactionCount = sales.length; shift.expectedSales = round(sales.reduce((sum, sale) => sum + sale.total, 0));
    shift.expectedCash = round(sales.reduce((sum, sale) => sum + (sale.payments || []).filter(payment => payment.method === 'Cash').reduce((a, payment) => a + Number(payment.amount || 0), 0), 0) + shift.openingFloat);
    shift.actualCash = round(request.body?.actualCash); shift.cashVariance = round(shift.actualCash - shift.expectedCash);
    shift.notes = request.body?.notes; shift.endedAt = new Date(); shift.status = 'submitted'; await shift.save(); return shift;
  });

  fastify.patch('/api/work-shifts/:id/review', { preHandler: [fastify.authenticate, fastify.requireRole(...managementRoles)] }, async (request, reply) => {
    const status = request.body?.status;
    if (!['approved', 'queried'].includes(status)) return reply.code(400).send({ error: 'Status must be approved or queried' });
    const shift = await WorkShift.findOne({ _id: request.params.id, status: { $in: ['submitted', 'queried'] }, ...fastify.scopeFilter(request) });
    if (!shift) return reply.code(404).send({ error: 'Submitted shift not found in your assignment' });
    shift.status = status; shift.approvedBy = request.user.id; shift.approvedAt = status === 'approved' ? new Date() : undefined; await shift.save(); return shift;
  });
}
