// Pure business logic over a db snapshot: { properties, tenants, rentPayments }.
// Dates are ISO strings (YYYY-MM-DD). Rent is monthly: a tenant owes every month from their move-in month.

export const PROPERTY_TYPES = ['Boarding house', 'Dormitory', 'Apartment', 'Condominium', 'House'];
export const SHARED_TYPES = ['Boarding house', 'Dormitory']; // rented per person, have a capacity
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const round = (n) => Math.round(n * 100) / 100;
const sum = (rows, f) => round(rows.reduce((s, r) => s + (Number(f(r)) || 0), 0));
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
const peso = (n) => n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
const monthIndex = (iso) => { const [y, m] = iso.split('-').map(Number); return y * 12 + m - 1; }; // months since year 0
const fromIndex = (i) => ({ year: Math.floor(i / 12), month: (i % 12) + 1 });
export const monthLabel = ({ year, month }) => `${MONTHS[month - 1]} ${year}`;

const startIndex = (t) => monthIndex(t.moveInDate || t.createdAt?.slice(0, 10) || today());
const paidKeys = (db) => new Set(db.rentPayments.map((p) => `${p.tenantId}:${p.year}:${p.month}`));

// Months from move-in up to (not including) the current month that are not marked paid.
export function overdueMonths(tenant, paid, on = today()) {
  const out = [];
  for (let i = startIndex(tenant); i < monthIndex(on); i++) {
    const { year, month } = fromIndex(i);
    if (!paid.has(`${tenant.id}:${year}:${month}`)) out.push({ year, month });
  }
  return out;
}

// Everything to collect right now: unpaid months up to and including the current one.
export function dueMonths(tenant, paid, on = today()) {
  const out = overdueMonths(tenant, paid, on);
  const now = fromIndex(monthIndex(on));
  if (startIndex(tenant) <= monthIndex(on) && !paid.has(`${tenant.id}:${now.year}:${now.month}`)) out.push(now);
  return out;
}

// One row per current tenant with payment status; shared by the dashboard, alerts, CSV and the assistant.
export function tenantRows(db, on = today()) {
  const paid = paidKeys(db), names = Object.fromEntries(db.properties.map((p) => [p.id, p.name]));
  const { year, month } = fromIndex(monthIndex(on));
  return db.tenants.filter((t) => !t.archived).map((t) => {
    const overdue = overdueMonths(t, paid, on);
    const rent = Number(t.monthlyRent) || 0;
    return {
      id: t.id, name: t.name, propertyId: t.propertyId, property: names[t.propertyId] ?? '—', monthlyRent: rent,
      paidThisMonth: paid.has(`${t.id}:${year}:${month}`),
      overdueMonths: overdue.map(monthLabel).join(', '),
      overdueCount: overdue.length,
      balance: round(overdue.length * rent),
    };
  });
}

export function dashboard(db, on = today()) {
  const tenants = tenantRows(db, on);
  const { year, month } = fromIndex(monthIndex(on));
  const shared = new Set(db.properties.filter((p) => SHARED_TYPES.includes(p.type)).map((p) => p.id));
  const capacity = sum(db.properties.filter((p) => shared.has(p.id)), (p) => p.capacity);
  const occupiedBeds = tenants.filter((t) => shared.has(t.propertyId)).length;
  return {
    properties: db.properties.length,
    tenants: tenants.length,
    capacity,
    occupiedBeds,
    occupancyRate: pct(occupiedBeds, capacity),
    paidThisMonth: tenants.filter((t) => t.paidThisMonth).length,
    collectedThisMonth: sum(db.rentPayments.filter((p) => p.year === year && p.month === month), (p) => p.amount),
    expectedThisMonth: sum(tenants, (t) => t.monthlyRent),
    overdue: sum(tenants, (t) => t.balance),
    collectedLast12Months: finance(db, on).totals.income,
    overdueTenants: tenants.filter((t) => t.overdueCount > 0),
    perProperty: db.properties.map((p) => {
      const here = tenants.filter((t) => t.propertyId === p.id);
      return {
        id: p.id, name: p.name, type: p.type, capacity: p.capacity ?? null, tenants: here.length,
        occupancy: p.capacity ? pct(here.length, p.capacity) : null,
        paidThisMonth: here.filter((t) => t.paidThisMonth).length,
      };
    }),
  };
}

