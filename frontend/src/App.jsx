import { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard.jsx';
import Properties from './pages/Properties.jsx';
import Leases from './pages/Leases.jsx';
import Tenants from './pages/Tenants.jsx';
import Payments from './pages/Payments.jsx';
import Finance from './pages/Finance.jsx';
import Alerts, { useAlertNotifier } from './pages/Alerts.jsx';

const pages = {
  dashboard: ['Dashboard', Dashboard],
  properties: ['Properties', Properties],
  leases: ['Leases', Leases],
  tenants: ['Tenants', Tenants],
  payments: ['Rent & payments', Payments],
  finance: ['Finance', Finance],
  alerts: ['Alerts', Alerts],
};
const current = () => (pages[location.hash.slice(1)] ? location.hash.slice(1) : 'dashboard');

export default function App() {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const onHash = () => setRoute(current());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);
  const alertCount = useAlertNotifier();
  const [title, Page] = pages[route];

  return (
    <div className="layout">
      <nav className="nav">
        <strong className="brand">RentIO</strong>
        {Object.entries(pages).map(([key, [label]]) => (
          <a key={key} href={`#${key}`} aria-current={key === route ? 'page' : undefined}>
            {label}
            {key === 'alerts' && alertCount > 0 && <span className="badge">{alertCount}</span>}
          </a>
        ))}
      </nav>
      <main>
        <h1>{title}</h1>
        <Page key={route} />
      </main>
    </div>
  );
}
