import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase.js';

const CURRENCY = 'PHP';
const LOCALE = 'en-PH';
// The installed app has no dev proxy, so it needs the backend's full address at build time. On the web, /api is proxied.
const BASE = import.meta.env.VITE_API_URL ?? '';

// Every request carries the logged-in owner's token; the backend only returns their data.
async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

async function request(path, init = {}) {
  let res;
  try {
    res = await fetch(BASE + '/api' + path, { ...init, headers: { ...(await authHeader()), ...init.headers }, signal: AbortSignal.timeout(path.startsWith('/ai/') ? 90_000 : 20_000) });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  if (res.status === 401) { // expired session: back to the login screen, which explains why
    try { sessionStorage.setItem('rentio-expired', '1'); } catch { /* storage blocked */ }
    supabase.auth.signOut();
  }
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
  const blob = await res.blob();
  const file = new File([blob], filename, { type: blob.type || 'text/csv' });
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
