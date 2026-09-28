// Pure business logic over a db snapshot ({ properties: [...], units: [...], ... }).
// Dates are ISO strings (YYYY-MM-DD) so they compare correctly as strings.

export const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const toDate = (iso) => new Date(iso + 'T00:00:00Z');
export const addDays = (iso, n) => { const d = toDate(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const addMonths = (iso, n) => { const d = toDate(iso); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
const monthsBetween = (a, b) => {
  const [ay, am, ad] = a.split('-').map(Number), [by, bm, bd] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am) - (bd < ad ? 1 : 0);
};
const round = (n) => Math.round(n * 100) / 100;
const sum = (rows, f = (r) => r.amount) => round(rows.reduce((s, r) => s + (Number(f(r)) || 0), 0));
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
const peso = (n) => n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));

function labels(db) {
  const p = byId(db.properties), u = byId(db.units), t = byId(db.tenants);
  return {
    unit: (id) => (u[id] ? `${p[u[id].propertyId]?.name ?? '—'} · ${u[id].name}` : '—'),
    tenant: (id) => t[id]?.name ?? '—',
  };
}

export const isActive = (lease, on) => !lease.terminated && lease.startDate <= on && on <= lease.endDate;

// ponytail: due day capped at 28 so every month has it; no prorating of partial first months.
const dueDate = (lease, month) => `${month}-${String(Math.min(Math.max(Number(lease.dueDay) || 1, 1), 28)).padStart(2, '0')}`;

export function rentOn(lease, on) {
  const every = Number(lease.escalationEveryMonths) || 12;
  const steps = Math.max(0, Math.floor(monthsBetween(lease.startDate, on) / every));
  return round(Number(lease.rent) * (1 + (Number(lease.escalationPct) || 0) / 100) ** steps);
}

export function escalation(db, id) {
  const l = db.leases.find((x) => x.id === id);
  if (!l) return null;
  const L = labels(db), every = Number(l.escalationEveryMonths) || 12, steps = [];
  for (let i = 0, d = l.startDate; d <= l.endDate; d = addMonths(l.startDate, every * ++i)) steps.push({ from: d, rent: rentOn(l, d) });
  return { tenant: L.tenant(l.tenantId), unit: L.unit(l.unitId), steps };
}

