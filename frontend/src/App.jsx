import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { supabase } from './supabase.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Properties from './pages/Properties.jsx';
import Tenants from './pages/Tenants.jsx';
import Rent from './pages/Rent.jsx';
import Account from './components/Account.jsx';
import { closeTopLayer } from './components/Doc.jsx';
import QuickActions from './components/QuickActions.jsx';
import { I, Icon } from './components/Icons.jsx';
import { Wordmark } from './components/Robot.jsx';
import { OfflineBanner, useOnline } from './components/States.jsx';
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

// Login gate: signed in → the app; guest → sample dashboard only; otherwise → login screen.
export default function App() {
  const [session, setSession] = useState(undefined); // undefined while checking for a saved login
  const [recovering, setRecovering] = useState(false); // opened a "reset password" email link
  const [guest, setGuest] = useState(false);
  const [loginMode, setLoginMode] = useState('signin');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (s) setGuest(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  if (recovering) return <Login initialMode="reset" onPasswordSaved={() => setRecovering(false)} />;
  if (session) return <Shell key={session.user.id} email={session.user.email} />;
  if (guest) return <Shell guest onSignUp={() => { setLoginMode('signup'); setGuest(false); }} />;
  return <Login key={loginMode} initialMode={loginMode} onGuest={() => setGuest(true)} />;
}

function Shell({ guest = false, onSignUp, email }) {
  const [account, setAccount] = useState(false);
  const [slot, setSlot] = useState(null); // header spot where a page puts its Add button
  const [route, setRoute] = useState(guest ? 'dashboard' : current);
  const [hash, setHash] = useState(location.hash);
  const [version, setVersion] = useState(0); // bumped when data changes outside the page (quick add, Nena)
  useEffect(() => {
    const onHash = () => { setRoute(guest ? 'dashboard' : current()); setHash(location.hash); scrollTo(0, 0); };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, [guest]);
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
  const alertCount = useAlertNotifier(!guest);
  const online = useOnline();
  const [title, Page] = pages[route];
  const badge = alertCount > 9 ? '9+' : alertCount;

  return (
    <div className={`layout ${guest ? 'guest' : ''}`}>
      {!guest && (
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
            {guest
              ? <><ThemeToggle /><button className="btn primary sm" onClick={onSignUp}>Sign up</button></>
              : <button className="icon-btn head-account" aria-label="Account" title="Account" onClick={() => setAccount(true)}><Icon d={I.user} /></button>}
          </span>
        </header>
        {!online && <OfflineBanner />}
        <Page key={`${hash}:${version}`} guest={guest} slot={slot} />
      </main>
      {account && <Account email={email} onClose={() => setAccount(false)} />}
      <Toasts />
      <QuickActions guest={guest} onSignUp={onSignUp} version={version} onChanged={() => setVersion((v) => v + 1)} />
    </div>
  );
}
