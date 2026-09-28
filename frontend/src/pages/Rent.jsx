// Rent tracker: one table per property, tenants down the side, months across, a checkbox when paid.
import { useEffect, useRef, useState } from 'react';
import { api, clearHashParams, hashParam, money, today, useApi } from '../api.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Rent() {
  const thisYear = Number(today().slice(0, 4));
  const nowIndex = thisYear * 12 + Number(today().slice(5, 7)) - 1;
  const [year, setYear] = useState(thisYear);
  const [grid, reload] = useApi(`/rent?year=${year}`);
  const [saving, setSaving] = useState({}); // "tenantId:month" -> the value being saved
  const [error, setError] = useState('');
  const linked = useRef(hashParam('property')); // "#payments?property=…" (from Nena) scrolls to it
  useEffect(() => {
    clearHashParams();
    const el = grid?.properties && linked.current && document.getElementById(`property-${linked.current}`);
    if (el) { linked.current = null; el.scrollIntoView({ block: 'start' }); }
  }, [grid]);

  async function toggle(tenant, month, paid) {
    const key = `${tenant.id}:${month}`;
    setSaving((s) => ({ ...s, [key]: paid }));
    setError('');
    try {
      await api(`/rent/${tenant.id}/${year}/${month}`, { method: 'PUT', body: { paid } });
      await reload();
    } catch (err) {
      setError(`Couldn't save ${tenant.name}'s ${MONTHS[month - 1]} payment. ${err.message}`);
    } finally {
      setSaving(({ [key]: _, ...rest }) => rest);
    }
  }

  return (
    <>
      <div className="year-nav">
        <button className="btn" aria-label="Previous year" onClick={() => setYear(year - 1)}>‹</button>
        <strong aria-live="polite">{year}</strong>
        <button className="btn" aria-label="Next year" onClick={() => setYear(year + 1)}>›</button>
        {year !== thisYear && <button className="btn sm" onClick={() => setYear(thisYear)}>This year</button>}
        <span className="muted legend"><span className="swatch" /> past month not yet paid</span>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {!grid && <p className="muted">Loading…</p>}
      {Array.isArray(grid) && <p className="error">Couldn't load the rent tracker. Check that the backend is running.</p>}
      {grid?.properties?.length === 0 && <p className="empty">No properties yet. Add one under Properties, then add tenants from the Dashboard.</p>}
      {grid?.properties?.map((p) => (
        <section className="card" key={p.id} id={`property-${p.id}`}>
          <header className="card-head">
            <h2>{p.name}</h2>
            <span className="muted">{p.type}{p.capacity ? ` · ${p.tenants.length} of ${p.capacity} occupied` : ''}</span>
          </header>
          {!p.tenants.length ? (
            <p className="empty">No tenants here yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="rent-grid">
                <thead>
                  <tr>
                    <th scope="col">Tenant</th>
                    {MONTHS.map((m) => <th key={m} scope="col" className="center">{m}</th>)}
                    <th scope="col" className="num">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {p.tenants.map((t) => {
                    const paid = new Set(t.paid);
                    return (
                      <tr key={t.id}>
                        <th scope="row">
                          {t.name}
                          {t.monthlyRent > 0 && <small className="muted block">{money(t.monthlyRent)}/mo</small>}
                        </th>
                        {MONTHS.map((m, i) => {
                          const index = year * 12 + i, key = `${t.id}:${i + 1}`;
                          if (index < t.startMonth) return <td key={m} className="center muted" title="Before move-in">–</td>;
                          const checked = saving[key] ?? paid.has(i + 1);
                          const overdue = !checked && index < nowIndex;
                          return (
                            <td key={m} className={`center ${overdue ? 'cell-overdue' : ''}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={key in saving}
                                onChange={(e) => toggle(t, i + 1, e.target.checked)}
                                aria-label={`${t.name}, ${m} ${year} paid`}
                              />
                            </td>
                          );
                        })}
                        <td className="num">{t.paid.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </>
  );
}
