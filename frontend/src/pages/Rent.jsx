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
  const root = useRef(null);
  const linked = useRef(hashParam('property')); // "#payments?property=…" (from Nena) scrolls to it

  useEffect(() => {
    if (!grid) return;
    clearHashParams();
    // Open scrolled to the current month so it's visible on phones.
    root.current?.querySelectorAll('.table-wrap').forEach((wrap) => {
      const now = wrap.querySelector('th.now'), who = wrap.querySelector('th.who');
      if (now && who) wrap.scrollLeft = now.offsetLeft - who.offsetWidth - 4 * now.offsetWidth;
    });
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
    <div ref={root}>
      <div className="year-nav">
        <button className="btn" aria-label="Previous year" onClick={() => setYear(year - 1)}><Icon d={I.left} /></button>
        <strong aria-live="polite">{year}</strong>
        <button className="btn" aria-label="Next year" onClick={() => setYear(year + 1)}><Icon d={I.right} /></button>
        <button className="chip soft" onClick={() => setYear(thisYear)} disabled={year === thisYear}>This year</button>
        <span className="legend"><span className="swatch" />past month not yet paid</span>
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
            <>
              <div className="table-wrap">
                <table className="rent-grid">
                  <thead>
                    <tr>
                      <th scope="col" className="who">Tenant</th>
                      {MONTHS.map((m, i) => <th key={m} scope="col" className={`month ${year * 12 + i === nowIndex ? 'now' : ''}`}>{m}</th>)}
                      <th scope="col" className="count">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.tenants.map((t) => {
                      const paid = new Set(t.paid);
                      return (
                        <tr key={t.id}>
                          <th scope="row" className="who">
                            {t.name}
                            <small>
                              {t.monthlyRent > 0 && `${money(t.monthlyRent)}/mo`}
                              {t.monthsBehind > 0 && <span className="behind block">{t.monthsBehind} month{t.monthsBehind > 1 ? 's' : ''} behind</span>}
                            </small>
                          </th>
                          {MONTHS.map((m, i) => {
                            const index = year * 12 + i, key = `${t.id}:${i + 1}`;
                            if (index < t.startMonth) return <td key={m} className="before" title="Before move-in">–</td>;
                            const checked = ticks[key] ?? paid.has(i + 1);
                            const overdue = !checked && index < nowIndex;
                            return (
                              <td key={m} className={`${overdue ? 'overdue' : ''} ${key in ticks ? 'saving' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={key in ticks}
                                  onChange={(e) => toggle(t, i + 1, e.target.checked)}
                                  aria-label={`${t.name}, ${m} ${year} paid`}
                                />
                              </td>
                            );
                          })}
                          <td className="count">{t.paid.length}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="grid-hint">Swipe for more months and the Paid count →</p>
            </>
          )}
        </section>
      ))}
    </div>
  );
}
