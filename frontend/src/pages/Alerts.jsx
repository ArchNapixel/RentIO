import { useEffect, useState } from 'react';
import { api, useApi } from '../api.js';
import { I, Icon } from '../components/Icons.jsx';
import { LoadError, Loading } from '../components/States.jsx';

const SEEN_KEY = 'rentio-notified';
const supported = 'Notification' in window;

// ponytail: browser notifications while the app is open. Real push (service worker + web-push) comes with the mobile app.
export function useAlertNotifier(enabled = true) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled]);
  return count;
}

const ALERT_ICON = { 'Overdue rent': I.alert, 'Not yet paid': I.clock, Vacancy: I.building };
const SEVERITY = { high: 'High', medium: 'Medium', low: 'Low' };

export default function Alerts() {
  const [alerts, reload, error] = useApi('/reports/alerts');
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported');

  return (
    <>
      <section className="card notif">
        <div className="notif-row">
          <span><strong>Notifications</strong>{permission === 'granted' && <span className="muted block small">On for this phone</span>}</span>
          {permission === 'granted' && <span className="paid" style={{ fontWeight: 600 }}>✓ On</span>}
        </div>
        {permission === 'default' && (
          <>
            <p>Get a heads-up on this phone when someone falls behind.</p>
            <button className="btn primary block" onClick={() => Notification.requestPermission().then(setPermission)}><Icon d={I.bell} />Turn on notifications</button>
          </>
        )}
        {permission === 'denied' && <p><strong>Blocked.</strong> Allow notifications for RentIO in your phone's Settings › Apps, then come back.</p>}
        {permission === 'unsupported' && <p><strong>Not supported.</strong> This browser can't show notifications. Alerts still appear here.</p>}
      </section>

      {error && !alerts && <LoadError what="your alerts" onRetry={reload} />}
      {!alerts && !error && <Loading rows={2} />}
      {alerts?.length === 0 && (
        <div className="state center">
          <span className="icon paid"><Icon d={I.check} /></span>
          <h2>All clear.</h2>
          <p>Nobody is behind on rent.</p>
        </div>
      )}
      {alerts?.length > 0 && (
        <>
          <p className="section-label">{alerts.length} alert{alerts.length > 1 ? 's' : ''}</p>
          <ul className="card list alerts">
            {alerts.map((a) => (
              <li key={a.id}>
                <span className={`alert-icon ${a.severity}`}><Icon d={ALERT_ICON[a.type] ?? I.alert} /></span>
                <span className="grow">
                  <span className="title">{a.type}<span className={`pill ${a.severity}`}>{SEVERITY[a.severity]}</span></span>
                  <span>{a.message}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
