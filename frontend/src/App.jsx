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
import { I, Icon } from './components/Icons.jsx';
import { Wordmark } from './components/Robot.jsx';
import { OfflineBanner, useOnline } from './components/States.jsx';
import Toasts from './components/Toasts.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';

// key: [page title, component, nav label, icon]
const pages = {
  dashboard: ['Home', Dashboard, 'Home', I.home],
  payments: ['Rent tracker', Rent, 'Rent', I.rent],
  tenants: ['Tenants', Tenants, 'Tenants', I.tenants],
  properties: ['Properties', Properties, 'Properties', I.properties],
  finance: ['Finance', Finance, 'Finance', I.finance],
  alerts: ['Alerts', Alerts, 'Alerts', I.alerts],
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
  const online = useOnline();
  const [title, Page] = pages[route];
  const badge = alertCount > 9 ? '9+' : alertCount;

  return (
    <div className={`layout ${guest ? 'guest' : ''}`}>
      {!guest && (
        <nav className="nav" aria-label="Main">
          <a className="brand" href="#dashboard" aria-label="RentIO home"><Wordmark /></a>
          {Object.entries(pages).map(([key, [, , label, icon]]) => (
            <a key={key} href={`#${key}`} aria-current={key === route ? 'page' : undefined} aria-label={key === 'alerts' && alertCount ? `Alerts, ${alertCount} open` : undefined}>
              <span className="nav-icon" aria-hidden="true">
                <Icon d={icon} />
                {key === 'alerts' && alertCount > 0 && <span className="badge">{badge}</span>}
              </span>
              <span className="nav-label">{label}</span>
              <span className="nav-short">{label}</span>
              {key === 'alerts' && alertCount > 0 && <span className="badge nav-count" aria-hidden="true">{badge}</span>}
            </a>
          ))}
        </nav>
      )}
      <main>
        <header className="page-head">
          <h1>{title}</h1>
          <span className="row-actions">
            <ThemeToggle />
            {guest
              ? <button className="btn primary sm" onClick={onSignUp}>Sign up</button>
              : <button className="btn sm" onClick={() => supabase.auth.signOut()}>Log out</button>}
          </span>
        </header>
        {!online && <OfflineBanner />}
        <Page key={`${hash}:${version}`} guest={guest} />
      </main>
      <Toasts />
      <QuickActions guest={guest} onSignUp={onSignUp} version={version} onChanged={() => setVersion((v) => v + 1)} />
    </div>
  );
}
