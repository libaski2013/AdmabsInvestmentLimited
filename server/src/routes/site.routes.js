import SiteContent from '../models/SiteContent.js';

export default async function siteRoutes(fastify) {
  fastify.get('/api/site/content', async () => {
    return SiteContent.findOneAndUpdate({ key: 'main' }, { $setOnInsert: { key: 'main' } }, { new: true, upsert: true, setDefaultsOnInsert: true }).lean();
  });

  fastify.patch('/api/site/content', {
    preHandler: [fastify.authenticate, fastify.requirePermission('website.manage')],
  }, async request => {
    const allowed = ['logoUrl', 'heroImageUrl', 'companyName', 'announcement', 'heroEyebrow', 'heroTitle', 'heroText', 'aboutTitle', 'aboutText', 'phone', 'email', 'address'];
    const updates = Object.fromEntries(allowed.filter(key => key in (request.body || {})).map(key => [key, request.body[key]]));
    updates.updatedBy = request.user.id;
    return SiteContent.findOneAndUpdate({ key: 'main' }, updates, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
  });
}