// Nena's speech bubble when Gemini isn't available: the most urgent thing first.
export function quickHint(d, on = today()) {
  const month = MONTH_NAMES[Number(on.slice(5, 7)) - 1];
  if (d.properties === 0) return "Hi! I'm Nena, your RentIO assistant. Add your first property, or tap here to ask me anything.";
  if (d.tenants === 0) return 'No tenants yet. Tap my button to add your first tenant.';
  const late = d.overdueTenants.length;
  if (late) return `Heads up: ${late} tenant${late > 1 ? 's have' : ' has'} overdue rent (${peso(d.overdue)}). Tap to ask me who.`;
  const unpaid = d.tenants - d.paidThisMonth;
  if (unpaid) return `${unpaid} tenant${unpaid > 1 ? "s haven't" : " hasn't"} paid for ${month} yet.`;
  return `Everyone has paid for ${month}. Ask me anything.`;
}

// Daily email to the owner: only overdue rent, so a quiet day sends nothing.
export function overdueDigest(db, on = today()) {
  const late = tenantRows(db, on).filter((t) => t.overdueCount);
  if (!late.length) return null;
  const total = sum(late, (t) => t.balance);
  return {
    subject: `${late.length} tenant${late.length > 1 ? 's' : ''} behind on rent (${peso(total)})`,
    text: [
      'Overdue rent as of today:',
      '',
      ...late.map((t) => `- ${t.name} (${t.property}): ${t.overdueMonths}${t.balance ? `, ${peso(t.balance)}` : ''}`),
      '',
      'Open RentIO and tick the months in the rent tracker once they pay.',
    ].join('\n'),
  };
}

export function alerts(db, on = today()) {
  const out = [];
  const current = monthLabel(fromIndex(monthIndex(on)));
  for (const t of tenantRows(db, on)) {
    if (t.overdueCount) {
      out.push({
        id: `overdue-${t.id}-${t.overdueCount}`, type: 'Overdue rent', severity: t.overdueCount > 1 ? 'high' : 'medium',
        message: `${t.name} (${t.property}) hasn't paid ${t.overdueMonths}${t.balance ? `: ${peso(t.balance)}` : ''}`,
      });
    } else if (!t.paidThisMonth) {
      out.push({ id: `unpaid-${t.id}-${current}`, type: 'Not yet paid', severity: 'low', message: `${t.name} (${t.property}) hasn't paid for ${current} yet` });
    }
  }
  for (const p of dashboard(db, on).perProperty) {
    if (p.capacity && p.tenants < p.capacity) out.push({ id: `vacancy-${p.id}-${p.tenants}`, type: 'Vacancy', severity: 'low', message: `${p.name} has ${p.capacity - p.tenants} of ${p.capacity} spots open` });
  }
  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export function finance(db, on = today()) {
  const now = monthIndex(on);
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const { year, month } = fromIndex(now - 11 + i);
    return { month: `${year}-${String(month).padStart(2, '0')}`, income: sum(db.rentPayments.filter((p) => p.year === year && p.month === month), (p) => p.amount) };
  });
  return {
    monthly,
    totals: { income: sum(monthly, (m) => m.income), expectedMonthly: sum(tenantRows(db, on), (t) => t.monthlyRent), tenants: tenantRows(db, on).length },
  };
}

// Checkbox grid for the rent tracker: per property, its current tenants and which months of `year` are paid.
export function rentGrid(db, year, on = today()) {
  const paid = paidKeys(db);
  return {
    year,
    properties: db.properties.map((p) => ({
      id: p.id, name: p.name, type: p.type, capacity: p.capacity ?? null,
      tenants: db.tenants
        .filter((t) => t.propertyId === p.id && !t.archived)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((t) => ({
          id: t.id, name: t.name, monthlyRent: Number(t.monthlyRent) || 0, startMonth: startIndex(t),
          monthsBehind: overdueMonths(t, paid, on).length,
          due: dueMonths(t, paid, on),
          paid: db.rentPayments.filter((r) => r.tenantId === t.id && r.year === year).map((r) => r.month).sort((a, b) => a - b),
        })),
    })),
  };
}

export function tenantSummary(db, id, on = today()) {
  const tenant = db.tenants.find((t) => t.id === id);
  if (!tenant) return null;
  const overdue = overdueMonths(tenant, paidKeys(db), on);
  return {
    tenant,
    property: db.properties.find((p) => p.id === tenant.propertyId)?.name ?? '—',
    payments: db.rentPayments
      .filter((p) => p.tenantId === id)
      .sort((a, b) => b.year - a.year || b.month - a.month)
      .map((p) => ({ id: `${p.year}-${p.month}`, month: monthLabel(p), amount: Number(p.amount), paidAt: p.paidAt?.slice(0, 10) })),
    overdueMonths: overdue.map(monthLabel),
    balance: round(overdue.length * (Number(tenant.monthlyRent) || 0)),
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
