import express from 'express';
import * as store from './store.js';
import * as r from './reports.js';
import * as nena from './nena.js';
import { demoData } from './demo.js';
import { scheduleDigests } from './digest.js';
import { bad, clean } from './validate.js';

const PORT = process.env.PORT || 4000;
const app = express();
app.use('/api/ai', express.json({ limit: '8mb' })); // receipt photos and voice recordings
app.use(express.json());

// Guests (not logged in) can only see a sample dashboard.
app.get('/api/demo/dashboard', (req, res) => res.json(r.dashboard(demoData())));

// Everything below needs a login. req.owner = the logged-in user's id; all data is scoped to it.
app.use('/api', async (req, res, next) => {
  const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
  if (!token) return next(bad('Please log in.', 401));
  req.owner = await store.verify(token);
  next(req.owner ? undefined : bad('Your session has expired. Please log in again.', 401));
});

const reports = {
  dashboard: r.dashboard,
  alerts: r.alerts,
  'tenant-balances': r.tenantRows,
};
// Who points at whom: friendlier message than the database's foreign-key error.
const referencedBy = { properties: [['tenants', 'propertyId']] };

app.get('/api/reports/:name', async (req, res) => {
  const report = reports[req.params.name];
  if (!report) throw bad('Unknown report', 404);
  res.json(report(await store.snapshot(req.owner)));
});

app.get('/api/export/:name', async (req, res) => {
  const { name } = req.params;
  const rows = reports[name] ? reports[name](await store.snapshot(req.owner)) : store.collections.includes(name) ? await store.list(req.owner, name) : null;
  if (!Array.isArray(rows)) throw bad('Nothing to export under that name', 404);
  res.attachment(`${name}-${r.today()}.csv`).send(r.toCsv(rows.map(({ ownerId, ...row }) => row)));
});

app.get('/api/tenants/:id/summary', async (req, res) => {
  const summary = r.tenantSummary(await store.snapshot(req.owner), req.params.id);
  if (!summary) throw bad('Tenant not found', 404);
  res.json(summary);
});

// Rent tracker: which months each tenant has paid, and ticking/unticking a month.
app.get('/api/rent', async (req, res) => {
  const year = Number(req.query.year) || Number(r.today().slice(0, 4));
  if (year < 2000 || year > 2100) throw bad('Year must be between 2000 and 2100');
  res.json(r.rentGrid(await store.snapshot(req.owner), year));
});

app.put('/api/rent/:tenantId/:year/:month', async (req, res) => {
  const year = Number(req.params.year), month = Number(req.params.month);
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) throw bad('Invalid month');
  if (typeof req.body?.paid !== 'boolean') throw bad('paid must be true or false');
  const tenant = await store.get(req.owner, 'tenants', req.params.tenantId);
  if (!tenant) throw bad('Tenant not found', 404);
  await store.setPaid(req.owner, tenant.id, year, month, req.body.paid, Number(tenant.monthlyRent) || 0);
  res.json({ tenantId: tenant.id, year, month, paid: req.body.paid });
});

// Catch a tenant up: mark several months paid (or unpaid, for Undo) in one request.
app.put('/api/rent/:tenantId', async (req, res) => {
  const { months, paid } = req.body ?? {};
  if (typeof paid !== 'boolean') throw bad('paid must be true or false');
  if (!Array.isArray(months) || !months.length || months.length > 24) throw bad('Give between 1 and 24 months');
  if (!months.every((m) => Number.isInteger(m?.year) && m.year >= 2000 && m.year <= 2100 && Number.isInteger(m.month) && m.month >= 1 && m.month <= 12)) throw bad('Invalid month');
  const tenant = await store.get(req.owner, 'tenants', req.params.tenantId);
  if (!tenant) throw bad('Tenant not found', 404);
  await store.setPaidMany(req.owner, tenant.id, months, paid, Number(tenant.monthlyRent) || 0);
  res.json({ tenantId: tenant.id, months, paid });
});

// Nena. ponytail: one global rate limit per server process; per-owner limits if one account starts hogging it.
const aiHits = [];
app.use('/api/ai', (req, res, next) => {
  const now = Date.now();
  while (aiHits.length && now - aiHits[0] > 60_000) aiHits.shift();
  if (aiHits.length >= 40) return next(bad('Nena is getting too many requests. Wait a minute and try again.', 429));
  aiHits.push(now);
  next();
});
app.post('/api/ai/chat', async (req, res) => res.json(await nena.chat(req.owner, req.body?.messages)));
app.post('/api/ai/execute', async (req, res) => res.json(await nena.execute(req.owner, req.body?.tool, req.body?.args)));
app.get('/api/ai/insight', async (req, res) => res.json(await nena.insight(req.owner)));
app.post('/api/ai/transcribe', async (req, res) => res.json(await nena.transcribe(req.body?.audio)));

// Generic CRUD for properties and tenants
app.param('collection', (req, res, next, c) => next(store.collections.includes(c) ? undefined : bad(`Unknown resource "${c}"`, 404)));

// A tenant can only be assigned to one of the owner's own properties.
async function checkRow(owner, c, row) {
  if (c === 'tenants' && !(await store.get(owner, 'properties', row.propertyId))) throw bad('Choose one of your properties.');
  return row;
}

app.get('/api/:collection', async (req, res) => res.json(await store.list(req.owner, req.params.collection)));
app.get('/api/:collection/:id', async (req, res) => {
  const row = await store.get(req.owner, req.params.collection, req.params.id);
  if (!row) throw bad('Not found', 404);
  res.json(row);
});
app.post('/api/:collection', async (req, res) => {
  const c = req.params.collection;
  res.status(201).json(await store.create(req.owner, c, await checkRow(req.owner, c, clean(c, req.body))));
});
app.put('/api/:collection/:id', async (req, res) => {
  const c = req.params.collection;
  const row = await store.update(req.owner, c, req.params.id, await checkRow(req.owner, c, clean(c, req.body)));
  if (!row) throw bad('Not found', 404);
  res.json(row);
});
app.delete('/api/:collection/:id', async (req, res) => {
  const { collection: c, id } = req.params;
  for (const [child, key] of referencedBy[c] ?? []) {
    const n = (await store.list(req.owner, child)).filter((row) => row[key] === id).length;
    if (n) throw bad(`Can't delete: ${n} ${child} are still assigned to it. Move or remove them first.`, 409);
  }
  if (!(await store.remove(req.owner, c, id))) throw bad('Not found', 404);
  res.status(204).end();
});

app.use((err, req, res, next) => {
  if (!err.expose) console.error(err);
  res.status(err.expose ? err.status : 500).json({ error: err.expose ? err.message : 'Something went wrong on the server. Try again.' });
});

app.listen(PORT, () => console.log(`RentIO API on http://localhost:${PORT}`));
scheduleDigests();
