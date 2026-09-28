import { money, useApi } from '../api.js';
import { I, Icon } from '../components/Icons.jsx';
import { LoadError, Loading } from '../components/States.jsx';
import { Stat } from '../components/Table.jsx';

const monthName = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleString('en-PH', { month: 'short', year: 'numeric' });

export default function Finance() {
  const [f, reload, error] = useApi('/reports/finance');
  if (error && !f) return <LoadError what="your finances" onRetry={reload} />;
  if (!f) return <Loading rows={2} />;

  return (
    <div className="cards">
      <Stat label="Rent collected (12 months)" value={money(f.totals.income)} note={`${monthName(f.monthly[0].month)} – ${monthName(f.monthly.at(-1).month)}`} />
      <Stat label="Expected rent per month" value={money(f.totals.expectedMonthly)} note={`From ${f.totals.tenants} active tenant${f.totals.tenants === 1 ? '' : 's'}`} />
      <button className="btn block" onClick={() => window.print()}><Icon d={I.printer} />Print / Save PDF</button>
    </div>
  );
}
