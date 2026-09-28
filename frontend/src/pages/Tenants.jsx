import { useState } from 'react';
import { api, money, useLookups } from '../api.js';
import Crud from '../components/Crud.jsx';
import Doc from '../components/Doc.jsx';
import Table, { col, mcol } from '../components/Table.jsx';

export default function Tenants() {
  const [archived, setArchived] = useState(false);
  const [profile, setProfile] = useState(null);
  const [lookups] = useLookups();
  const t = profile?.tenant;

  return (
    <>
      <label className="toggle">
        <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Show archived tenants
      </label>
      <Crud
        name="tenants"
        addable={false}
        empty={archived ? 'No archived tenants.' : 'No tenants yet. Add one from the quick actions button at the bottom right of the Dashboard.'}
        filter={(x) => !!x.archived === archived}
        actions={(x) => <button className="btn sm" onClick={async () => setProfile(await api(`/tenants/${x.id}/summary`))}>Profile</button>}
      />
      {profile && (
        <Doc title={t.name} onClose={() => setProfile(null)}>
          <dl className="facts">
            <dt>Renting at</dt><dd>{lookups.properties?.[t.propertyId] ?? '—'}</dd>
            <dt>Email</dt><dd>{t.email || '—'}</dd>
            <dt>Phone</dt><dd>{t.phone || '—'}</dd>
            <dt>Emergency contact</dt><dd>{t.emergencyName ? `${t.emergencyName} · ${t.emergencyPhone ?? ''}` : '—'}</dd>
            <dt>Balance owed</dt><dd className={profile.balance > 0 ? 'bad' : ''}>{money(profile.balance)}</dd>
            <dt>Status</dt><dd>{t.archived ? 'Archived' : profile.leases.some((l) => l.active) ? 'Current tenant' : 'No active lease'}</dd>
          </dl>
          <h3>Lease history</h3>
          <Table
            columns={[col('Unit', 'unit'), col('Start', 'startDate'), col('End', 'endDate'), col('Moved in', 'moveInDate'), col('Moved out', 'moveOutDate'), mcol('Current rent', 'currentRent'), col('Renewal', 'renewalStatus')]}
            rows={profile.leases}
            empty="No leases."
          />
          <h3>Payment history</h3>
          <Table columns={[col('Date', 'date'), col('Type', 'type'), col('Method', 'method'), mcol('Amount', 'amount')]} rows={profile.payments} empty="No payments." />
          <h3>Invoices</h3>
          <Table columns={[col('Due', 'dueDate'), col('Description', 'description'), mcol('Amount', 'amount'), mcol('Balance', 'balance'), col('Status', 'status')]} rows={profile.invoices} empty="No invoices." />
          <h3>Violations</h3>
          <Table columns={[col('Date', 'date'), col('Description', 'description'), col('Severity', 'severity')]} rows={profile.violations} empty="No violations logged." />
        </Doc>
      )}
    </>
  );
}
