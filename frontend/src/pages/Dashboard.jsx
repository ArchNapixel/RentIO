import { money, useApi } from '../api.js';
import { I, Icon } from '../components/Icons.jsx';
import { Empty, LoadError, Loading } from '../components/States.jsx';
import { Stat } from '../components/Table.jsx';

const MONTH = new Date().toLocaleString('en-PH', { month: 'long' });
const MON = new Date().toLocaleString('en-PH', { month: 'short' });

export default function Dashboard({ guest }) {
  const [d, reload, error] = useApi(guest ? '/demo/dashboard' : '/reports/dashboard');
  if (error && !d) return <LoadError what="your summary" onRetry={reload} />;
  if (!d) return <Loading />;
  if (d.properties === 0) {
    return (
      <Empty title="No properties yet." action={<a className="btn primary sm" href="#properties">Go to Properties</a>}>
        Add one under Properties. Your rent summary shows up here once you have tenants.
      </Empty>
    );
  }

  return (
    <>
      {guest && <p className="box info demo-note"><Icon d={I.alert} />You're looking at sample data. Sign up to add your own properties and tenants.</p>}
      <div className="stats">
        <Stat wide label="Collected this month" value={money(d.collectedThisMonth)} of={money(d.expectedThisMonth)} progress={d.expectedThisMonth ? d.collectedThisMonth / d.expectedThisMonth : 0} />
        <Stat label={`Paid for ${MONTH}`} value={d.paidThisMonth} of={d.tenants} />
        {d.capacity > 0 && <Stat label="Beds occupied" value={d.occupiedBeds} of={d.capacity} />}
      </div>
      <h2 className="section-label">Properties</h2>
      <ul className="card list">
        {d.perProperty.map((p) => (
          <li key={p.id}>
            <span className="grow"><span className="title">{p.name}</span><span className="sub">{p.type}</span></span>
            <span className="end"><strong>{p.paidThisMonth} of {p.tenants}</strong><span className="sub">paid for {MON}</span></span>
          </li>
        ))}
      </ul>
    </>
  );
}
