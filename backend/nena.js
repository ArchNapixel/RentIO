// Nena, the RentIO assistant: Gemini with tools over RentIO data.
// Read tools run immediately. Action tools only *propose* a change; it is saved
// by execute() after the owner taps Confirm, and then written to the activity log.
import { randomUUID } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import * as store from './store.js';
import * as r from './reports.js';
import { bad, clean } from './validate.js';

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const MAX_STEPS = 6; // tool rounds per message
const MAX_PROPOSALS = 3; // changes Nena may propose per message
const MAX_MONTHS = 24; // months per mark_rent_paid
const SCREENS = ['dashboard', 'payments', 'tenants', 'properties', 'finance', 'alerts'];

function requireAi() {
  if (!ai) throw bad('Nena is not set up. Add GEMINI_API_KEY to backend/.env and restart the server.', 503);
}
function geminiFailed(err) {
  if (err.expose) return err;
  console.error('Gemini error:', err.message);
  if (err.status === 429) return bad("Nena has reached Gemini's usage limit for now. Try again in a minute.", 429);
  return bad('Nena is unavailable right now. Try again in a minute.', 502);
}
// Gemini sometimes answers 503 "high demand" for a moment; retry once before giving up.
async function generate(params) {
  try {
    return await ai.models.generateContent({ model: MODEL, ...params });
  } catch (err) {
    if (err.status !== 503) throw err;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return ai.models.generateContent({ model: MODEL, ...params });
  }
}
// The chat shows plain text, so strip the Markdown Gemini sometimes adds.
const plain = (text) => (text ?? '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^(\s*)\* /gm, '$1- ').trim();
const peso = (n) => (Number(n) || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
const defined = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

// Gemini schema helpers
const obj = (properties, required = []) => ({ type: 'OBJECT', properties, required });
const str = (description) => ({ type: 'STRING', description });
const num = (description) => ({ type: 'NUMBER', description });
const int = (description) => ({ type: 'INTEGER', description });
const bool = (description) => ({ type: 'BOOLEAN', description });
const oneOf = (values, description) => ({ type: 'STRING', enum: values, description });

const findTenant = (db, id) => db.tenants.find((t) => t.id === id) ?? throwBad(`No tenant with id ${id}. Look it up with search_tenants first.`);
const findProperty = (db, id) => db.properties.find((p) => p.id === id) ?? throwBad(`No property with id ${id}. Look it up with get_overview first.`);
function throwBad(message) { throw bad(message); }

const tenantFields = {
  name: str('Full name'),
  propertyId: str('Id of the property they rent at (from get_overview)'),
  monthlyRent: num('Monthly rent in PHP'),
  moveInDate: str('Move-in date, YYYY-MM-DD; rent is due from this month'),
  phone: str('Phone number'),
  email: str('Email address'),
  emergencyName: str('Emergency contact name'),
  emergencyPhone: str('Emergency contact phone'),
  notes: str('Notes'),
};
const propertyFields = {
  name: str('Property name'),
  type: oneOf(r.PROPERTY_TYPES, 'Property type'),
  capacity: int('Total persons; required for Boarding house and Dormitory'),
};
const LABELS = {
  name: 'Name', propertyId: 'Renting at', monthlyRent: 'Monthly rent', moveInDate: 'Move-in date', phone: 'Phone', email: 'Email',
  emergencyName: 'Emergency contact', emergencyPhone: 'Emergency phone', notes: 'Notes', type: 'Type', capacity: 'Capacity',
};

// "Monthly rent: ₱2,500.00 → ₱3,000.00" lines for every field that changes.
function changes(db, before, after, fields) {
  const show = (k, v) => (v == null || v === '' ? '—' : k === 'monthlyRent' ? peso(v) : k === 'propertyId' ? findProperty(db, v).name : String(v));
  const lines = Object.keys(fields).filter((k) => (before[k] ?? null) !== (after[k] ?? null)).map((k) => `${LABELS[k]}: ${show(k, before[k])} → ${show(k, after[k])}`);
  if (!lines.length) throw bad('Nothing would change.');
  return lines;
}

const readTools = {
  get_overview: {
    description: "Today's date, this month's numbers, and every property with its id, type, capacity and tenant count. Call this to get property ids.",
    parameters: obj({}),
    run: (db) => {
      const d = r.dashboard(db);
      return { today: r.today(), tenants: d.tenants, paidThisMonth: d.paidThisMonth, collectedThisMonth: d.collectedThisMonth, expectedThisMonth: d.expectedThisMonth, overdueTotal: d.overdue, properties: d.perProperty };
    },
  },
  search_tenants: {
    description: 'Find tenants with their ids, property, monthly rent, unpaid months and whether they paid this month. Omit query to list everyone.',
    parameters: obj({ query: str('Part of the name, any case'), propertyId: str('Only tenants of this property'), includeArchived: bool('Also include tenants who moved out') }),
    run: (db, a) => {
      const q = String(a.query ?? '').toLowerCase();
      const moved = a.includeArchived ? db.tenants.filter((t) => t.archived).map((t) => ({ id: t.id, name: t.name, propertyId: t.propertyId, movedOut: true })) : [];
      const tenants = [...r.tenantRows(db), ...moved].filter((t) => t.name.toLowerCase().includes(q) && (!a.propertyId || t.propertyId === a.propertyId));
      return { tenants: tenants.slice(0, 50), total: tenants.length };
    },
  },
  get_tenant: {
    description: "One tenant's full details: contact info, payment history (with the date each month was marked paid), unpaid months and balance.",
    parameters: obj({ tenantId: str('Tenant id') }, ['tenantId']),
    run: (db, a) => r.tenantSummary(db, a.tenantId) ?? { error: 'No tenant with that id' },
  },
  get_rent_tracker: {
    description: 'Which months each tenant has paid in a year, grouped by property.',
    parameters: obj({ year: int('Year, e.g. 2026'), propertyId: str('Only this property') }, ['year']),
    run: (db, a) => {
      const grid = r.rentGrid(db, Number(a.year));
      return a.propertyId ? { ...grid, properties: grid.properties.filter((p) => p.id === a.propertyId) } : grid;
    },
  },
  get_finance: {
    description: 'Rent collected per month for the last 12 months, and expected rent per month from current tenants.',
    parameters: obj({}),
    run: (db) => r.finance(db),
  },
  get_alerts: {
    description: 'Current alerts: overdue rent, not yet paid this month, open spots.',
    parameters: obj({}),
    run: (db) => ({ alerts: r.alerts(db) }),
  },
  get_activity_log: {
    description: 'The latest changes made through Nena after the owner confirmed them.',
    parameters: obj({}),
    run: async (db, a, owner) => ({ actions: await store.recentActions(owner, 20) }),
  },
};

// prepare() validates and describes a change; execute() saves it. Both run again on Confirm.
export const actionTools = {
  mark_rent_paid: {
    title: 'Update rent tracker',
    description: 'Mark months as paid (or unpaid) in the rent tracker. Saved only after the owner confirms.',
    parameters: obj({
      entries: {
        type: 'ARRAY',
        description: `Up to ${MAX_MONTHS} tenant-months`,
        items: obj({ tenantId: str('Tenant id'), year: int('Year'), month: int('Month, 1-12'), paid: bool('true = paid, false = not paid') }, ['tenantId', 'year', 'month', 'paid']),
      },
    }, ['entries']),
    prepare(db, { entries }) {
      if (!Array.isArray(entries) || !entries.length) throw bad('Give at least one month.');
      if (entries.length > MAX_MONTHS) throw bad(`At most ${MAX_MONTHS} months per change.`);
      const paidNow = new Set(db.rentPayments.map((p) => `${p.tenantId}:${p.year}:${p.month}`));
      const payload = entries
        .map((e) => ({ tenantId: e.tenantId, year: Number(e.year), month: Number(e.month), paid: e.paid !== false }))
        .filter((e) => paidNow.has(`${e.tenantId}:${e.year}:${e.month}`) !== e.paid); // skip months already in that state
      if (!payload.length) throw bad('Those months are already marked that way. Nothing to change.');
      const lines = payload.map((e) => {
        const t = findTenant(db, e.tenantId);
        if (!Number.isInteger(e.year) || e.year < 2000 || e.year > 2100 || !Number.isInteger(e.month) || e.month < 1 || e.month > 12) throw bad('Invalid month.');
        return `${t.name}: ${r.monthLabel(e)} → ${e.paid ? 'paid' : 'not paid'}`;
      });
      return { summary: lines.join('\n'), payload };
    },
    async execute(owner, payload) {
      for (const e of payload) {
        const t = await store.get(owner, 'tenants', e.tenantId);
        if (!t) throw bad('That tenant no longer exists.', 404);
        await store.setPaid(owner, e.tenantId, e.year, e.month, e.paid, Number(t.monthlyRent) || 0);
      }
    },
  },
  add_tenant: {
    title: 'Add tenant',
    description: 'Add a new tenant. Saved only after the owner confirms.',
    parameters: obj(tenantFields, ['name', 'propertyId']),
    prepare(db, args) {
      const row = clean('tenants', defined(args));
      const property = findProperty(db, row.propertyId);
      const bits = [`${row.name} at ${property.name}`, row.monthlyRent != null && `${peso(row.monthlyRent)} a month`, row.moveInDate && `moved in ${row.moveInDate}`];
      return { summary: bits.filter(Boolean).join(' · '), payload: row };
    },
    execute: (owner, row) => store.create(owner, 'tenants', row),
  },
  update_tenant: {
    title: 'Edit tenant',
    description: "Change a tenant's details (only the fields given). Saved only after the owner confirms.",
    parameters: obj({ tenantId: str('Tenant id'), ...tenantFields }, ['tenantId']),
    prepare(db, { tenantId, ...fields }) {
      const t = findTenant(db, tenantId);
      const row = clean('tenants', { ...t, ...defined(fields) });
      return { summary: [t.name, ...changes(db, t, row, tenantFields)].join('\n'), payload: { id: t.id, row } };
    },
    execute: (owner, { id, row }) => store.update(owner, 'tenants', id, row),
  },
  archive_tenant: {
    title: 'Move out tenant',
    description: 'Mark a tenant as moved out (archived). Their records are kept. Saved only after the owner confirms.',
    parameters: obj({ tenantId: str('Tenant id') }, ['tenantId']),
    prepare(db, { tenantId }) {
      const t = findTenant(db, tenantId);
      if (t.archived) throw bad(`${t.name} is already archived.`);
      return { summary: `${t.name} moved out (archived, records kept)`, payload: { id: t.id, row: clean('tenants', { ...t, archived: true }) } };
    },
    execute: (owner, { id, row }) => store.update(owner, 'tenants', id, row),
  },
  add_property: {
    title: 'Add property',
    description: 'Add a new property. Saved only after the owner confirms.',
    parameters: obj(propertyFields, ['name', 'type']),
    prepare(db, args) {
      const row = clean('properties', defined(args));
      return { summary: [`${row.name} · ${row.type}`, row.capacity && `capacity ${row.capacity}`].filter(Boolean).join(' · '), payload: row };
    },
    execute: (owner, row) => store.create(owner, 'properties', row),
  },
  update_property: {
    title: 'Edit property',
    description: "Change a property's details (only the fields given). Saved only after the owner confirms.",
    parameters: obj({ propertyId: str('Property id'), ...propertyFields }, ['propertyId']),
    prepare(db, { propertyId, ...fields }) {
      const p = findProperty(db, propertyId);
      const row = clean('properties', { ...p, ...defined(fields) });
      return { summary: [p.name, ...changes(db, p, row, propertyFields)].join('\n'), payload: { id: p.id, row } };
    },
    execute: (owner, { id, row }) => store.update(owner, 'properties', id, row),
  },
};

const openScreen = {
  description: "Open a screen in the app for the owner. Give tenantId to open that tenant's details, or propertyId for a property (or its rent tracker when screen is payments).",
  parameters: obj({ screen: oneOf(SCREENS, 'dashboard, payments (the rent tracker), tenants, properties, finance or alerts'), tenantId: str('Tenant id'), propertyId: str('Property id') }, ['screen']),
};

const functionDeclarations = [
  ...Object.entries({ ...readTools, ...actionTools, open_screen: openScreen }).map(([name, t]) => ({ name, description: t.description, parameters: t.parameters })),
];

const system = () => [
  `You are Nena, the RentIO assistant for a property owner in the Philippines. Today is ${r.today()}. Be warm, friendly and brief. Introduce yourself as Nena when greeting or when asked who you are.`,
  'RentIO tracks properties, tenants and monthly rent. A tenant owes rent every month from their move-in month; the owner ticks each month in the rent tracker when it is paid.',
  'Look things up with the tools. Never guess ids, names or amounts: search first. If the data does not have the answer, say so.',
  'To change data, call an action tool (mark_rent_paid, add_tenant, update_tenant, archive_tenant, add_property, update_property). Nothing is saved until the owner taps Confirm under your message, so say the change is ready to confirm, never that it is done.',
  'You cannot delete anything. If asked, say so and use open_screen to take the owner to the tenant or property details, where they can delete it themselves.',
  'Use open_screen when the owner asks to see, open or go to something.',
  'Receipt photos (GCash, Maya, bank transfer): read the payer name, amount, date and reference number and mention them. Find the tenant with search_tenants, then propose mark_rent_paid for the oldest unpaid month(s) the amount covers (amount divided by monthly rent). If you are unsure who paid or which month, ask instead.',
  'For recaps and trends use get_finance and get_alerts. Tenants with 2 or more unpaid months are repeat late payers.',
  'Format pesos like ₱12,500.00. Plain text only: no Markdown; use simple dashes for lists. Reply in the language the owner uses (English, Filipino or Taglish).',
].join('\n');

function imagePart(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
  if (!m) throw bad('The photo must be a JPEG, PNG or WebP image.');
  return { inlineData: { mimeType: m[1], data: m[2] } };
}

function toContents(messages) {
  if (!Array.isArray(messages) || messages.at(-1)?.role !== 'user') throw bad('Send at least one user message.');
  const recent = messages.slice(-20);
  while (recent.length && recent[0].role !== 'user') recent.shift(); // Gemini wants the owner to speak first
  return recent.map((m, i) => {
    const parts = [{ text: String(m.text ?? '').slice(0, 4000) || '(photo)' }];
    if (m.image && i === recent.length - 1) parts.push(imagePart(m.image)); // only the newest photo is sent
    return { role: m.role === 'user' ? 'user' : 'model', parts };
  });
}

async function runTool({ name, args = {} }, db, state, owner) {
  try {
    if (readTools[name]) return await readTools[name].run(db, args, owner);
    if (actionTools[name]) {
      if (state.proposals.length >= MAX_PROPOSALS) return { error: `Only ${MAX_PROPOSALS} changes per message. Ask the owner to confirm these first.` };
      const { summary } = actionTools[name].prepare(db, args);
      state.proposals.push({ id: randomUUID(), tool: name, title: actionTools[name].title, args, summary });
      return { status: 'Shown to the owner with a Confirm button. NOT saved yet.', summary };
    }
    if (name === 'open_screen') {
      if (!SCREENS.includes(args.screen)) throw bad('Unknown screen.');
      state.navigate = defined({ screen: args.screen, tenantId: args.tenantId, propertyId: args.propertyId });
      return { ok: true };
    }
    return { error: `Unknown tool ${name}` };
  } catch (err) {
    return { error: err.message };
  }
}

export async function chat(owner, messages) {
  requireAi();
  const contents = toContents(messages);
  const db = await store.snapshot(owner);
  const state = { proposals: [], navigate: null };
  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await generate({ contents, config: { systemInstruction: system(), tools: [{ functionDeclarations }] } });
      const calls = res.functionCalls ?? [];
      if (!calls.length) {
        const reply = plain(res.text) || (state.proposals.length ? 'Ready. Tap Confirm to save.' : "I couldn't come up with an answer. Try asking another way.");
        return { reply, ...state };
      }
      contents.push(res.candidates[0].content); // keeps Gemini's thought signatures intact
      const parts = [];
      for (const call of calls) {
        const response = await runTool(call, db, state, owner);
        parts.push({ functionResponse: defined({ id: call.id, name: call.name, response: Array.isArray(response) ? { result: response } : response }) });
      }
      contents.push({ role: 'user', parts });
    }
    return { reply: 'That took me too many steps. Could you ask in a simpler way?', ...state };
  } catch (err) {
    throw geminiFailed(err);
  }
}

