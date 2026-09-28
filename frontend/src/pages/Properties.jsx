import { useEffect, useRef, useState } from 'react';
import { api, clearHashParams, hashParam, useApi } from '../api.js';
import { RecordForm } from '../components/Crud.jsx';
import Doc from '../components/Doc.jsx';
import Table, { col } from '../components/Table.jsx';

export default function Properties() {
  const [rows, reload] = useApi('/properties');
  const linked = useRef(hashParam('id')); // "#properties?id=…" (from Nena) opens that property
  useEffect(() => {
    clearHashParams();
    const p = Array.isArray(rows) && rows.find((x) => x.id === linked.current);
    if (p) { linked.current = null; setEditing(p); }
  }, [rows]);
  const [editing, setEditing] = useState(null); // {} = adding, property = inspecting
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const open = (p) => { setError(''); setNotice(''); setEditing(p); };
  function done(saved) {
    const adding = !editing.id;
    setEditing(null);
    if (saved) { setNotice(adding ? `${saved.name} added.` : `${saved.name} saved.`); reload(); }
  }
  async function remove() {
    const p = editing;
    if (!confirm(`Delete ${p.name}? This can't be undone.`)) return;
    try {
      await api(`/properties/${p.id}`, { method: 'DELETE' });
      setEditing(null);
      setNotice(`${p.name} deleted.`);
      reload();
    } catch (err) { setError(err.message); }
  }

  return (
    <>
      <button className="btn primary add-btn" onClick={() => open({})}>Add property</button>
      {notice && <p role="status">{notice}</p>}
      <section className="card">
        <Table
          columns={[
            col('Name', 'name'),
            col('Type', 'type'),
            { label: '', get: (p) => <button className="btn sm" onClick={() => open(p)}>Inspect details</button> },
          ]}
          rows={rows}
          empty='No properties yet. Tap "Add property" to add your first one.'
        />
      </section>

      {editing && (
        <Doc title={editing.id ? editing.name : 'Add property'} onClose={() => setEditing(null)} printable={false}>
          <RecordForm name="properties" row={editing} onDone={done} />
          {editing.id && (
            <>
              <h3>Danger zone</h3>
              {error && <p className="error" role="alert">{error}</p>}
              <button className="btn danger" onClick={remove}>Delete property</button>
            </>
          )}
        </Doc>
      )}
    </>
  );
}
