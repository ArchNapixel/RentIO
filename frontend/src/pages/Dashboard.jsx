import { money, useApi } from '../api.js';
import { I, Icon } from '../components/Icons.jsx';
import { Empty, LoadError, Loading } from '../components/States.jsx';
import { Stat } from '../components/Table.jsx';

const monthShort = (ym) => new Date(`${ym}-01T00:00`).toLocaleString('en-PH', { month: 'short' });

// Rent collected per month since the first payment (up to 12). Hidden until the first payment.
function Collected({ monthly }) {
  const first = monthly.findIndex((m) => m.income > 0);
  const months = first < 0 ? [] : monthly.slice(first);
  if (!months.length) return null;
  const top = Math.max(...months.map((m) => m.income));
  const best = months.reduce((a, m) => (m.income > a.income ? m : a));
  const average = months.reduce((s, m) => s + m.income, 0) / months.length;
  return (
    <>
      <h2 className="section-label">Collected per month</h2>
      <section className="card pad">
        <div className="bars" role="img" aria-label={months.map((m) => `${monthShort(m.month)} ${money(m.income)}`).join(', ')}>
          {months.map((m, i) => (
            <span key={m.month} className={`bar ${i === months.length - 1 ? 'now' : ''}`}>
              <i style={{ height: `max(4px, calc((100% - 18px) * ${m.income / top}))` }} />
              <small>{monthShort(m.month)}</small>
            </span>
          ))}
        </div>
        <p className="muted small">{months.length === 1 ? `${money(top)} collected in ${monthShort(best.month)}` : `${money(average)} a month on average · best was ${monthShort(best.month)}`}</p>
      </section>
    </>
  );
}

export default function Dashboard({ guest }) {
  const [d, reload, error] = useApi(guest ? '/demo/dashboard' : '/reports/dashboard');
  const MONTH = new Date().toLocaleString('en-PH', { month: 'long' }); // read on every render, so it's right after midnight too
  const MON = new Date().toLocaleString('en-PH', { month: 'short' });
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
        <Stat wide label="Collected this month" value={money(d.collectedThisMonth)} of={money(d.expectedThisMonth)} progress={d.expectedThisMonth ? d.collectedThisMonth / d.expectedThisMonth : 0} note={`${money(d.collectedLast12Months)} in the last 12 months`} />
        <Stat label={`Paid for ${MONTH}`} value={d.paidThisMonth} of={d.dueTenants} />
        <Stat label="Overdue" value={<span className={d.overdue ? 'owed' : ''}>{money(d.overdue)}</span>} note={d.overdueTenants.length ? `${d.overdueTenants.length} tenant${d.overdueTenants.length > 1 ? 's' : ''} behind` : 'Everyone is up to date'} />
        {d.capacity > 0 && <Stat label="Beds occupied" value={d.occupiedBeds} of={d.capacity} />}
      </div>
      <Collected monthly={d.monthly} />
      <h2 className="section-label">Properties</h2>
      <ul className="card list">
        {d.perProperty.map((p) => (
          <li key={p.id}>
            <span className="grow"><span className="title">{p.name}</span><span className="sub">{p.type}</span></span>
            <span className="end"><strong>{p.paidThisMonth} of {p.dueTenants}</strong><span className="sub">paid for {MON}</span></span>
          </li>
        ))}
      </ul>
    </>
  );
}
