import test from 'node:test';
import assert from 'node:assert/strict';
import { generateInvoices, invoiceStatus, rentOn, toCsv } from './reports.js';

const lease = { id: 'l', startDate: '2025-01-01', endDate: '2026-12-31', rent: 1000, dueDay: 5, escalationPct: 10, escalationEveryMonths: 12 };

test('rent escalates on schedule', () => {
  assert.equal(rentOn(lease, '2025-12-31'), 1000);
  assert.equal(rentOn(lease, '2026-01-01'), 1100);
});

test('payments settle the oldest invoice first', () => {
  const db = {
    leases: [lease],
    invoices: [{ id: 'b', leaseId: 'l', dueDate: '2025-02-05', amount: 1000 }, { id: 'a', leaseId: 'l', dueDate: '2025-01-05', amount: 1000 }],
    payments: [{ leaseId: 'l', type: 'rent', amount: 1500 }],
  };
  const [a, b] = invoiceStatus(db, '2025-03-01');
  assert.deepEqual([a.id, a.status, b.status, b.paid, b.balance], ['a', 'paid', 'overdue', 500, 500]);
});

test('invoice generation uses escalated rent and is idempotent', () => {
  const [inv] = generateInvoices({ leases: [lease], invoices: [] }, '2026-02');
  assert.deepEqual([inv.dueDate, inv.amount], ['2026-02-05', 1100]);
  assert.equal(generateInvoices({ leases: [lease], invoices: [inv] }, '2026-02').length, 0);
});

test('csv escapes quotes and formula injection', () => {
  assert.equal(toCsv([{ a: 'x,"y"', b: '=1+1' }]), 'a,b\n"x,""y""",\'=1+1');
});
