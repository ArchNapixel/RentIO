// Daily overdue-rent email to each owner, sent through Resend (https://resend.com).
// Off unless RESEND_API_KEY is set. Run once by hand: npm run digest
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as store from './store.js';
import { overdueDigest, today } from './reports.js';

const { RESEND_API_KEY, DIGEST_FROM = 'RentIO <onboarding@resend.dev>', DIGEST_HOUR = '8' } = process.env;

export async function sendDigests() {
  let sent = 0;
  for (const owner of await store.owners()) {
    const mail = overdueDigest(await store.snapshot(owner.id));
    if (!mail) continue;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: DIGEST_FROM, to: owner.email, ...mail }),
    });
    if (res.ok) sent++;
    else console.error(`Digest to ${owner.email} failed:`, await res.text()); // keep going for the other owners
  }
  return sent;
}

// ponytail: in-process timer, only fires while this server runs, and a restart during the digest hour sends again.
// Move to a hosted cron (Supabase pg_cron, Render cron) calling sendDigests once the backend is deployed.
export function scheduleDigests() {
  if (!RESEND_API_KEY) return;
  let lastSent = '';
  setInterval(async () => {
    if (new Date().getHours() !== Number(DIGEST_HOUR) || lastSent === today()) return;
    lastSent = today();
    try { console.log(`Digest: sent ${await sendDigests()} email(s)`); } catch (err) { console.error('Digest failed:', err.message); }
  }, 10 * 60_000).unref();
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (!RESEND_API_KEY) throw new Error('Set RESEND_API_KEY in backend/.env');
  console.log(`Sent ${await sendDigests()} email(s)`);
}
