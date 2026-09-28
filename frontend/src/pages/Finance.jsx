import { money, useApi } from '../api.js';
import { Stat } from '../components/Table.jsx';

export default function Finance() {
  const [f] = useApi('/reports/finance');
  if (!f) return <p className="muted">Loading…</p>;
  if (!f.totals) return <p className="error">Couldn't load finances. Check that the backend is running.</p>;

  return (
    <>
      <div className="row-actions page-actions">
        <button className="btn" onClick={() => window.print()}>Print / Save PDF</button>
      </div>
      <div className="stats">
        <Stat label="Rent collected (12 months)" value={money(f.totals.income)} />
        <Stat label="Expected rent per month" value={money(f.totals.expectedMonthly)} note="From current tenants" />
      </div>
    </>
  );
}
