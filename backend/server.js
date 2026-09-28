import express from 'express';
import { GoogleGenAI } from '@google/genai';
import * as store from './store.js';
import * as r from './reports.js';

const PORT = process.env.PORT || 4000;
const app = express();
app.use(express.json());

const snapshot = () => Object.fromEntries(store.collections.map((c) => [c, store.list(c)]));
const bad = (message, status = 400) => Object.assign(new Error(message), { status });

const reports = {
  dashboard: r.dashboard,
  'rent-roll': r.rentRoll,
  'lease-expiry': r.leaseExpiry,
  alerts: r.alerts,
  invoices: r.invoiceStatus,
  balances: r.balances,
  deposits: r.depositLedger,
  finance: r.finance,
  'profit-loss': (db) => r.finance(db).monthly,
};

const required = {
  properties: ['name', 'type'],
  units: ['propertyId', 'name'],
  tenants: ['name', 'propertyId'],
  leases: ['tenantId', 'unitId', 'startDate', 'endDate', 'rent'],
  payments: ['leaseId', 'date', 'amount', 'type'],
  invoices: ['leaseId', 'dueDate', 'amount'],
  expenses: ['date', 'category', 'amount'],
  violations: ['leaseId', 'date', 'description'],
};
const numeric = new Set(['rent', 'amount', 'deposit', 'escalationPct', 'escalationEveryMonths', 'noticeDays', 'dueDay', 'bedrooms', 'marketRent', 'capacity']);
// Who points at whom: blocks deletes that would orphan records.
const referencedBy = {
  properties: [['units', 'propertyId'], ['tenants', 'propertyId'], ['expenses', 'propertyId']],
  units: [['leases', 'unitId']],
  tenants: [['leases', 'tenantId']],
  leases: [['payments', 'leaseId'], ['invoices', 'leaseId'], ['violations', 'leaseId']],
};

function clean(collection, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw bad('Request body must be a JSON object');
  const row = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === 'id') continue;
    row[k] = numeric.has(k) && v !== '' && v != null ? Number(v) : v;
    if (Number.isNaN(row[k])) throw bad(`${k} must be a number`);
  }
  for (const k of required[collection]) if (row[k] == null || row[k] === '') throw bad(`${k} is required`);
  if (collection === 'properties' && ['Boarding house', 'Dormitory'].includes(row.type) && !(Number.isInteger(row.capacity) && row.capacity > 0)) {
    throw bad('Boarding houses and dormitories need a total capacity of at least 1 person');
  }
  if (row.startDate && row.endDate && row.endDate < row.startDate) throw bad('End date must be on or after the start date');
  return row;
}

const generateFor = (month) => r.generateInvoices(snapshot(), month).map((inv) => store.create('invoices', inv));

app.get('/api/reports/:name', (req, res) => {
  const report = reports[req.params.name];
  if (!report) throw bad('Unknown report', 404);
  res.json(report(snapshot()));
});

app.get('/api/export/:name', (req, res) => {
  const { name } = req.params;
  const rows = reports[name] ? reports[name](snapshot()) : store.collections.includes(name) ? store.list(name) : null;
  if (!Array.isArray(rows)) throw bad('Nothing to export under that name', 404);
  res.attachment(`${name}-${r.today()}.csv`).send(r.toCsv(rows));
});

app.get('/api/tenants/:id/summary', (req, res) => {
  const summary = r.tenantSummary(snapshot(), req.params.id);
  if (!summary) throw bad('Tenant not found', 404);
  res.json(summary);
});

app.get('/api/leases/:id/escalation', (req, res) => {
  const schedule = r.escalation(snapshot(), req.params.id);
  if (!schedule) throw bad('Lease not found', 404);
  res.json(schedule);
});

app.post('/api/invoices/generate', (req, res) => {
  const month = req.body?.month ?? r.today().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw bad('Month must look like 2026-09');
  res.status(201).json(generateFor(month));
});