// Reconciliation: each lease's rent payments are applied to its invoices, oldest first.
export function invoiceStatus(db, on = today()) {
  const out = [];
  for (const lease of db.leases) {
    let credit = sum(db.payments.filter((p) => p.leaseId === lease.id && p.type === 'rent'));
    const invoices = db.invoices.filter((i) => i.leaseId === lease.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    for (const inv of invoices) {
      const paid = Math.min(credit, Number(inv.amount));
      credit = round(credit - paid);
      const balance = round(inv.amount - paid);
      const status = balance <= 0 ? 'paid' : inv.dueDate < on ? 'overdue' : paid > 0 ? 'partial' : 'due';
      out.push({ ...inv, paid: round(paid), balance, status });
    }
  }
  return out;
}

export function generateInvoices(db, month) {
  return db.leases
    .filter((l) => isActive(l, dueDate(l, month)) && !db.invoices.some((i) => i.leaseId === l.id && i.period === month))
    .map((l) => ({ leaseId: l.id, period: month, dueDate: dueDate(l, month), amount: rentOn(l, dueDate(l, month)), description: `Rent ${month}` }));
}

export function balances(db) {
  const L = labels(db);
  return db.leases.map((l) => {
    const invoiced = sum(db.invoices.filter((i) => i.leaseId === l.id));
    const paid = sum(db.payments.filter((p) => p.leaseId === l.id && p.type === 'rent'));
    return { id: l.id, tenant: L.tenant(l.tenantId), unit: L.unit(l.unitId), invoiced, paid, balance: round(invoiced - paid) };
  });
}

export function depositLedger(db) {
  const L = labels(db);
  return db.leases.map((l) => {
    const p = db.payments.filter((x) => x.leaseId === l.id);
    const required = Number(l.deposit) || 0;
    const received = sum(p.filter((x) => x.type === 'deposit'));
    const refunded = sum(p.filter((x) => x.type === 'deposit refund'));
    return { id: l.id, tenant: L.tenant(l.tenantId), unit: L.unit(l.unitId), required, received, refunded, held: round(received - refunded), outstanding: round(required - received) };
  });
}

export function leaseExpiry(db, on = today()) {
  const L = labels(db);
  return db.leases
    .filter((l) => !l.terminated && l.endDate >= on)
    .map((l) => ({
      id: l.id, tenant: L.tenant(l.tenantId), unit: L.unit(l.unitId), startDate: l.startDate, endDate: l.endDate,
      daysLeft: daysBetween(on, l.endDate),
      noticeDeadline: addDays(l.endDate, -(Number(l.noticeDays) || 0)),
      renewalStatus: l.renewalStatus || 'pending',
    }))
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
}

export function rentRoll(db, on = today()) {
  const L = labels(db), bal = Object.fromEntries(balances(db).map((b) => [b.id, b.balance]));
  return db.units.map((u) => {
    const l = db.leases.find((x) => x.unitId === u.id && isActive(x, on));
    return {
      id: u.id, unit: L.unit(u.id), status: l ? 'Occupied' : 'Vacant', tenant: l ? L.tenant(l.tenantId) : '',
      rent: l ? rentOn(l, on) : Number(u.marketRent) || 0, dueDay: l?.dueDay ?? '', leaseEnd: l?.endDate ?? '', balance: l ? bal[l.id] : 0,
    };
  });
}

export function dashboard(db, on = today()) {
  const occupied = new Set(db.leases.filter((l) => isActive(l, on)).map((l) => l.unitId));
  const occupiedCount = db.units.filter((u) => occupied.has(u.id)).length;
  const month = on.slice(0, 7);
  const invoices = invoiceStatus(db, on);
  const monthInvoices = invoices.filter((i) => i.dueDate.startsWith(month));
  return {
    properties: db.properties.length,
    units: db.units.length,
    occupied: occupiedCount,
    vacant: db.units.length - occupiedCount,
    occupancyRate: pct(occupiedCount, db.units.length),
    monthIncome: sum(db.payments.filter((p) => p.date?.startsWith(month) && (p.type === 'rent' || p.type === 'other'))),
    monthExpenses: sum(db.expenses.filter((e) => e.date?.startsWith(month))),
    collectionRate: pct(sum(monthInvoices, (i) => i.paid), sum(monthInvoices)),
    overdue: sum(invoices.filter((i) => i.status === 'overdue'), (i) => i.balance),
    expiring: leaseExpiry(db, on).filter((l) => l.daysLeft <= 90),
    perProperty: db.properties.map((p) => {
      const units = db.units.filter((u) => u.propertyId === p.id);
      const occ = units.filter((u) => occupied.has(u.id)).length;
      return { id: p.id, name: p.name, units: units.length, occupied: occ, vacant: units.length - occ, occupancy: pct(occ, units.length) };
    }),
  };
}

export function alerts(db, on = today()) {
  const L = labels(db), leases = byId(db.leases), out = [];
  const who = (leaseId) => `${L.tenant(leases[leaseId]?.tenantId)} (${L.unit(leases[leaseId]?.unitId)})`;
  for (const i of invoiceStatus(db, on)) {
    if (i.status === 'overdue') out.push({ id: `overdue-${i.id}`, type: 'Overdue rent', severity: 'high', message: `${who(i.leaseId)} owes ${peso(i.balance)}, due ${i.dueDate}` });
    else if (i.balance > 0 && daysBetween(on, i.dueDate) <= 5) out.push({ id: `due-${i.id}`, type: 'Rent due soon', severity: 'medium', message: `${who(i.leaseId)}: ${peso(i.balance)} due ${i.dueDate}` });
  }
  for (const l of leaseExpiry(db, on)) {
    if (l.daysLeft <= 60 && l.renewalStatus !== 'renewed') {
      out.push({ id: `expiry-${l.id}`, type: 'Lease expiring', severity: l.daysLeft <= 30 ? 'high' : 'medium', message: `${l.tenant} (${l.unit}) ends ${l.endDate}, ${l.daysLeft} days left. Renewal: ${l.renewalStatus}` });
    }
    const n = daysBetween(on, l.noticeDeadline);
    if (n >= 0 && n <= 14) out.push({ id: `notice-${l.id}`, type: 'Notice deadline', severity: 'medium', message: `${l.tenant} (${l.unit}) notice deadline ${l.noticeDeadline}, ${n} days left` });
  }
  for (const u of rentRoll(db, on)) if (u.status === 'Vacant') out.push({ id: `vacant-${u.id}`, type: 'Vacancy', severity: 'low', message: `${u.unit} is vacant` });
  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export function finance(db, on = today()) {
  const first = `${on.slice(0, 7)}-01`;
  const month = (n) => addMonths(first, n).slice(0, 7);
  const paid = (m, type) => sum(db.payments.filter((p) => p.date?.startsWith(m) && p.type === type));
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const m = month(i - 11);
    const income = round(paid(m, 'rent') + paid(m, 'other'));
    const expenses = sum(db.expenses.filter((e) => e.date?.startsWith(m)));
    const depositsIn = paid(m, 'deposit'), depositsOut = paid(m, 'deposit refund');
    return { month: m, income, expenses, profit: round(income - expenses), depositsIn, depositsOut, cashFlow: round(income + depositsIn - depositsOut - expenses) };
  });
  const categories = {};
  for (const e of db.expenses) if (e.date >= `${month(-11)}-01`) categories[e.category] = round((categories[e.category] || 0) + Number(e.amount));
  const projection = Array.from({ length: 12 }, (_, i) => {
    const m = month(i);
    const active = db.leases.filter((l) => isActive(l, dueDate(l, m)));
    return { month: m, leases: active.length, income: sum(active, (l) => rentOn(l, dueDate(l, m))) };
  });
  const due = invoiceStatus(db, on).filter((i) => i.dueDate <= on);
  return {
    monthly,
    projection,
    categories: Object.entries(categories).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    totals: {
      income: sum(monthly, (m) => m.income),
      expenses: sum(monthly, (m) => m.expenses),
      profit: sum(monthly, (m) => m.profit),
      collectionRate: pct(sum(due, (i) => i.paid), sum(due)),
    },
  };
}

export function tenantSummary(db, id, on = today()) {
  const tenant = db.tenants.find((t) => t.id === id);
  if (!tenant) return null;
  const L = labels(db);
  const leases = db.leases
    .filter((l) => l.tenantId === id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .map((l) => ({ ...l, unit: L.unit(l.unitId), currentRent: rentOn(l, on), active: isActive(l, on) }));
  const ids = new Set(leases.map((l) => l.id));
  const invoices = invoiceStatus(db, on).filter((i) => ids.has(i.leaseId));
  return {
    tenant,
    leases,
    invoices,
    payments: db.payments.filter((p) => ids.has(p.leaseId)).sort((a, b) => b.date.localeCompare(a.date)),
    violations: db.violations.filter((v) => ids.has(v.leaseId)),
    balance: sum(invoices, (i) => i.balance),
  };
}

export function toCsv(rows) {
  if (!rows.length) return '';
  const cols = [...new Set(rows.flatMap(Object.keys))];
  const esc = (v) => {
    if (v == null) return '';
    let s = String(v);
    if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}
