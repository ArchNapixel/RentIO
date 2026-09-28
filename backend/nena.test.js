import test from 'node:test';
import assert from 'node:assert/strict';

// store.js needs Supabase settings at import time; placeholders are enough since these tests never query.
process.env.SUPABASE_URL ??= 'http://localhost';
process.env.SUPABASE_SECRET_KEY ??= 'test';
const { actionTools } = await import('./nena.js');

const db = {
  properties: [{ id: 'p', name: 'Casa Luna', type: 'Dormitory', capacity: 10 }],
  tenants: [{ id: 't', name: 'Juan', propertyId: 'p', monthlyRent: 3000 }],
  rentPayments: [],
};

test('mark_rent_paid describes each month and rejects unknown tenants or too many months', () => {
  const { summary } = actionTools.mark_rent_paid.prepare(db, { entries: [{ tenantId: 't', year: 2026, month: 9, paid: true }] });
  assert.equal(summary, 'Juan: Sep 2026 → paid');
  assert.throws(() => actionTools.mark_rent_paid.prepare(db, { entries: [{ tenantId: 'nope', year: 2026, month: 9, paid: true }] }), /No tenant/);
  const many = Array.from({ length: 25 }, () => ({ tenantId: 't', year: 2026, month: 1, paid: true }));
  assert.throws(() => actionTools.mark_rent_paid.prepare(db, { entries: many }), /At most 24/);
});

test('mark_rent_paid skips months that are already in the requested state', () => {
  const paidDb = { ...db, rentPayments: [{ tenantId: 't', year: 2026, month: 9 }] };
  assert.throws(() => actionTools.mark_rent_paid.prepare(paidDb, { entries: [{ tenantId: 't', year: 2026, month: 9, paid: true }] }), /already/);
  const { summary } = actionTools.mark_rent_paid.prepare(paidDb, { entries: [{ tenantId: 't', year: 2026, month: 9, paid: true }, { tenantId: 't', year: 2026, month: 10, paid: true }] });
  assert.equal(summary, 'Juan: Oct 2026 → paid');
});

test('update_tenant lists only the fields that change', () => {
  const { summary } = actionTools.update_tenant.prepare(db, { tenantId: 't', monthlyRent: 3500 });
  assert.equal(summary, 'Juan\nMonthly rent: ₱3,000.00 → ₱3,500.00');
  assert.throws(() => actionTools.update_tenant.prepare(db, { tenantId: 't', monthlyRent: 3000 }), /Nothing would change/);
});
