import { money, pct, useApi } from '../api.js';
import Crud from '../components/Crud.jsx';
import Table, { Stat, col, mcol } from '../components/Table.jsx';

export default function Finance() {
  const [f, reload] = useApi('/reports/finance');

  return (
    <>
      <div className="row-actions page-actions">
        <button className="btn" onClick={() => window.print()}>Print / Save PDF</button>
        <a className="btn" href="/api/export/profit-loss">Export P&amp;L CSV</a>
      </div>
      {f?.totals ? (
        <>
          <div className="stats">
            <Stat label="Income (12 months)" value={money(f.totals.income)} />
            <Stat label="Expenses (12 months)" value={money(f.totals.expenses)} />
            <Stat label="Net profit (12 months)" value={money(f.totals.profit)} tone={f.totals.profit < 0 ? 'bad' : 'good'} />
            <Stat label="Rent collection rate" value={pct(f.totals.collectionRate)} />
          </div>
          <section className="card">
            <h2>Profit &amp; loss and cash flow</h2>
            <Table
              columns={[col('Month', 'month'), mcol('Income', 'income'), mcol('Expenses', 'expenses'), mcol('Profit', 'profit'), mcol('Deposits in', 'depositsIn'), mcol('Deposits out', 'depositsOut'), mcol('Net cash flow', 'cashFlow')]}
              rows={[...f.monthly].reverse()}
            />
          </section>
          <section className="card">
            <h2>Expenses by category</h2>
            <Table columns={[col('Category', 'category'), mcol('Last 12 months', 'amount')]} rows={f.categories} empty="No expenses in the last 12 months." />
          </section>
          <section className="card">
            <h2>Rental income projection</h2>
            <Table columns={[col('Month', 'month'), col('Active leases', 'leases', true), mcol('Projected rent', 'income')]} rows={f.projection} />
          </section>
        </>
      ) : (
        <p className="muted">Loading…</p>
      )}
      <Crud name="expenses" onChange={reload} />
    </>
  );
}
