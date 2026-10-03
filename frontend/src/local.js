// The whole backend, on the phone: same routes the Express API had, data kept in localStorage.
// Business rules and validation are the backend's own files, so reports and checks behave exactly as before.
import * as r from '../../backend/reports.js';
import { bad, clean, cleanMonths } from '../../backend/validate.js';

const KEY = 'rentio-data';
const collections = ['properties', 'tenants'];
const referencedBy = { properties: [['tenants', 'propertyId']] };
const reports = { dashboard: r.dashboard, alerts: r.alerts, 'tenant-balances': r.tenantRows };

let db;
const load = () => (db ??= (() => {
  try { return { properties: [], tenants: [], rentPayments: [], ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { properties: [], tenants: [], rentPayments: [] }; }
})());
const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { throw bad("Couldn't save to this phone. Free up some storage and try again.", 500); }
};

const checkRow = (c, row) => {
  if (c === 'tenants' && !load().properties.some((p) => p.id === row.propertyId)) throw bad('Choose one of your properties.');
  return row;
};
const setPaid = (tenantId, months, paid) => {
  const d = load(), same = (p, m) => p.tenantId === tenantId && p.year === m.year && p.month === m.month;
  const tenant = d.tenants.find((t) => t.id === tenantId);
  if (!tenant) throw bad('Tenant not found', 404);
  for (const m of months) d.rentPayments = d.rentPayments.filter((p) => !same(p, m)); // also makes ticking twice a no-op
  if (paid) d.rentPayments.push(...months.map((m) => ({ tenantId, ...m, amount: Number(tenant.monthlyRent) || 0, paidAt: new Date().toISOString() })));
  save();
  return { tenantId, months, paid };
};

export function route(path, method, body) {
  const [pathname, query] = path.split('?');
  const [a, b, c, d] = pathname.split('/').slice(1);
  const d0 = load(), params = new URLSearchParams(query);

  if (a === 'reports') {
    if (!reports[b]) throw bad('Unknown report', 404);
    return reports[b](d0);
  }
  if (a === 'rent') {
    if (method === 'GET') {
      const year = Number(params.get('year')) || Number(r.today().slice(0, 4));
      if (year < 2000 || year > 2100) throw bad('Year must be between 2000 and 2100');
      return r.rentGrid(d0, year);
    }
    if (typeof body?.paid !== 'boolean') throw bad('paid must be true or false');
    if (c) { // one month: /rent/:tenantId/:year/:month
      const [year, month] = [Number(c), Number(d)];
      return setPaid(b, cleanMonths([{ year, month }]), body.paid);
    }
    return setPaid(b, cleanMonths(body.months), body.paid);
  }
  if (a === 'account') { // erase everything
    db = { properties: [], tenants: [], rentPayments: [] };
    save();
    return null;
  }
  if (!collections.includes(a)) throw bad(`Unknown resource "${a}"`, 404);
  if (b && c === 'summary') {
    const summary = r.tenantSummary(d0, b);
    if (!summary) throw bad('Tenant not found', 404);
    return summary;
  }
  const rows = d0[a], row = rows.find((x) => x.id === b);
  if (method === 'GET') {
    if (!b) return rows;
    if (!row) throw bad('Not found', 404);
    return row;
  }
  if (method === 'POST') {
    const created = { ...checkRow(a, clean(a, body)), id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    rows.push(created);
    save();
    return created;
  }
  if (!row) throw bad('Not found', 404);
  if (method === 'PUT') {
    Object.assign(row, checkRow(a, clean(a, body)));
    save();
    return row;
  }
  for (const [child, key] of referencedBy[a] ?? []) {
    const n = d0[child].filter((x) => x[key] === b).length;
    if (n) throw bad(`Can't delete: ${n} ${child} are still assigned to it. Move or remove them first.`, 409);
  }
  d0[a] = rows.filter((x) => x.id !== b);
  if (a === 'tenants') d0.rentPayments = d0.rentPayments.filter((p) => p.tenantId !== b);
  save();
  return null;
}

// CSV of a report or a collection, same as the old /export route.
export function exportCsv(name) {
  const d0 = load();
  const rows = reports[name] ? reports[name](d0) : d0[name];
  if (!Array.isArray(rows)) throw bad('Nothing to export under that name', 404);
  return r.toCsv(rows);
}
