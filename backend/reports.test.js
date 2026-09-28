import test from 'node:test';
import assert from 'node:assert/strict';
import { overdueMonths, rentGrid, tenantRows, toCsv } from './reports.js';

const tenant = { id: 't', name: 'Juan', propertyId: 'p', monthlyRent: 3000, moveInDate: '2026-06-15' };
const db = {
  properties: [{ id: 'p', name: 'Casa Luna', type: 'Dormitory', capacity: 10 }],
  tenants: [tenant],
  rentPayments: [{ tenantId: 't', year: 2026, month: 6, amount: 3000 }, { tenantId: 't', year: 2026, month: 8, amount: 3000 }],
};
const paid = new Set(db.rentPayments.map((p) => `${p.tenantId}:${p.year}:${p.month}`));

test('overdue months run from move-in to last month, skipping paid ones', () => {
  assert.deepEqual(overdueMonths(tenant, paid, '2026-09-28'), [{ year: 2026, month: 7 }]);
  assert.deepEqual(overdueMonths(tenant, paid, '2026-06-01'), []); // current month is due, not overdue
});

test('overdue spans year boundaries', () => {
  assert.equal(overdueMonths({ ...tenant, moveInDate: '2025-11-01' }, new Set(), '2026-02-10').length, 3); // Nov, Dec, Jan
});

test('tenant rows compute balance from overdue months', () => {
  const [row] = tenantRows(db, '2026-09-28');
  assert.deepEqual([row.overdueMonths, row.balance, row.paidThisMonth], ['Jul 2026', 3000, false]);
});

test('rent grid lists paid months per tenant under their property', () => {
  const grid = rentGrid(db, 2026);
  assert.deepEqual(grid.properties[0].tenants[0].paid, [6, 8]);
});

test('csv escapes quotes and formula injection', () => {
  assert.equal(toCsv([{ a: 'x,"y"', b: '=1+1' }]), 'a,b\n"x,""y""",\'=1+1');
});
