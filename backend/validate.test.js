import test from 'node:test';
import assert from 'node:assert/strict';
import { clean } from './validate.js';

test('tenant email is optional but must look like an email', () => {
  const t = { name: 'Juan', propertyId: 'p' };
  assert.equal(clean('tenants', { ...t, email: '' }).email, null);
  assert.equal(clean('tenants', { ...t, email: 'juan@gmail.com' }).email, 'juan@gmail.com');
  assert.throws(() => clean('tenants', { ...t, email: 'juan@gmail' }), /Enter an email/);
});
