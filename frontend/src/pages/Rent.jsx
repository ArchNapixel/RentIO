// Rent tracker: one card per property, tenants down the side, Jan–Dec across, a checkbox per month.
import { useEffect, useRef, useState } from 'react';
import { api, clearHashParams, hashParam, money, today, useApi } from '../api.js';
import { I, Icon } from '../components/Icons.jsx';
import { Empty, LoadError, Loading } from '../components/States.jsx';
import { toast } from '../components/Toasts.jsx';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Rent() {
  const thisYear = Number(today().slice(0, 4));
  const nowIndex = thisYear * 12 + Number(today().slice(5, 7)) - 1;
  const [year, setYear] = useState(thisYear);
  const [grid, reload, error] = useApi(`/rent?year=${year}`);
  const [ticks, setTicks] = useState({}); // "tenantId:month" -> value shown while saving (optimistic)
  const linked = useRef(hashParam('property')); // "#payments?property=…" (from Nena) scrolls to it

  useEffect(() => {
    if (!grid) return;
    clearHashParams();
    const el = linked.current && document.getElementById(`property-${linked.current}`);
    if (el) { linked.current = null; el.scrollIntoView({ block: 'start' }); }
  }, [grid]);

  async function toggle(tenant, month, paid, undoable = true) {
    const key = `${tenant.id}:${month}`;
    const label = `${MONTHS[month - 1]} ${year}`;
    setTicks((s) => ({ ...s, [key]: paid }));
    try {
      await api(`/rent/${tenant.id}/${year}/${month}`, { method: 'PUT', body: { paid } });
      await reload();
      if (undoable) toast({ text: `${tenant.name} · ${label} marked ${paid ? 'paid' : 'not paid'}`, action: 'Undo', onAction: () => toggle(tenant, month, !paid, false) });
    } catch {
      toast({ text: `Couldn't save ${MONTHS[month - 1]} for ${tenant.name}.`, action: 'Try again', onAction: () => toggle(tenant, month, paid, undoable), error: true });
    } finally {
      setTicks(({ [key]: _, ...rest }) => rest); // reverts the box if saving failed
    }
  }

  if (error && !grid) return <LoadError what="the rent tracker" onRetry={reload} />;

  return (
    <div>
      <div className="year-nav">
        <button className="btn" aria-label="Previous year" onClick={() => setYear(year - 1)}><Icon d={I.left} /></button>
        <strong aria-live="polite">{year}</strong>
        <button className="btn" aria-label="Next year" onClick={() => setYear(year + 1)}><Icon d={I.right} /></button>
        <button className="chip soft" onClick={() => setYear(thisYear)} disabled={year === thisYear}>This year</button>
      </div>
      {!grid && <Loading rows={2} />}
      {grid?.properties.length === 0 && (
        <Empty title="No properties yet." action={<a className="btn primary sm" href="#properties">Go to Properties</a>}>
          Add a property, then add tenants from Nena's menu. Their months show up here.
        </Empty>
      )}
      {grid?.properties.map((p) => (
        <section className="card grid-card" key={p.id} id={`property-${p.id}`}>
          <header>
            <h2>{p.name}</h2>
            <p>{p.type} · {p.capacity ? `${p.tenants.length} of ${p.capacity} occupied` : `${p.tenants.length} tenant${p.tenants.length === 1 ? '' : 's'}`}</p>
          </header>
          {!p.tenants.length ? (
            <p className="state muted">No tenants here yet.</p>
          ) : (
            <ul className="list">
              {p.tenants.map((t) => {
                const paid = new Set(t.paid);
                const nowPaid = year === thisYear && (ticks[`${t.id}:${nowIndex % 12 + 1}`] ?? paid.has(nowIndex % 12 + 1));
                const status = t.monthsBehind > 0
                  ? <span className="owed">{t.monthsBehind} month{t.monthsBehind > 1 ? 's' : ''} behind</span>
                  : year === thisYear && nowIndex >= t.startMonth
                    ? <span className={nowPaid ? 'paid' : 'muted'}>{MONTHS[nowIndex % 12]} {nowPaid ? 'paid' : 'due'}</span>
                    : null;
                return (
                  <li key={t.id} className="rent-row">
                    <div className="rent-who">
                      <span className="grow"><span className="title">{t.name}</span>{t.monthlyRent > 0 && <span className="sub">{money(t.monthlyRent)}/mo</span>}</span>
                      <span className="small end">{status}</span>
                    </div>
                    <div className="months">
                      {MONTHS.map((m, i) => {
                        const index = year * 12 + i, key = `${t.id}:${i + 1}`;
                        const checked = ticks[key] ?? paid.has(i + 1);
                        const state = index < t.startMonth ? 'before' : checked ? 'on' : index < nowIndex ? 'overdue' : '';
                        return (
                          <button
                            key={m}
                            className={`month-dot ${state} ${index === nowIndex ? 'now' : ''}`}
                            aria-pressed={checked}
                            aria-label={`${t.name}, ${m} ${year} paid`}
                            title={state === 'before' ? 'Before move-in' : `${m} ${year}`}
                            disabled={state === 'before' || key in ticks}
                            onClick={() => toggle(t, i + 1, !checked)}
                          >{m[0]}</button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
