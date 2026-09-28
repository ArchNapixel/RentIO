import { useState } from 'react';
import { api, useApi } from '../api.js';
import Crud from '../components/Crud.jsx';
import Doc from '../components/Doc.jsx';
import Table, { col, mcol } from '../components/Table.jsx';

export default function Leases() {
  const [expiry, reloadExpiry] = useApi('/reports/lease-expiry');
  const [schedule, setSchedule] = useState(null);
  const daysLeft = (r) => <span className={r.daysLeft <= 30 ? 'bad' : r.daysLeft <= 60 ? 'warn' : ''}>{r.daysLeft}</span>;

  return (
    <>
      <section className="card">
        <header className="card-head">
          <h2>Lease expiry</h2>
          <a className="btn" href="/api/export/lease-expiry">Export CSV</a>
        </header>
        <Table
          columns={[col('Tenant', 'tenant'), col('Unit', 'unit'), col('Ends', 'endDate'), { label: 'Days left', num: true, get: daysLeft }, col('Notice by', 'noticeDeadline'), col('Renewal', 'renewalStatus')]}
          rows={expiry}
          empty="No active or upcoming leases."
        />
      </section>
      <Crud
        name="leases"
        onChange={reloadExpiry}
        actions={(l) => <button className="btn sm" onClick={async () => setSchedule(await api(`/leases/${l.id}/escalation`))}>Rent schedule</button>}
      />
      <Crud name="violations" />
      {schedule && (
        <Doc title="Rent escalation schedule" onClose={() => setSchedule(null)}>
          <p className="muted">{schedule.tenant} · {schedule.unit}</p>
          <Table columns={[col('From', 'from'), mcol('Monthly rent', 'rent')]} rows={schedule.steps} />
        </Doc>
      )}
    </>
  );
}
