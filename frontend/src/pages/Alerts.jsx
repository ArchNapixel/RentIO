import { useEffect, useState } from 'react';
import { api, money, useApi } from '../api.js';
import { I, Icon } from '../components/Icons.jsx';
import { LoadError, Loading } from '../components/States.jsx';
import { askNotifyPermission, notify, notifyPermission } from '../notify.js';
import { payMonths, tel } from '../pay.js';

const SEEN_KEY = 'rentio-notified';

// The badge and the notifications both mean "someone is overdue". Tenants who just haven't paid yet this month aren't worth a buzz.
export function useAlertNotifier(enabled = true) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    async function check() {
      try {
        const overdue = (await api('/reports/alerts')).filter((a) => a.type === 'Overdue rent');
        setCount(overdue.length);
        if ((await notifyPermission()) !== 'granted') return;
        let seen = [];
        try { seen = JSON.parse(localStorage.getItem(SEEN_KEY)) ?? []; } catch { /* storage blocked */ }
        for (const a of overdue) if (!seen.includes(a.id)) await notify(a.id, 'RentIO · Overdue rent', a.message).catch(() => {});
        try { localStorage.setItem(SEEN_KEY, JSON.stringify(overdue.map((a) => a.id))); } catch { /* storage blocked */ }
      } catch { /* backend offline; next tick retries */ }
    }
    check();
    const timer = setInterval(check, 5 * 60_000);
    return () => clearInterval(timer);
  }, [enabled]);
  return count;
}

const MONTH = new Date().toLocaleString('en-PH', { month: 'long' });

// Overdue tenants come first as rows you can act on; everyone merely "not paid yet" and open spots are one quiet line each.
export default function Alerts() {
  const [alerts, reload, error] = useApi('/reports/alerts');
  const [permission, setPermission] = useState(null); // null until we've asked the phone
  useEffect(() => { notifyPermission().then(setPermission).catch(() => setPermission('unsupported')); }, []);
  const [paying, setPaying] = useState({}); // tenantId -> true while saving (row hides right away)

  async function pay(a) {
    setPaying((s) => ({ ...s, [a.tenantId]: true }));
    await payMonths({ id: a.tenantId, name: a.name }, a.due, reload);
    setPaying(({ [a.tenantId]: _, ...rest }) => rest);
  }

  const notif = permission && (
    <section className="card notif">
      <div className="notif-row">
        <span><strong>Notifications</strong>{permission === 'granted' && <span className="muted block small">On for this phone</span>}</span>
        {permission === 'granted' && <span className="paid" style={{ fontWeight: 600 }}>✓ On</span>}
      </div>
      {permission === 'default' && (
        <>
          <p>Get a heads-up on this phone when someone falls behind.</p>
          <button className="btn primary block" onClick={() => askNotifyPermission().then(setPermission).catch(() => setPermission('denied'))}><Icon d={I.bell} />Turn on notifications</button>
        </>
      )}
      {permission === 'denied' && <p><strong>Blocked.</strong> Allow notifications for RentIO in your phone's Settings › Apps, then come back.</p>}
      {permission === 'unsupported' && <p><strong>Not supported.</strong> This device can't show notifications. Alerts still appear here.</p>}
    </section>
  );

  const overdue = (alerts ?? []).filter((a) => a.type === 'Overdue rent' && !paying[a.tenantId]);
  const unpaid = (alerts ?? []).filter((a) => a.type === 'Not yet paid' && !paying[a.tenantId]);
  const vacancies = (alerts ?? []).filter((a) => a.type === 'Vacancy');
  const owed = overdue.reduce((sum, a) => sum + a.balance, 0);

  return (
    <>
      {permission === 'default' && notif}

      {error && !alerts && <LoadError what="your alerts" onRetry={reload} />}
      {!alerts && !error && <Loading rows={2} />}
      {alerts && overdue.length === 0 && unpaid.length === 0 && (
        <div className="state center">
          <span className="icon paid"><Icon d={I.check} /></span>
          <h2>All clear.</h2>
          <p>Nobody is behind on rent.</p>
        </div>
      )}
      {overdue.length > 0 && (
        <>
          <p className="section-label">{overdue.length} tenant{overdue.length > 1 ? 's' : ''} behind{owed > 0 && ` · ${money(owed)}`}</p>
          <ul className="card list alerts">
            {overdue.map((a) => {
              const rent = a.monthlyRent || 0;
              return (
                <li key={a.id} className="tap alert-row">
                  <button className="row-btn" onClick={() => { location.hash = `tenants?id=${a.tenantId}`; }}>
                    <span className={`alert-icon ${a.severity}`}><Icon d={I.alert} /></span>
                    <span className="grow">
                      <span className="title">{a.name}<span className={`pill ${a.severity}`}>{a.severity === 'high' ? 'High' : 'Medium'}</span></span>
                      <span className="sub">{a.property} · {a.months}</span>
                    </span>
                  </button>
                  <div className="alert-actions">
                    <button className="btn primary sm" onClick={() => pay(a)}>
                      {a.due.length > 1 ? `Pay ${a.due.length} months` : 'Mark paid'}{rent > 0 && ` · ${money(a.due.length * rent)}`}
                    </button>
                    {a.phone && <a className="btn sm" href={`tel:${tel(a.phone)}`}>Call</a>}
                    {a.phone && <a className="btn sm" href={`sms:${tel(a.phone)}`}>Text</a>}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {unpaid.length > 0 && (
        <ul className="card list alerts">
          <li className="tap">
            <button className="row-btn" onClick={() => { location.hash = 'payments'; }}>
              <span className="alert-icon"><Icon d={I.clock} /></span>
              <span className="grow">
                <span className="title">{unpaid.length} haven't paid for {MONTH} yet</span>
                <span className="sub">Open the rent tracker</span>
              </span>
              <Icon d={I.right} />
            </button>
          </li>
        </ul>
      )}
      {vacancies.length > 0 && (
        <p className="muted small vacancies">Open spots: {vacancies.map((v) => `${v.name} (${v.open} of ${v.capacity})`).join(' · ')}</p>
      )}
      {permission !== 'default' && notif}
    </>
  );
}
