// ponytail: in-memory store, resets on restart. Replace these five functions with DB queries when the database is set up.
import { randomUUID } from 'node:crypto';

export const collections = ['properties', 'units', 'tenants', 'leases', 'payments', 'invoices', 'expenses', 'violations'];

const db = Object.fromEntries(collections.map((c) => [c, []]));

export const list = (c) => db[c];
export const get = (c, id) => db[c].find((r) => r.id === id);
export const create = (c, data) => {
  const row = { ...data, id: randomUUID() };
  db[c].push(row);
  return row;
};
export const update = (c, id, data) => {
  const row = get(c, id);
  return row ? Object.assign(row, data, { id }) : null;
};
export const remove = (c, id) => {
  const i = db[c].findIndex((r) => r.id === id);
  if (i < 0) return false;
  db[c].splice(i, 1);
  return true;
};
