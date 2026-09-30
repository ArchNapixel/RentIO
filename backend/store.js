// Supabase data access, always scoped to one owner (the logged-in user).
// Database columns are snake_case; the app uses camelCase.
import { createClient, isAuthRetryableFetchError } from '@supabase/supabase-js';
import { bad } from './validate.js';

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env');
const sb = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

export const collections = ['properties', 'tenants'];

const mapKeys = (o, f) => Object.fromEntries(Object.entries(o).map(([k, v]) => [f(k), v]));
const toRow = (o) => mapKeys(o, (k) => k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()));
const fromRow = (o) => mapKeys(o, (k) => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()));
const isId = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

async function run(query) {
  const { data, error } = await query;
  if (!error) return data;
  if (error.code === 'PGRST205' || error.code === '42P01') throw bad('Database tables are missing. Run backend/schema.sql in the Supabase SQL Editor.', 503);
  if (error.code === '42703') throw bad('The database needs updating. Run the latest SQL from backend/schema.sql in the Supabase SQL Editor.', 503);
  if (error.code === '23503') throw bad('That record is linked to other records, so it cannot be changed or deleted.', 409);
  if (error.code === '23514') throw bad('Some values are not allowed. Check the form and try again.');
  if (['22007', '22008', '22P02', '22001'].includes(error.code)) throw bad('Some values are not in the right format. Check the form and try again.');
  console.error('Database error:', error.message);
  throw bad('Something went wrong saving that. Try again.', 500);
}

// The logged-in user's id from their Supabase access token, or null if it's invalid or expired.
// Throws 503 when Supabase itself can't be reached, so an outage never looks like an expired login.
export async function verify(token) {
  const unavailable = () => bad("We can't check your login right now. Try again in a moment.", 503);
  try {
    const { data, error } = await sb.auth.getClaims(token);
    if (error) { if (isAuthRetryableFetchError(error)) throw unavailable(); return null; }
    return data?.claims?.sub ?? null;
  } catch (err) {
    throw err.expose ? err : unavailable();
  }
}

// Supabase returns at most 1000 rows per request, so page through.
// Order by a unique combination, or rows sharing a timestamp can repeat or vanish at a page boundary.
async function all(owner, table, ...orderBy) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const page = await run(orderBy.reduce((q, col) => q.order(col), sb.from(table).select('*').eq('owner_id', owner)).range(from, from + 999));
    rows.push(...page);
    if (page.length < 1000) return rows.map(fromRow);
  }
}

export const list = (owner, c) => all(owner, c, 'created_at', 'id');
export const get = async (owner, c, id) => {
  if (!isId(id)) return undefined;
  const [row] = await run(sb.from(c).select('*').eq('owner_id', owner).eq('id', id));
  return row && fromRow(row);
};
export const create = async (owner, c, data) => fromRow(await run(sb.from(c).insert(toRow({ ...data, ownerId: owner })).select().single()));
export const update = async (owner, c, id, data) => {
  if (!isId(id)) return null;
  const [row] = await run(sb.from(c).update(toRow(data)).eq('owner_id', owner).eq('id', id).select());
  return row ? fromRow(row) : null;
};
export const remove = async (owner, c, id) => isId(id) && (await run(sb.from(c).delete().eq('owner_id', owner).eq('id', id).select('id'))).length > 0;

// ponytail: loads the owner's whole dataset for reports; move the sums into SQL views if accounts get large.
export async function snapshot(owner) {
  const [properties, tenants, rentPayments] = await Promise.all([list(owner, 'properties'), list(owner, 'tenants'), all(owner, 'rent_payments', 'paid_at', 'tenant_id', 'year', 'month')]);
  return { properties, tenants, rentPayments };
}

// Every account's id and email, for the daily digest.
export async function owners() {
  const out = [];
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    out.push(...data.users.filter((u) => u.email).map((u) => ({ id: u.id, email: u.email })));
    if (data.users.length < 1000) return out;
  }
}

// Nena's activity log: every change she made after the owner confirmed it.
export const logAction = (owner, tool, args, summary) => run(sb.from('nena_actions').insert({ owner_id: owner, tool, args, summary }));
export const recentActions = async (owner, limit) =>
  (await run(sb.from('nena_actions').select('*').eq('owner_id', owner).order('created_at', { ascending: false }).limit(limit))).map(fromRow);

// Callers must check the tenant belongs to this owner first (store.get).
export const setPaid = (owner, tenantId, year, month, paid, amount) => setPaidMany(owner, tenantId, [{ year, month }], paid, amount);

// One upsert for any number of months (catching a tenant up); unticking deletes each month.
export async function setPaidMany(owner, tenantId, months, paid, amount) {
  if (paid) {
    const paidAt = new Date().toISOString();
    await run(sb.from('rent_payments').upsert(months.map(({ year, month }) => toRow({ ownerId: owner, tenantId, year, month, amount, paidAt }))));
  } else {
    await Promise.all(months.map(({ year, month }) => run(sb.from('rent_payments').delete().match({ owner_id: owner, tenant_id: tenantId, year, month }))));
  }
}

// Removes the account and everything it owns. Children go first: tenants can't outlive their property.
export async function deleteAccount(owner) {
  for (const table of ['rent_payments', 'nena_actions', 'tenants', 'properties']) await run(sb.from(table).delete().eq('owner_id', owner));
  const { error } = await sb.auth.admin.deleteUser(owner);
  if (error) throw bad("We couldn't finish deleting your account. Try again.", 500);
}
