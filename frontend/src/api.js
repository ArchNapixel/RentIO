import { useCallback, useEffect, useState } from 'react';

const CURRENCY = 'PHP';
const LOCALE = 'en-PH';

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body && JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Couldn't reach the server (${res.status}). Is the backend running?`);
  return data;
}

export function useApi(path) {
  const [data, setData] = useState(null);
  const load = useCallback(() => api(path).then(setData, () => setData([])), [path]);
  useEffect(() => { load(); }, [load]);
  return [data, load];
}

// id -> display label for everything a form can reference
export function useLookups() {
  const [lookups, setLookups] = useState({});
  const load = useCallback(async () => {
    const [properties, units, tenants, leases] = await Promise.all(['properties', 'units', 'tenants', 'leases'].map((c) => api('/' + c)));
    const names = (rows) => Object.fromEntries(rows.map((r) => [r.id, r.name]));
    const p = names(properties), t = names(tenants);
    const u = Object.fromEntries(units.map((x) => [x.id, `${p[x.propertyId] ?? '?'} · ${x.name}`]));
    setLookups({ properties: p, tenants: t, units: u, leases: Object.fromEntries(leases.map((l) => [l.id, `${t[l.tenantId] ?? '?'} · ${u[l.unitId] ?? '?'}`])) });
  }, []);
  useEffect(() => { load().catch(() => {}); }, [load]);
  return [lookups, load];
}

export const money = (n) => (Number(n) || 0).toLocaleString(LOCALE, { style: 'currency', currency: CURRENCY });
export const pct = (n) => (n == null ? '—' : `${n}%`);
export const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
