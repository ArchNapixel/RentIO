import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Properties from './pages/Properties.jsx';
import Tenants from './pages/Tenants.jsx';
import Rent from './pages/Rent.jsx';
import Finance from './pages/Finance.jsx';
import Alerts, { useAlertNotifier } from './pages/Alerts.jsx';
import QuickActions from './components/QuickActions.jsx';

// 24x24 stroke icons (path data only).
const icons = {
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  payments: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4M8.5 14.5l2 2 4.5-4.5',
  tenants: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
  properties: 'M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6',
  finance: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  alerts: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
};

// key: [page title, component, short tab label]
const pages = {
  dashboard: ['Dashboard', Dashboard, 'Home'],
  payments: ['Rent tracker', Rent, 'Rent'],
  tenants: ['Tenants', Tenants, 'Tenants'],
  properties: ['Properties', Properties, 'Properties'],
  finance: ['Finance', Finance, 'Finance'],
  alerts: ['Alerts', Alerts, 'Alerts'],
};
// "#tenants?id=…" → route "tenants"; pages read the ?params themselves.
const current = () => {
  const path = location.hash.slice(1).split('?')[0];
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
  if (session) return <Shell key={session.user.id} />;
  if (guest) return <Shell guest onSignUp={() => { setLoginMode('signup'); setGuest(false); }} />;
  return <Login key={loginMode} initialMode={loginMode} onGuest={() => setGuest(true)} />;
}

function Shell({ guest = false, onSignUp }) {
  const [route, setRoute] = useState(guest ? 'dashboard' : current);
  const [hash, setHash] = useState(location.hash);
  const [version, setVersion] = useState(0); // bumped when data changes outside the page (quick add, Nena)
  useEffect(() => {
    const onHash = () => { setRoute(guest ? 'dashboard' : current()); setHash(location.hash); scrollTo(0, 0); };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, [guest]);
  const alertCount = useAlertNotifier(!guest);
  const [title, Page] = pages[route];

  return (
    <div className={`layout ${guest ? 'guest' : ''}`}>
      {!guest && (
        <nav className="nav" aria-label="Main">
          <strong className="brand">RentIO</strong>
          {Object.entries(pages).map(([key, [label, , short]]) => (
            <a key={key} href={`#${key}`} aria-current={key === route ? 'page' : undefined}>
              <span className="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icons[key]} /></svg>
                {key === 'alerts' && alertCount > 0 && <span className="badge">{alertCount > 99 ? '99+' : alertCount}</span>}
              </span>
              <span className="nav-label">{label}</span>
              <span className="nav-short">{short}</span>
            </a>
          ))}
        </nav>
      )}
      <main>
        <header className="page-head">
          <h1>{title}</h1>
          {guest
            ? <button className="btn primary sm" onClick={onSignUp}>Sign up</button>
            : <button className="btn sm" onClick={() => supabase.auth.signOut()}>Log out</button>}
        </header>
        <Page key={`${hash}:${version}`} guest={guest} />
      </main>
      <QuickActions guest={guest} onSignUp={onSignUp} version={version} onChanged={() => setVersion((v) => v + 1)} />
    </div>
  );
}