// Runs a change the owner confirmed, then logs it.
export async function execute(owner, tool, args) {
  const action = actionTools[tool];
  if (!action) throw bad('Unknown action.');
  const { summary, payload } = action.prepare(await store.snapshot(owner), args ?? {});
  await action.execute(owner, payload);
  await store.logAction(owner, tool, payload, summary).catch((err) => console.error('Could not write Nena activity log:', err.message));
  return { summary };
}

// Speech-bubble message. Regenerated only when payment status changes; falls back to a fixed hint.
const insightCache = new Map(); // owner -> { key, text, at }
export async function insight(owner) {
  const db = await store.snapshot(owner);
  const cached = insightCache.get(owner) ?? { key: '', text: '', at: 0 };
  insightCache.set(owner, cached);
  const d = r.dashboard(db);
  const fallback = { text: r.quickHint(d) };
  if (!ai) return fallback;
  const tenants = r.tenantRows(db);
  const key = r.today() + db.properties.length + JSON.stringify(tenants.map((t) => [t.id, t.paidThisMonth, t.overdueCount]));
  if (cached.key === key) return { text: cached.text };
  if (Date.now() - cached.at < 60_000) return fallback; // don't call Gemini on every quick change
  cached.at = Date.now();
  try {
    const res = await generate({
      contents: [{ role: 'user', parts: [{ text: JSON.stringify({ today: r.today(), dashboard: d, tenants, lastThreeMonths: r.finance(db).monthly.slice(-3) }) }] }],
      config: {
        systemInstruction: [
          "You are Nena, the RentIO assistant. Write the message for your speech bubble on the owner's screen.",
          'At most 2 short sentences, under 30 words, plain text, no Markdown, simple friendly English. Write pesos like ₱2,500.',
          'Say the single most useful thing right now: who is behind on rent, how many have not paid this month, or (from the 25th to the 3rd) a quick recap of collected vs expected.',
          'Name repeat late payers (overdueCount 2 or more). With no properties, invite the owner to add one; with no tenants, to add a tenant.',
        ].join('\n'),
      },
    });
    const text = plain(res.text);
    if (!text) return fallback;
    Object.assign(cached, { key, text, at: Date.now() });
    return { text };
  } catch (err) {
    console.error('Gemini insight error:', err.message);
    return fallback;
  }
}

export async function transcribe(dataUrl) {
  requireAi();
  const m = /^data:audio\/wav;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
  if (!m) throw bad('Audio must be a WAV recording.');
  try {
    const res = await generate({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'audio/wav', data: m[1] } },
          { text: 'Transcribe this recording exactly as spoken. It may be English, Filipino or Taglish. Output only the spoken words. If there is no speech, output nothing.' },
        ],
      }],
    });
    return { text: plain(res.text) };
  } catch (err) {
    throw geminiFailed(err);
  }
}
