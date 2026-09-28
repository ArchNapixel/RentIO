import { useState } from 'react';
import { api, money, pct, today, useApi, useLookups } from '../api.js';
import Crud from '../components/Crud.jsx';
import Doc from '../components/Doc.jsx';
import Table, { Stat, col, mcol } from '../components/Table.jsx';

const sum = (rows, key) => (rows ?? []).reduce((s, r) => s + (Number(r[key]) || 0), 0);

export default function Payments() {
  const [status, reloadStatus] = useApi('/reports/invoices');
  const [balances, reloadBalances] = useApi('/reports/balances');
  const [deposits, reloadDeposits] = useApi('/reports/deposits');
  const [lookups] = useLookups();
  const [invoiceVersion, setInvoiceVersion] = useState(0);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [message, setMessage] = useState('');
  const [doc, setDoc] = useState(null);

  const refresh = () => { reloadStatus(); reloadBalances(); reloadDeposits(); };
  const statusOf = Object.fromEntries((status ?? []).map((i) => [i.id, i]));
  const due = (status ?? []).filter((i) => i.dueDate <= today());
  const collection = sum(due, 'amount') ? Math.round((sum(due, 'paid') / sum(due, 'amount')) * 1000) / 10 : null;

  async function generate() {
    try {
      const created = await api('/invoices/generate', { method: 'POST', body: { month } });
      setMessage(created.length ? `Created ${created.length} rent invoice${created.length > 1 ? 's' : ''} for ${month}.` : `Every active lease already has an invoice for ${month}.`);
      setInvoiceVersion((v) => v + 1);
      refresh();
    } catch (err) { setMessage(err.message); }
  }

  const receipt = (p) => setDoc({
    title: 'Payment receipt',
    body: (
      <dl className="facts">
        <dt>Receipt no.</dt><dd>{p.id.slice(0, 8).toUpperCase()}</dd>
        <dt>Received from</dt><dd>{lookups.leases?.[p.leaseId]}</dd>
        <dt>Date</dt><dd>{p.date}</dd>
        <dt>For</dt><dd>{p.type}</dd>
        <dt>Method</dt><dd>{p.method || '—'}{p.reference ? ` · ref ${p.reference}` : ''}</dd>
        <dt>Amount</dt><dd><strong>{money(p.amount)}</strong></dd>
      </dl>
    ),
  });
  const invoice = (i) => {
    const s = statusOf[i.id] ?? {};
    setDoc({
      title: 'Rent invoice',
      body: (
        <dl className="facts">
          <dt>Invoice no.</dt><dd>{i.id.slice(0, 8).toUpperCase()}</dd>
          <dt>Bill to</dt><dd>{lookups.leases?.[i.leaseId]}</dd>
          <dt>Description</dt><dd>{i.description}{i.period ? ` (${i.period})` : ''}</dd>
          <dt>Due date</dt><dd>{i.dueDate}</dd>
          <dt>Amount</dt><dd>{money(i.amount)}</dd>
          <dt>Paid</dt><dd>{money(s.paid)}</dd>
          <dt>Balance due</dt><dd><strong>{money(s.balance)}</strong></dd>
        </dl>
      ),
    });
  };
  const statusCell = (i) => {
    const s = statusOf[i.id]?.status;
    return s && <span className={s === 'overdue' ? 'bad' : s === 'partial' ? 'warn' : ''}>{s}</span>;
  };

  return (
    <>
      <div className="stats">
        <Stat label="Collection rate" value={pct(collection)} note="Paid vs. billed, to date" />
        <Stat label="Overdue" value={money(sum(due.filter((i) => i.status === 'overdue'), 'balance'))} tone="bad" />
        <Stat label="Outstanding balances" value={money(sum(balances?.filter?.((b) => b.balance > 0), 'balance'))} />
        <Stat label="Deposits held" value={money(sum(deposits, 'held'))} />
      </div>

      <section className="card">
        <header className="card-head">
          <h2>Generate rent invoices</h2>
          <span className="row-actions">
            <label className="field inline"><span>Month</span><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
            <button className="btn primary" onClick={generate}>Generate invoices</button>
          </span>
        </header>
        <p className="muted">The server also does this automatically each day for the current month.</p>
        {message && <p role="status">{message}</p>}
      </section>

      <Crud
        key={invoiceVersion}
        name="invoices"
        onChange={refresh}
        extra={[{ label: 'Paid', num: true, get: (i) => money(statusOf[i.id]?.paid) }, { label: 'Balance', num: true, get: (i) => money(statusOf[i.id]?.balance) }, { label: 'Status', get: statusCell }]}
        actions={(i) => <button className="btn sm" onClick={() => invoice(i)}>View</button>}
      />
      <Crud name="payments" onChange={refresh} actions={(p) => <button className="btn sm" onClick={() => receipt(p)}>Receipt</button>} />

      <section className="card">
        <header className="card-head">
          <h2>Tenant balances</h2>
          <a className="btn" href="/api/export/balances">Export CSV</a>
        </header>
        <Table columns={[col('Tenant', 'tenant'), col('Unit', 'unit'), mcol('Billed', 'invoiced'), mcol('Paid', 'paid'), mcol('Balance', 'balance')]} rows={balances} empty="No leases yet." />
      </section>

      <section className="card">
        <header className="card-head">
          <h2>Security deposit ledger</h2>
          <a className="btn" href="/api/export/deposits">Export CSV</a>
        </header>
        <Table
          columns={[col('Tenant', 'tenant'), col('Unit', 'unit'), mcol('Required', 'required'), mcol('Received', 'received'), mcol('Refunded', 'refunded'), mcol('Held', 'held'), mcol('Still owed', 'outstanding')]}
          rows={deposits}
          empty="No leases yet."
        />
      </section>

      {doc && <Doc title={doc.title} onClose={() => setDoc(null)}>{doc.body}</Doc>}
    </>
  );
}
