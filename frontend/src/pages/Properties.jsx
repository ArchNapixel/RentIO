import { useApi } from '../api.js';
import Crud from '../components/Crud.jsx';
import Table, { col, mcol } from '../components/Table.jsx';

export default function Properties() {
  const [roll, reloadRoll] = useApi('/reports/rent-roll');
  const status = (u) => {
    const s = roll?.find?.((r) => r.id === u.id)?.status;
    return s && <span className={s === 'Vacant' ? 'warn' : ''}>{s}</span>;
  };

  return (
    <>
      <Crud name="properties" onChange={reloadRoll} />
      <Crud name="units" onChange={reloadRoll} extra={[{ label: 'Status', get: status }]} />
      <section className="card">
        <header className="card-head">
          <h2>Rent roll</h2>
          <a className="btn" href="/api/export/rent-roll">Export CSV</a>
        </header>
        <Table
          columns={[col('Unit', 'unit'), col('Status', 'status'), col('Tenant', 'tenant'), mcol('Rent', 'rent'), col('Due day', 'dueDay', true), col('Lease end', 'leaseEnd'), mcol('Balance', 'balance')]}
          rows={roll}
          empty="Add units to see the rent roll."
        />
      </section>
    </>
  );
}
