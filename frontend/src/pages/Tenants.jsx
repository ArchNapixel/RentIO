import { useEffect, useState } from 'react';
import { api, clearHashParams, download, hashParam, money, useApi, useLookups } from '../api.js';
import { RecordForm } from '../components/Crud.jsx';
import Doc, { Confirm } from '../components/Doc.jsx';
import { I, Icon } from '../components/Icons.jsx';
import { Empty, LoadError, Loading } from '../components/States.jsx';
import Table, { col, mcol } from '../components/Table.jsx';
import { toast } from '../components/Toasts.jsx';

export default function Tenants() {
  const [rows, reload, loadError] = useApi('/tenants');
  const [lookups] = useLookups();
  const [archived, setArchived] = useState(false);
  const [details, setDetails] = useState(null); // tenant summary from the API
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { // "#tenants?id=…" (from Nena) opens that tenant's details
    const id = hashParam('id');
    clearHashParams();
    if (id) inspect({ id });
  }, []);

  async function inspect(t) {
    try { setDetails(await api(`/tenants/${t.id}/summary`)); } catch (err) { toast({ text: err.message, error: true }); }
  }
  function saved(tenant) {
    setDetails(null);
    if (tenant) { toast(`${tenant.name}'s details saved.`); reload(); }
  }
  async function remove() {
    const t = details.tenant;
    setDeleting(true);
    try {
      await api(`/tenants/${t.id}`, { method: 'DELETE' });
      setConfirming(false);
      setDetails(null);
      toast(`${t.name} deleted.`);
      reload();
    } catch (err) {
      setConfirming(false);
      toast({ text: err.message, error: true });
    } finally {
      setDeleting(false);
    }
  }

  if (loadError && !rows) return <LoadError what="your tenants" onRetry={reload} />;
  const shown = rows?.filter((t) => !!t.archived === archived);
  const t = details?.tenant;

  return (
    <>
      <div className="toolbar">
        <label className="toggle"><input type="checkbox" className="switch" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Show archived tenants</label>
        <button className="btn sm" onClick={() => download('/export/tenants', 'tenants.csv').catch((err) => toast({ text: err.message, error: true }))}>
          <Icon d={I.download} />Export CSV
        </button>
      </div>

      {!rows && <Loading />}
      {shown?.length === 0 && (
        archived
          ? <Empty icon={I.tenants} title="No archived tenants." />
          : <Empty icon={I.tenants} title="No tenants yet.">Tap Nena at the bottom right, then Add tenant.</Empty>
      )}
      <div className="cards">
        {shown?.map((x) => (
          <article className="card" key={x.id}>
            <div className="card-top">
              <h2>{x.name}</h2>
              <button className="link" onClick={() => inspect(x)}>Inspect details</button>
            </div>
            <dl className="facts">
              <dt>Renting at</dt><dd>{lookups.properties?.[x.propertyId] ?? '—'}</dd>
              <dt>Monthly rent</dt><dd>{x.monthlyRent != null ? money(x.monthlyRent) : '—'}</dd>
            </dl>
          </article>
        ))}
      </div>

      {details && (
        <Doc title={t.name} onClose={() => setDetails(null)}>
          <RecordForm
            name="tenants"
            row={t}
            onDone={saved}
            before={details.overdueMonths.length > 0 && (
              <p className="box error"><span><strong>Unpaid months: {details.overdueMonths.join(', ')}</strong><br />Balance owed: {money(details.balance)}</span></p>
            )}
            after={
              <>
                <h3>Payment history</h3>
                {details.payments.length
                  ? <Table columns={[col('Month', 'month'), mcol('Amount', 'amount'), { label: 'Marked paid on', num: true, get: (p) => p.paidAt }]} rows={details.payments} />
                  : <p className="muted small">No payments marked yet.</p>}
                <div className="danger-zone">
                  <h3>Danger zone</h3>
                  <button type="button" className="btn danger" onClick={() => setConfirming(true)}>Delete tenant</button>
                </div>
              </>
            }
          />
        </Doc>
      )}
      {confirming && (
        <Confirm
          title={`Delete ${t.name}?`}
          body={`Their ${details.payments.length} payment record${details.payments.length === 1 ? '' : 's'} go too, and this can't be undone. If they just moved out, tick "Archived" instead to keep their history.`}
          confirmLabel={`Delete ${t.name}`}
          cancelLabel="Keep tenant"
          busy={deleting}
          onConfirm={remove}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
