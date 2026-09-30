import test from 'node:test';
import assert from 'node:assert/strict';
import { clean, cleanMonths } from './validate.js';

test('tenant email is optional but must look like an email', () => {
  const t = { name: 'Juan', propertyId: 'p' };
  assert.equal(clean('tenants', { ...t, email: '' }).email, null);
  assert.equal(clean('tenants', { ...t, email: 'juan@gmail.com' }).email, 'juan@gmail.com');
  assert.throws(() => clean('tenants', { ...t, email: 'juan@gmail' }), /Enter an email/);
});

test('names are trimmed, and blank or oversized text is refused', () => {
  const t = { propertyId: 'p' };
  assert.equal(clean('tenants', { ...t, name: '  Juan  ' }).name, 'Juan');
  assert.throws(() => clean('tenants', { ...t, name: '   ' }), /name is required/);
  assert.throws(() => clean('tenants', { ...t, name: 'x'.repeat(501) }), /too long/);
});

test('batch months are validated and de-duplicated', () => {
  assert.deepEqual(cleanMonths([{ year: 2026, month: 9 }, { year: 2026, month: 9 }, { year: 2026, month: 8 }]), [{ year: 2026, month: 9 }, { year: 2026, month: 8 }]);
  assert.throws(() => cleanMonths([]), /between 1 and/);
  assert.throws(() => cleanMonths([{ year: 2026, month: 13 }]), /Invalid month/);
  assert.throws(() => cleanMonths([{ year: '2026', month: 1 }]), /Invalid month/);
  assert.equal(cleanMonths(Array.from({ length: 45 }, (_, i) => ({ year: 2023 + Math.floor(i / 12), month: (i % 12) + 1 }))).length, 45); // a three-year backlog is fine
});
