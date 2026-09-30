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
const MAX_TEXT = 500, MAX_NOTES = 2000;
export const MAX_MONTHS = 120; // months per batch payment: ten years of catching up

export function clean(collection, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw bad('Request body must be a JSON object');
  const row = {};
  for (const [k, v] of Object.entries(body)) {
    if (readOnly.has(k)) continue;
    let val = typeof v === 'string' ? v.trim() : v; // "   " is empty, not a name
    if (val === '') val = null;
    if (numeric.has(k) && val != null) val = Number(val);
    if (Number.isNaN(val)) throw bad(`${k} must be a number`);
    if (typeof val === 'string' && val.length > (k === 'notes' ? MAX_NOTES : MAX_TEXT)) throw bad(`${k} is too long`);
    row[k] = val;
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

// [{ year, month }] for a batch payment: validated and de-duplicated (a repeated month would make the upsert fail).
export function cleanMonths(months) {
  if (!Array.isArray(months) || !months.length || months.length > MAX_MONTHS) throw bad(`Give between 1 and ${MAX_MONTHS} months`);
  const seen = new Map();
  for (const m of months) {
    if (!(Number.isInteger(m?.year) && m.year >= 2000 && m.year <= 2100 && Number.isInteger(m?.month) && m.month >= 1 && m.month <= 12)) throw bad('Invalid month');
    seen.set(`${m.year}-${m.month}`, { year: m.year, month: m.month });
  }
  return [...seen.values()];
}
