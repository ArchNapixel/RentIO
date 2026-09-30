// Rent tracker. "Due now" (default): who still owes, one tap to mark them paid (or catch up every owed month).
// "Full year": one card per property, tenants down the side, Jan–Dec across, a checkbox per month.
import { useEffect, useRef, useState } from 'react';
import { api, clearHashParams, hashParam, money, today, useApi } from '../api.js';
import { I, Icon } from '../components/Icons.jsx';
import { Empty, LoadError, Loading } from '../components/States.jsx';
import { toast } from '../components/Toasts.jsx';
import { MONTHS, monthName, payMonths } from '../pay.js';

export default function Rent() {
  const thisYear = Number(today().slice(0, 4));
  const nowIndex = thisYear * 12 + Number(today().slice(5, 7)) - 1;
  const [year, setYear] = useState(thisYear);
  const [grid, reload, error] = useApi(`/rent?year=${year}`);
  const linked = useRef(hashParam('property')); // "#payments?property=…" (from Nena) scrolls to it
  const [view, setView] = useState(linked.current ? 'year' : 'due'); // every property shows in the full-year view; Due now hides the paid ones
  const [paying, setPaying] = useState({}); // tenantId -> true while a Due-now payment saves (row is hidden optimistically)
  const [ticks, setTicks] = useState({}); // "tenantId:month" -> value shown while saving (optimistic)

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

  async function pay(tenant, months) {
    setPaying((s) => ({ ...s, [tenant.id]: true })); // hides the row right away
    await payMonths(tenant, months, reload);
    setPaying(({ [tenant.id]: _, ...rest }) => rest);
  }

  if (error && !grid) return <LoadError what="the rent tracker" onRetry={reload} />;

  const noProperties = grid?.properties.length === 0;
  const dueGroups = (grid?.properties ?? [])
    .map((p) => ({ ...p, tenants: p.tenants.filter((t) => t.due.length && !paying[t.id]) }))
    .filter((p) => p.tenants.length);
  const anyTenants = grid?.properties.some((p) => p.tenants.length);
  const dueCount = dueGroups.reduce((n, p) => n + p.tenants.length, 0);
  const dueTotal = dueGroups.reduce((sum, p) => sum + p.tenants.reduce((s, t) => s + t.due.length * t.monthlyRent, 0), 0);

  return (
    <div>
      <div className="year-nav">
        <button className={`chip ${view === 'due' ? 'soft' : ''}`} aria-pressed={view === 'due'} onClick={() => setView('due')}>Due now</button>
        <button className={`chip ${view === 'year' ? 'soft' : ''}`} aria-pressed={view === 'year'} onClick={() => setView('year')}>Full year</button>
      </div>
      {view === 'year' && (
        <div className="year-nav">
          <button className="btn" aria-label="Previous year" onClick={() => setYear(year - 1)}><Icon d={I.left} /></button>
          <strong aria-live="polite">{year}</strong>
          <button className="btn" aria-label="Next year" onClick={() => setYear(year + 1)}><Icon d={I.right} /></button>
          <button className="chip soft" onClick={() => setYear(thisYear)} disabled={year === thisYear}>This year</button>
        </div>
      )}
      {(!grid || (view === 'year' && grid.year !== year)) && <Loading rows={2} />}
      {noProperties && (
        <Empty title="No properties yet." action={<a className="btn primary sm" href="#properties">Go to Properties</a>}>
          Add a property, then add tenants from Nena's menu. Their months show up here.
        </Empty>
      )}
      {view === 'due' && grid && !noProperties && (
        !anyTenants ? (
          <Empty icon={I.userPlus} title="No tenants yet.">Add one from Nena's menu and they'll show up here.</Empty>
        ) : !dueCount ? (
          <Empty icon={I.check} title="All paid up.">Everyone has paid through {MONTHS[nowIndex % 12]}.</Empty>
        ) : (
          <>
            <p className="muted small">{dueCount} tenant{dueCount === 1 ? '' : 's'} to collect from{dueTotal > 0 && ` · ${money(dueTotal)}`}</p>
            {dueGroups.map((p) => (
              <section className="card grid-card" key={p.id} id={`property-${p.id}`}>
                <header><h2>{p.name}</h2></header>
                <ul className="list">
                  {p.tenants.map((t) => {
                    const latest = t.due[t.due.length - 1];
                    const many = t.due.length > 1;
                    return (
                      <li key={t.id} className="due-row">
                        <span className="grow">
                          <span className="title">{t.name}</span>
                          <span className="sub">
                            {t.monthlyRent > 0 && `${money(t.monthlyRent)}/mo`}
                            {t.monthsBehind > 0 && <span className="owed">{t.monthlyRent > 0 && ' · '}{t.monthsBehind} month{t.monthsBehind > 1 ? 's' : ''} behind</span>}
                          </span>
                        </span>
                        <span className="pay-actions">
                          <button className="btn primary" onClick={() => pay(t, t.due)}>
                            {many ? `Pay ${t.due.length} months` : 'Mark paid'}{t.monthlyRent > 0 && ` · ${money(t.due.length * t.monthlyRent)}`}
                          </button>
                          {many && <button className="btn ghost sm" onClick={() => pay(t, [latest])}>Just {monthName(latest)}</button>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </>
        )
      )}
      {view === 'year' && grid?.year === year && grid.properties.map((p) => (
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
