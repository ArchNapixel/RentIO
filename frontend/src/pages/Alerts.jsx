import { useEffect, useState } from 'react';
import { api, useApi } from '../api.js';

const SEEN_KEY = 'rentio-notified';
const supported = 'Notification' in window;

// ponytail: browser notifications while the app is open. Real push (service worker + web-push) comes with the mobile app.
export function useAlertNotifier() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    async function check() {
      try {
        const alerts = await api('/reports/alerts');
        setCount(alerts.length);
        if (!supported || Notification.permission !== 'granted') return;
        let seen = [];
        try { seen = JSON.parse(localStorage.getItem(SEEN_KEY)) ?? []; } catch { /* storage blocked */ }
        for (const a of alerts) if (!seen.includes(a.id)) new Notification(`RentIO · ${a.type}`, { body: a.message, tag: a.id });
        try { localStorage.setItem(SEEN_KEY, JSON.stringify(alerts.map((a) => a.id))); } catch { /* storage blocked */ }
      } catch { /* backend offline; next tick retries */ }
    }
    check();
    const timer = setInterval(check, 5 * 60_000);
    return () => clearInterval(timer);
  }, []);
  return count;
}

export default function Alerts() {
  const [alerts] = useApi('/reports/alerts');
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported');

  return (
    <>
      <section className="card">
        <header className="card-head">
          <h2>Notifications</h2>
          {permission === 'default' && <button className="btn primary" onClick={() => Notification.requestPermission().then(setPermission)}>Turn on notifications</button>}
        </header>
        <p className="muted">
          {permission === 'granted' && 'On. RentIO checks every 5 minutes and notifies you of new alerts.'}
          {permission === 'default' && 'Get notified about overdue rent, expiring leases and vacancies.'}
          {permission === 'denied' && 'Blocked. Allow notifications for this site in your browser settings.'}
          {permission === 'unsupported' && "This browser doesn't support notifications."}
        </p>
      </section>
      <section className="card">
        <h2>Active alerts</h2>
        {!alerts && <p className="muted">Loading…</p>}
        {alerts?.length === 0 && <p className="empty">All clear. Nothing overdue, expiring or vacant.</p>}
        <ul className="alerts">
          {alerts?.map((a) => (
            <li key={a.id} className={`alert ${a.severity}`}>
              <strong>{a.type}</strong>
              <span>{a.message}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
