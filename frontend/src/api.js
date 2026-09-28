import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const CURRENCY = 'PHP';
const LOCALE = 'en-PH';

// Every request carries the logged-in owner's token; the backend only returns their data.
async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

async function request(path, init = {}) {
  const res = await fetch('/api' + path, { ...init, headers: { ...(await authHeader()), ...init.headers } });
  if (res.status === 401) supabase.auth.signOut(); // expired session: back to the login screen
  return res;
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await request(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body && JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Couldn't reach the server (${res.status}). Is the backend running?`);
  return data;
}

// File downloads (CSV) need the login token too, so they can't be plain links.
export async function download(path, filename) {
  const res = await request(path);
  if (!res.ok) throw new Error("Couldn't download the file. Try again.");
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await res.blob()), download: filename });
  a.click();
  URL.revokeObjectURL(a.href);
}

export function useApi(path) {
  const [data, setData] = useState(null);
  const load = useCallback(() => api(path).then(setData, () => setData([])), [path]);
  useEffect(() => { if (path) load(); }, [load, path]); // null path = don't fetch
  return [data, load];
}

// id -> display label for everything a form can reference
export function useLookups() {
  const [lookups, setLookups] = useState({});
  const load = useCallback(async () => {
    const [properties, tenants] = await Promise.all(['properties', 'tenants'].map((c) => api('/' + c)));
    const names = (rows) => Object.fromEntries(rows.map((r) => [r.id, r.name]));
    setLookups({ properties: names(properties), tenants: names(tenants) });
  }, []);
  useEffect(() => { load().catch(() => {}); }, [load]);
  return [lookups, load];
}

// "#tenants?id=…" deep links (used by Nena to open a tenant or property).
export const hashParam = (key) => new URLSearchParams(location.hash.split('?')[1] ?? '').get(key);
export const clearHashParams = () => history.replaceState(null, '', location.hash.split('?')[0]);

export const money =(n) => (Number(n) || 0).toLocaleString(LOCALE, { style: 'currency', currency: CURRENCY });
export const pct = (n) => (n == null ? '—' : `${n}%`);
export const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
