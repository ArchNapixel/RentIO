// Tenants: a searchable list (who owes first), a read-only sheet per tenant with a one-tap pay button,
// and an Edit step behind it. Moving out is a button; deleting lives at the bottom of Edit.
import { useEffect, useState } from 'react';
import { api, clearHashParams, hashParam, money, today, useApi, useLookups } from '../api.js';
import { RecordForm } from '../components/Crud.jsx';
import Doc, { Confirm } from '../components/Doc.jsx';
import { I, Icon } from '../components/Icons.jsx';
import { Select } from '../components/Picker.jsx';
import { Empty, HeadAction, LoadError, Loading, Status } from '../components/States.jsx';
import Table, { col, mcol } from '../components/Table.jsx';
import { toast } from '../components/Toasts.jsx';
import { MONTHS, monthName, payMonths, tel } from '../pay.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const monthOf = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

export default function Tenants({ slot }) {
  const [rows, reload, loadError] = useApi('/tenants');
  const [balances, reloadBalances] = useApi('/reports/tenant-balances'); // current tenants only
  const [lookups] = useLookups();
  const [tab, setTab] = useState('current'); // current | moved
  const [query, setQuery] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [details, setDetails] = useState(null); // tenant summary from the API
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { // "#tenants?id=…" (from Nena) opens that tenant's sheet
    const id = hashParam('id');
    const add = hashParam('add'); // "#tenants?add=1" (from an empty state) opens the Add sheet
    clearHashParams();
    if (id) inspect({ id });
    if (add) setAdding(true);
  }, []);

  const summaryPath = (id) => `/tenants/${id}/summary`;
  async function inspect(t) {
    try { setEditing(false); setDetails(await api(summaryPath(t.id))); } catch (err) { toast({ text: err.message, error: true }); }
  }
  const refreshAll = () => { reload(); reloadBalances(); };
  // After a payment: update the sheet and the list behind it. Errors are swallowed so a good save never shows as failed.
  const refreshSheet = async (id) => {
    await Promise.all([api(summaryPath(id)).then(setDetails), reload(), reloadBalances()]).catch(() => {});
  };

  function saved(tenant) {
    if (!tenant) return setEditing(false); // Cancel goes back to the sheet
    toast(`${tenant.name}'s details saved.`);
    setEditing(false);
    refreshSheet(tenant.id);
  }
  function added(tenant) {
    setAdding(false);
    if (tenant) { toast(`${tenant.name} added.`); refreshAll(); }
  }
  async function setArchived(t, archived, undoable = true) {
    try {
      await api(`/tenants/${t.id}`, { method: 'PUT', body: { name: t.name, propertyId: t.propertyId, archived } }); // the API updates only what it's given
      setDetails(null);
      refreshAll();
      toast(undoable
        ? { text: `${t.name} ${archived ? 'moved out' : 'moved back in'}.`, action: 'Undo', onAction: () => setArchived(t, !archived, false) }
        : `${t.name} ${archived ? 'moved out' : 'moved back in'}.`);
    } catch (err) {
      toast({ text: err.message, error: true });
    }
  }
  async function remove() {
    const t = details.tenant;
    setDeleting(true);
    try {
      await api(`/tenants/${t.id}`, { method: 'DELETE' });
      setConfirming(false);
      setDetails(null);
      toast(`${t.name} deleted.`);
      refreshAll();
    } catch (err) {
      setConfirming(false);
      toast({ text: err.message, error: true });
    } finally {
      setDeleting(false);
    }
  }

  if (loadError && !rows) return <LoadError what="your tenants" onRetry={reload} />;

  const now = today();
  const thisMonth = MONTHS[Number(now.slice(5, 7)) - 1];
  const owed = Object.fromEntries((balances ?? []).map((b) => [b.id, b]));
  const behind = (x) => owed[x.id]?.overdueCount ?? 0;
  const unpaid = (x) => (owed[x.id] && !owed[x.id].paidThisMonth ? 1 : 0);
  const properties = Object.entries(lookups.properties ?? {});
  const q = query.trim().toLowerCase();
  const shown = rows
    ?.filter((x) => !!x.archived === (tab === 'moved') && (!propertyId || x.propertyId === propertyId) && (!q || x.name.toLowerCase().includes(q)))
    .sort((a, b) => behind(b) - behind(a) || unpaid(b) - unpaid(a) || a.name.localeCompare(b.name));

  function status(x) {
    const b = owed[x.id];
    if (x.archived || !b) return null;
    if (b.overdueCount) return <Status kind="behind">{plural(b.overdueCount, 'month')} behind · {money(b.balance)}</Status>;
    if (x.moveInDate?.slice(0, 7) > now.slice(0, 7)) return <Status>Moves in {monthOf(x.moveInDate)}</Status>;
    return b.paidThisMonth ? <Status kind="paid">Paid for {thisMonth}</Status> : <Status kind="due">{thisMonth} due</Status>;
  }

  const t = details?.tenant;
  const rent = Number(t?.monthlyRent) || 0;
  const due = details?.due ?? [];
  const startsLater = t?.moveInDate?.slice(0, 7) > now.slice(0, 7);
  const facts = t && [
    ['Renting at', details.property],
    ['Monthly rent', rent > 0 && money(rent)],
    ['Moved in', t.moveInDate && monthOf(t.moveInDate)],
    ['Emergency contact', [t.emergencyName, t.emergencyPhone].filter(Boolean).join(' · ')],
    ['Notes', t.notes],
  ].filter(([, v]) => v);
  
  return (
    <>
      <div className="toolbar">
        <input type="search" aria-label="Search tenants" placeholder="Search tenants" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <HeadAction slot={slot}><button className="btn primary" onClick={() => setAdding(true)}><Icon d={I.plus} />Add tenant</button></HeadAction>
      <div className="year-nav">
        <button className={`chip ${tab === 'current' ? 'soft' : ''}`} aria-pressed={tab === 'current'} onClick={() => setTab('current')}>Current</button>
        <button className={`chip ${tab === 'moved' ? 'soft' : ''}`} aria-pressed={tab === 'moved'} onClick={() => setTab('moved')}>Moved out</button>
        {properties.length > 1 && (
          <Select aria-label="Filter by property" title="Property" options={properties} clear="All properties" onChange={setPropertyId} />
        )}
      </div>

      {!rows && <Loading />}
      {shown?.length === 0 && (
        q || propertyId ? <Empty icon={I.tenants} title="No tenants match.">Try a different name or property.</Empty>
          : tab === 'moved' ? <Empty icon={I.tenants} title="No one has moved out." />
            : <Empty icon={I.tenants} title="No tenants yet." action={<button className="btn primary sm" onClick={() => setAdding(true)}>Add tenant</button>} />
      )}
      {shown?.length > 0 && (
        <>
        <section className="card only-wide">
          <Table
            columns={[
              { label: 'Name', get: (x) => <button className="link plain" onClick={() => inspect(x)}>{x.name}</button> },
              { label: 'Property', get: (x) => lookups.properties?.[x.propertyId] ?? '—' },
              mcol('Rent', 'monthlyRent'),
              { label: 'Status', get: status },
            ]}
            rows={shown}
          />
        </section>
        <section className="card only-narrow">
          <ul className="list">
            {shown.map((x) => (
              <li key={x.id} className="tap">
                <button className="row-btn" onClick={() => inspect(x)}>
                  <span className="grow">
                    <span className="title">{x.name}</span>
                    <span className="sub">{lookups.properties?.[x.propertyId] ?? '—'}{x.monthlyRent > 0 && ` · ${money(x.monthlyRent)}/mo`}</span>
                  </span>
                  <span className="small end">{status(x)}</span>
                  <Icon d={I.right} />
                </button>
              </li>
            ))}
          </ul>
        </section>
        </>
      )}

      {adding && (
        <Doc title="Add tenant" onClose={() => setAdding(false)}>
          <RecordForm name="tenants" row={{ propertyId }} onDone={added} />
        </Doc>
      )}

      {details && !editing && (
        <Doc title={t.name} onClose={() => setDetails(null)}>
          <div className="form">
            {!t.archived && due.length > 0 && (
              <>
                {details.overdueMonths.length > 0 && (
                  <p className="box error"><span><strong>Unpaid months: {details.overdueMonths.join(', ')}</strong><br />Balance owed: {money(details.balance)}</span></p>
                )}
                <button className="btn primary block" onClick={() => payMonths(t, due, () => refreshSheet(t.id))}>
                  {due.length > 1 ? `Mark ${due.length} months paid` : 'Mark paid'}{rent > 0 && ` · ${money(due.length * rent)}`}
                </button>
                {due.length > 1 && (
                  <button className="btn ghost block" onClick={() => payMonths(t, [due.at(-1)], () => refreshSheet(t.id))}>Only {monthName(due.at(-1))}</button>
                )}
              </>
            )}
            {!t.archived && due.length === 0 && (startsLater
              ? <p className="muted small">Rent starts {monthOf(t.moveInDate)}.</p>
              : <p className="box success"><Icon d={I.check} />Paid up through {thisMonth}.</p>)}

            {(t.phone || t.email) && (
              <div className="row-actions">
                {t.phone && <a className="btn" href={`tel:${tel(t.phone)}`}>Call</a>}
                {t.phone && <a className="btn" href={`sms:${tel(t.phone)}`}>Text</a>}
                {t.email && <a className="btn" href={`mailto:${t.email}`}>Email</a>}
              </div>
            )}

            <dl className="facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>

            <h3>Payment history</h3>
            {details.payments.length
              ? <Table columns={[col('Month', 'month'), mcol('Amount', 'amount'), { label: 'Marked paid on', num: true, get: (p) => p.paidAt }]} rows={details.payments} />
              : <p className="muted small">No payments marked yet.</p>}

            <div className="form-actions">
              <button className="btn" onClick={() => setEditing(true)}>Edit</button>
              <button className="btn" onClick={() => setArchived(t, !t.archived)}>{t.archived ? 'Move back in' : 'Move out'}</button>
            </div>
          </div>
        </Doc>
      )}

      {details && editing && (
        <Doc title={`Edit ${t.name}`} onClose={() => setEditing(false)}>
          <RecordForm
            name="tenants"
            row={t}
            onDone={saved}
            after={
              <div className="danger-zone">
                <h3>Danger zone</h3>
                <p>Moved out? Use Move out on their sheet to keep their history. Deleting removes it for good.</p>
                <button type="button" className="btn danger" onClick={() => setConfirming(true)}>Delete tenant</button>
              </div>
            }
          />
        </Doc>
      )}
      {confirming && (
        <Confirm
          title={`Delete ${t.name}?`}
          body={`Their ${plural(details.payments.length, 'payment record')} go too, and this can't be undone. If they just moved out, use Move out instead to keep their history.`}
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
