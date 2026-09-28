// Input validation shared by the REST routes and Nena's actions.
import { PROPERTY_TYPES, SHARED_TYPES } from './reports.js';

// expose: safe to show this message to the user (unlike errors thrown by libraries).
export const bad = (message, status = 400) => Object.assign(new Error(message), { status, expose: true });

const required = {
  properties: ['name', 'type'],
  tenants: ['name', 'propertyId'],
};
const numeric = new Set(['capacity', 'monthlyRent']);
const readOnly = new Set(['id', 'createdAt', 'ownerId']); // ownerId always comes from the login, never the request

export function clean(collection, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw bad('Request body must be a JSON object');
  const row = {};
  for (const [k, v] of Object.entries(body)) {
    if (readOnly.has(k)) continue;
    row[k] = v === '' ? null : numeric.has(k) && v != null ? Number(v) : v;
    if (Number.isNaN(row[k])) throw bad(`${k} must be a number`);
  }
  for (const k of required[collection]) if (row[k] == null) throw bad(`${k} is required`);
  if (row.email != null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) throw bad('Enter an email like juan@gmail.com, or leave it blank');
  if (collection === 'properties') {
    if (!PROPERTY_TYPES.includes(row.type)) throw bad(`Type must be one of: ${PROPERTY_TYPES.join(', ')}`);
    if (SHARED_TYPES.includes(row.type) && !(Number.isInteger(row.capacity) && row.capacity > 0)) {
      throw bad('Boarding houses and dormitories need a total capacity of at least 1 person');
    }
  }
  return row;
}
