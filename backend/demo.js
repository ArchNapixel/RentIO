// Sample data for guests: a dashboard to look at without signing up. Never stored anywhere.
import { today } from './reports.js';

// [id, name, property, monthly rent, moved in N months ago, unpaid recent months]
const TENANTS = [
  ['demo-t1', 'Maria Santos', 'demo-p1', 3500, 8, []],
  ['demo-t2', 'Juan dela Cruz', 'demo-p1', 3500, 5, [0, 1, 2]], // behind 2 months
  ['demo-t3', 'Ana Reyes', 'demo-p1', 3500, 2, [0]],
  ['demo-t4', 'Carlo Mendoza', 'demo-p2', 9000, 10, []],
  ['demo-t5', 'Liza Gonzales', 'demo-p2', 8500, 4, [0]],
];

export function demoData(on = today()) {
  const [y, m] = on.split('-').map(Number);
  const monthsAgo = (n) => { const i = y * 12 + (m - 1) - n; return { year: Math.floor(i / 12), month: (i % 12) + 1 }; };
  const properties = [
    { id: 'demo-p1', name: 'Casa Luna Dormitory', type: 'Dormitory', capacity: 12 },
    { id: 'demo-p2', name: 'Villa Rosa Apartments', type: 'Apartment', capacity: null },
  ];
  const tenants = [], rentPayments = [];
  for (const [id, name, propertyId, monthlyRent, since, unpaid] of TENANTS) {
    const start = monthsAgo(since);
    tenants.push({ id, name, propertyId, monthlyRent, archived: false, moveInDate: `${start.year}-${String(start.month).padStart(2, '0')}-01` });
    for (let n = since; n >= 0; n--) if (!unpaid.includes(n)) rentPayments.push({ tenantId: id, ...monthsAgo(n), amount: monthlyRent });
  }
  return { properties, tenants, rentPayments };
}
