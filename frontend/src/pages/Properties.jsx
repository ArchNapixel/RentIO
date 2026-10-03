import { useEffect, useRef, useState } from 'react';
import { api, clearHashParams, hashParam, useApi } from '../api.js';
import { RecordForm } from '../components/Crud.jsx';
import Doc, { Confirm } from '../components/Doc.jsx';
import { I, Icon } from '../components/Icons.jsx';
import { Empty, HeadAction, LoadError, Loading } from '../components/States.jsx';
import { toast } from '../components/Toasts.jsx';

export default function Properties({ slot }) {
  const [rows, reload, loadError] = useApi('/properties');
  const [tenants] = useApi('/tenants'); // to tell up front when a property can't be deleted
  const [editing, setEditing] = useState(null); // {} = adding, property = inspecting
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const linked = useRef(hashParam('id')); // "#properties?id=…" (from Nena) opens that property
  const wantsAdd = useRef(hashParam('add')); // "#properties?add=1" (from an empty state) opens the Add sheet

  useEffect(() => {
    clearHashParams();
    if (wantsAdd.current) { wantsAdd.current = null; setEditing({}); }
    const p = rows?.find((x) => x.id === linked.current);
    if (p) { linked.current = null; setEditing(p); }
  }, [rows]);

  function done(saved) {
    const adding = !editing.id;
    setEditing(null);
    if (saved) { toast(adding ? `${saved.name} added.` : `${saved.name} saved.`); reload(); }
  }
  async function remove() {
    const p = editing;
    setDeleting(true);
    try {
      await api(`/properties/${p.id}`, { method: 'DELETE' });
      setConfirming(false);
      setEditing(null);
      toast(`${p.name} deleted.`);
      reload();
    } catch (err) {
      setConfirming(false);
      toast({ text: err.message, error: true });
    } finally {
      setDeleting(false);
    }
  }

  if (loadError && !rows) return <LoadError what="your properties" onRetry={reload} />;
  const assigned = editing?.id ? (tenants ?? []).filter((t) => t.propertyId === editing.id).length : 0;

  return (
    <>
      <HeadAction slot={slot}><button className="btn primary" onClick={() => setEditing({})}><Icon d={I.plus} />Add property</button></HeadAction>
      {!rows && <Loading rows={2} />}
      {rows?.length === 0 && <Empty title="No properties yet.">Add your first boarding house, dorm, apartment, condo or house.</Empty>}
      {rows?.length > 0 && (
        <ul className="card list">
          {rows.map((p) => (
            <li key={p.id} className="tap">
              <button className="row-btn" onClick={() => setEditing(p)}>
                <span className="grow"><span className="title">{p.name}</span><span className="sub">{p.type}</span></span>
                <Icon d={I.right} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Doc title={editing.id ? editing.name : 'Add property'} onClose={() => setEditing(null)}>
          <RecordForm
            name="properties"
            row={editing}
            onDone={done}
            after={editing.id && (
              <div className="danger-zone">
                <h3>Danger zone</h3>
                <button type="button" className="btn danger" disabled={assigned > 0} onClick={() => setConfirming(true)}>Delete property</button>
                {assigned > 0 && <p>Can't delete: {assigned} tenant{assigned > 1 ? 's are' : ' is'} still assigned. Move them out or to another property first (open the tenant, then Edit).</p>}
              </div>
            )}
          />
        </Doc>
      )}
      {confirming && (
        <Confirm
          title={`Delete ${editing.name}?`}
          body="This can't be undone."
          confirmLabel={`Delete ${editing.name}`}
          cancelLabel="Keep property"
          busy={deleting}
          onConfirm={remove}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
