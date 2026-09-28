import { useEffect, useState } from 'react';
import { api, clearHashParams, download, hashParam, money, useApi, useLookups } from '../api.js';
import { RecordForm } from '../components/Crud.jsx';
import Doc from '../components/Doc.jsx';
import Table, { col, mcol } from '../components/Table.jsx';

export default function Tenants() {
  const [rows, reload] = useApi('/tenants');
  useEffect(() => { // "#tenants?id=…" (from Nena) opens that tenant's details
    const id = hashParam('id');
    clearHashParams();
    if (id) inspect({ id });
  }, []);
  const [lookups] = useLookups();
  const [archived, setArchived] = useState(false);
  const [details, setDetails] = useState(null); // tenant summary from the API
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function inspect(t) {
    setError('');
    try { setDetails(await api(`/tenants/${t.id}/summary`)); } catch (err) { setNotice(err.message); }
  }
  function saved(tenant) {
    setDetails(null);
    if (tenant) { setNotice(`${tenant.name}'s details saved.`); reload(); }
  }
  async function remove() {
    const t = details.tenant;
    if (!confirm(`Delete ${t.name}? Their payment records will be deleted too. This can't be undone.`)) return;
    try {
      await api(`/tenants/${t.id}`, { method: 'DELETE' });
      setDetails(null);
      setNotice(`${t.name} deleted.`);
      reload();
    } catch (err) { setError(err.message); }
  }

  const shown = Array.isArray(rows) ? rows.filter((t) => !!t.archived === archived) : rows;

  return (
    <>
      <label className="toggle">
        <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Show archived tenants
      </label>
      {notice && <p role="status">{notice}</p>}
      <section className="card">
        <header className="card-head">
          <h2>Tenants</h2>
          <button className="btn" onClick={() => download('/export/tenants', 'tenants.csv').catch((err) => setNotice(err.message))}>Export CSV</button>
        </header>
        <Table
          columns={[
            col('Name', 'name'),
            { label: 'Renting at', get: (t) => lookups.properties?.[t.propertyId] ?? '' },
            { label: 'Monthly rent', num: true, get: (t) => (t.monthlyRent != null ? money(t.monthlyRent) : '—') },
            { label: '', get: (t) => <button className="btn sm" onClick={() => inspect(t)}>Inspect details</button> },
          ]}
          rows={shown}
          empty={archived ? 'No archived tenants.' : 'No tenants yet. Add one from the quick actions button at the bottom right of the Dashboard.'}
        />
      </section>

      {details && (
        <Doc title={details.tenant.name} onClose={() => setDetails(null)} printable={false}>
          <dl className="facts">
            <dt>Unpaid months</dt><dd className={details.overdueMonths.length ? 'bad' : ''}>{details.overdueMonths.join(', ') || 'None'}</dd>
            <dt>Balance owed</dt><dd className={details.balance > 0 ? 'bad' : ''}>{money(details.balance)}</dd>
          </dl>
          <h3>Details</h3>
          <RecordForm name="tenants" row={details.tenant} onDone={saved} />
          <h3>Payment history</h3>
          <Table columns={[col('Month', 'month'), mcol('Amount', 'amount'), col('Marked paid on', 'paidAt')]} rows={details.payments} empty="No payments marked yet." />
          <h3>Danger zone</h3>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn danger" onClick={remove}>Delete tenant</button>
        </Doc>
      )}
    </>
  );
}
