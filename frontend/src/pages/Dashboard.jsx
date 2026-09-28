import { money, pct, useApi } from '../api.js';
import QuickActions from '../components/QuickActions.jsx';
import Table, { Stat, col } from '../components/Table.jsx';

export default function Dashboard() {
  const [d, reload] = useApi('/reports/dashboard');
  return (
    <>
      <DashboardBody d={d} />
      <QuickActions hint={assistantHint(d)} onSaved={reload} />
    </>
  );
}

// What the assistant says in its speech bubble: the most urgent thing first.
function assistantHint(d) {
  if (!d || Array.isArray(d)) return "Hi! I'm Nena, your RentIO assistant. Tap here to chat.";
  if (d.properties === 0) return "Hi! I'm Nena, your RentIO assistant. Add your first property, or tap here to ask me anything.";
  if (d.overdue > 0) return `Heads up: ${money(d.overdue)} in rent is overdue. Tap to ask me who owes it.`;
  if (d.expiring.length) return `${d.expiring.length} lease${d.expiring.length > 1 ? 's expire' : ' expires'} in the next 90 days. Want the details?`;
  if (d.vacant > 0) return `You have ${d.vacant} vacant unit${d.vacant > 1 ? 's' : ''}. Tap to chat about it.`;
  return 'All good: no overdue rent or upcoming expiries. Ask me anything.';
}

function DashboardBody({ d }) {
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
