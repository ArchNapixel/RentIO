import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { exportCsv, route } from './local.js';

const CURRENCY = 'PHP';
const LOCALE = 'en-PH';

// Same call shape the server API had; it now reads and writes the phone's own storage (see local.js).
export async function api(path, { method = 'GET', body } = {}) {
  return route(path, method, body);
}

// CSV export: written on the phone, then saved (browser) or handed to the share sheet (Android).
export async function download(name, filename) {
  const blob = new Blob([exportCsv(name)], { type: 'text/csv' });
  const file = new File([blob], filename, { type: 'text/csv' });
  // The Android app's web view can't save downloaded links, so it hands the file to the phone's share sheet instead.
  if (Capacitor.isNativePlatform() && navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file], title: filename }).catch(() => {});
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000); // revoking right away can cancel the download
}

// [data, reload, error]. data stays null until loaded; error is a message when the request failed.
export function useApi(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const latest = useRef(0); // only the newest request may update the screen (a slow old one must not overwrite it)
  const load = useCallback(() => {
    const mine = ++latest.current;
    return api(path).then(
      (d) => { if (mine === latest.current) { setData(d); setError(null); } },
      (err) => { if (mine === latest.current) setError(err.message); },
    );
  }, [path]);
  useEffect(() => { if (path) load(); }, [load, path]); // null path = don't fetch
  return [data, load, error];
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
