import { money, useApi } from '../api.js';
import Table, { Stat, col } from '../components/Table.jsx';

const MONTH_NAME = new Date().toLocaleString('en-PH', { month: 'long' });

export default function Dashboard({ guest }) {
  const [d] = useApi(guest ? '/demo/dashboard' : '/reports/dashboard');
  if (!d) return <p className="muted">Loading…</p>;
  if (Array.isArray(d)) return <p className="error">Couldn't load the dashboard. Check that the backend is running on port 4000.</p>;

  return (
    <>
      {guest && <p className="demo-note">You're looking at sample data. Sign up to add your own properties and tenants.</p>}
      <div className="stats">
        <Stat label={`Paid for ${MONTH_NAME}`} value={`${d.paidThisMonth} of ${d.tenants}`} />
        <Stat label="Collected this month" value={money(d.collectedThisMonth)} note={`of ${money(d.expectedThisMonth)}`} />
        {d.capacity > 0 && <Stat label="Beds occupied" value={`${d.occupiedBeds} of ${d.capacity}`} />}
      </div>
      <section className="card">
        <h2>Properties</h2>
        <Table
          columns={[
            col('Property', 'name'), col('Type', 'type'),
            { label: `Paid for ${MONTH_NAME}`, num: true, get: (r) => `${r.paidThisMonth} of ${r.tenants}` },
          ]}
          rows={d.perProperty}
          empty="No properties yet. Add one under Properties."
        />
      </section>
    </>
  );
}
