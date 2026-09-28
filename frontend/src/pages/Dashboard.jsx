import { money, pct, useApi } from '../api.js';
import Table, { Stat, col } from '../components/Table.jsx';

export default function Dashboard() {
  const [d] = useApi('/reports/dashboard');
  if (!d) return <p className="muted">Loading…</p>;
  if (Array.isArray(d)) return <p className="error">Couldn't load the dashboard. Check that the backend is running on port 4000.</p>;

  return (
    <>
      <div className="stats">
        <Stat label="Occupancy" value={pct(d.occupancyRate)} note={`${d.occupied} of ${d.units} units occupied`} />
        <Stat label="Vacant units" value={d.vacant} note={`Across ${d.properties} properties`} />
        <Stat label="Collected this month" value={money(d.monthIncome)} note={`Collection rate ${pct(d.collectionRate)}`} />
        <Stat label="Expenses this month" value={money(d.monthExpenses)} />
        <Stat label="Overdue rent" value={money(d.overdue)} tone={d.overdue > 0 ? 'bad' : undefined} />
      </div>
      <section className="card">
        <h2>Portfolio</h2>
        <Table
          columns={[col('Property', 'name'), col('Units', 'units', true), col('Occupied', 'occupied', true), col('Vacant', 'vacant', true), { label: 'Occupancy', num: true, get: (r) => pct(r.occupancy) }]}
          rows={d.perProperty}
          empty="No properties yet. Add one under Properties."
        />
      </section>
      <section className="card">
        <h2>Leases expiring in the next 90 days</h2>
        <Table
          columns={[col('Tenant', 'tenant'), col('Unit', 'unit'), col('Ends', 'endDate'), col('Days left', 'daysLeft', true), col('Renewal', 'renewalStatus')]}
          rows={d.expiring}
          empty="No leases expire in the next 90 days."
        />
      </section>
    </>
  );
}
