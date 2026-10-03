import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import Dashboard from './pages/Dashboard.jsx';
import Properties from './pages/Properties.jsx';
import Tenants from './pages/Tenants.jsx';
import Rent from './pages/Rent.jsx';
import Account from './components/Account.jsx';
import { closeTopLayer } from './components/Doc.jsx';
import QuickActions from './components/QuickActions.jsx';
import { I, Icon } from './components/Icons.jsx';
import { Wordmark } from './components/Robot.jsx';
import Toasts from './components/Toasts.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import { useAlertNotifier } from './notify.js';

// key: [page title, component, nav label, icon]
const pages = {
  dashboard: ['Home', Dashboard, 'Home', I.home],
  payments: ['Rent', Rent, 'Rent', I.rent],
  tenants: ['Tenants', Tenants, 'Tenants', I.tenants],
  properties: ['Properties', Properties, 'Properties', I.properties],
};
// "#tenants?id=…" → route "tenants"; pages read the ?params themselves.
const current = () => {
  const path = location.hash.slice(1).split('?')[0];
  if (path === 'alerts') return 'payments'; // overdue rent lives on the Rent tab now
  return pages[path] ? path : 'dashboard';
};

export default function App() {
  return <Shell />;
}

function Shell() {
  const [account, setAccount] = useState(false);
  const [slot, setSlot] = useState(null); // header spot where a page puts its Add button
  const [route, setRoute] = useState(current);
  const [hash, setHash] = useState(location.hash);
  const [version, setVersion] = useState(0); // bumped when data changes outside the page (quick add, Nena)
  useEffect(() => {
    const onHash = () => { setRoute(current()); setHash(location.hash); scrollTo(0, 0); };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);
  // Android's Back button: close whatever is open on top, else go back a screen, else leave the app.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = NativeApp.addListener('backButton', ({ canGoBack }) => {
      if (closeTopLayer()) return;
      if (canGoBack) history.back();
      else NativeApp.exitApp();
    });
    return () => { listener.then((l) => l.remove()); };
  }, []);
  const alertCount = useAlertNotifier();
  const [title, Page] = pages[route];
  const badge = alertCount > 9 ? '9+' : alertCount;

  return (
    <div className="layout">
      {(
        <nav className="nav" aria-label="Main">
          <a className="brand" href="#dashboard" aria-label="RentIO home"><Wordmark /></a>
          {Object.entries(pages).map(([key, [, , label, icon]]) => (
            <a key={key} href={`#${key}`} aria-current={key === route ? 'page' : undefined} aria-label={key === 'payments' && alertCount ? `Rent, ${alertCount} overdue` : undefined}>
              <span className="nav-icon" aria-hidden="true">
                <Icon d={icon} />
                {key === 'payments' && alertCount > 0 && <span className="badge">{badge}</span>}
              </span>
              <span className="nav-label">{label}</span>
              <span className="nav-short">{label}</span>
              {key === 'payments' && alertCount > 0 && <span className="badge nav-count" aria-hidden="true">{badge}</span>}
            </a>
          ))}
          <button className="nav-account" onClick={() => setAccount(true)}><span className="nav-icon" aria-hidden="true"><Icon d={I.user} /></span>Account</button>
        </nav>
      )}
      <main className={route === 'dashboard' ? undefined : 'narrow'}>
        <header className="page-head">
          <h1>{title}</h1>
          <span className="row-actions">
            <span className="head-slot" ref={setSlot} />
            <button className="icon-btn head-account" aria-label="Account" title="Account" onClick={() => setAccount(true)}><Icon d={I.user} /></button>
          </span>
        </header>
        <Page key={`${hash}:${version}`} slot={slot} />
      </main>
      {account && <Account onClose={() => setAccount(false)} />}
      <Toasts />
      <QuickActions version={version} onChanged={() => setVersion((v) => v + 1)} />
    </div>
  );
}