// AI assistant: answers questions from a live summary of the data.
// ponytail: whole summary goes in every prompt; switch to Gemini function calling if portfolios grow to thousands of units.
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

app.post('/api/ai/chat', async (req, res) => {
  if (!ai) throw bad('Nena, the assistant, is not set up. Add GEMINI_API_KEY to backend/.env and restart the server.', 503);
  const messages = req.body?.messages;
  if (!Array.isArray(messages) || !messages.length || messages.at(-1)?.role !== 'user') throw bad('Send at least one user message');
  const db = snapshot();
  const context = {
    today: r.today(),
    dashboard: r.dashboard(db),
    properties: db.properties,
    rentRoll: r.rentRoll(db),
    alerts: r.alerts(db),
    leaseExpiry: r.leaseExpiry(db),
    balances: r.balances(db),
    deposits: r.depositLedger(db),
    finance: r.finance(db),
  };
  try {
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: messages.slice(-20).map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: String(m.text ?? '').slice(0, 4000) }] })),
      config: {
        systemInstruction: [
          'You are Nena, the RentIO assistant, helping a property manager in the Philippines. Introduce yourself as Nena when greeting or when asked who you are. Be warm, friendly and concise.',
          'Answer only from the data below. If the data does not contain the answer, say so plainly. Never invent tenants, units or amounts.',
          'Amounts are Philippine pesos; format them like ₱12,500.00. Keep answers short and in plain text (no Markdown; use simple dashes for lists). Reply in the language the user writes in (English, Filipino or Taglish).',
          `DATA (JSON): ${JSON.stringify(context)}`,
        ].join('\n'),
      },
    });
    // The chat shows plain text, so strip the Markdown Gemini still sometimes adds.
    const reply = (result.text ?? '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^(\s*)\* /gm, '$1- ').trim();
    res.json({ reply: reply || "I couldn't come up with an answer. Try rephrasing." });
  } catch (err) {
    console.error('Gemini error:', err.message);
    throw bad('Nena is unavailable right now. Try again in a minute.', 502);
  }
});

// Generic CRUD for every collection
app.param('collection', (req, res, next, c) => next(store.collections.includes(c) ? undefined : bad(`Unknown resource "${c}"`, 404)));
app.get('/api/:collection', (req, res) => res.json(store.list(req.params.collection)));
app.get('/api/:collection/:id', (req, res) => {
  const row = store.get(req.params.collection, req.params.id);
  if (!row) throw bad('Not found', 404);
  res.json(row);
});
app.post('/api/:collection', (req, res) => {
  const c = req.params.collection;
  res.status(201).json(store.create(c, clean(c, req.body)));
});
app.put('/api/:collection/:id', (req, res) => {
  const c = req.params.collection;
  const row = store.update(c, req.params.id, clean(c, req.body));
  if (!row) throw bad('Not found', 404);
  res.json(row);
});
app.delete('/api/:collection/:id', (req, res) => {
  const { collection: c, id } = req.params;
  for (const [child, key] of referencedBy[c] ?? []) {
    const n = store.list(child).filter((row) => row[key] === id).length;
    if (n) throw bad(`Can't delete: ${n} ${child} still reference it. Remove those first${c === 'tenants' ? ', or archive the tenant' : ''}.`, 409);
  }
  if (!store.remove(c, id)) throw bad('Not found', 404);
  res.status(204).end();
});

app.use((err, req, res, next) => {
  if (!err.status) console.error(err);
  res.status(err.status ?? 500).json({ error: err.status ? err.message : 'Something went wrong on the server. Try again.' });
});

// Automated rent invoices: backfill the last 3 months on boot, then check daily. Idempotent.
for (const n of [-2, -1, 0]) generateFor(r.addMonths(`${r.today().slice(0, 7)}-01`, n).slice(0, 7));
setInterval(() => generateFor(r.today().slice(0, 7)), 864e5);

app.listen(PORT, () => console.log(`RentIO API on http://localhost:${PORT}`));
