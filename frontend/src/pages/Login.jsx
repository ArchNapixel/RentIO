// Login screen: sign in, create an account, reset a password, or look around as a guest.
import { useEffect, useState } from 'react';
import { I, Icon } from '../components/Icons.jsx';
import { Logo } from '../components/Robot.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { signInWithGoogle, supabase, webRedirect } from '../supabase.js';

const TITLES = { signin: 'Welcome back', signup: 'Create your account', forgot: 'Reset your password', reset: 'Choose a new password' };
const BUTTONS = { signin: 'Sign in', signup: 'Create account', forgot: 'Send reset link', reset: 'Save new password' };

// Supabase's messages, rewritten so they say what to do next.
function friendly(err) {
  const m = err?.message ?? '';
  if (/invalid login credentials/i.test(m)) return "That email and password don't match. Try again, or reset your password.";
  if (/email not confirmed/i.test(m)) return 'Confirm your email first: open the link we sent you, then sign in.';
  if (/already registered|already been registered/i.test(m)) return 'That email already has an account. Sign in instead.';
  if (/provider is not enabled|unsupported provider/i.test(m)) return "Google sign-in isn't set up yet. Use your email and password for now.";
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Wait a minute and try again.';
  return m || 'Something went wrong. Check your connection and try again.';
}

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.8 6C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-17.2z" />
      <path fill="#FBBC05" d="M10.5 28.8c-.5-1.5-.8-3.1-.8-4.8s.3-3.3.8-4.8l-7.8-6C1 16.5 0 20.1 0 24s1 7.5 2.7 10.8l7.8-6z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.7l-7.8 6C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default function Login({ initialMode = 'signin', onGuest, onPasswordSaved }) {
  const [mode, setMode] = useState(initialMode); // signin | signup | forgot | reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null); // { icon, text }
  const [resetEmail, setResetEmail] = useState('');

  useEffect(() => {
    try {
      if (sessionStorage.getItem('rentio-expired')) {
        sessionStorage.removeItem('rentio-expired');
        setNotice({ icon: I.lock, text: 'You were signed out to keep your account safe. Sign in again to pick up where you left off.' });
      }
    } catch { /* storage blocked */ }
    if (mode === 'reset') supabase.auth.getUser().then(({ data }) => setResetEmail(data.user?.email ?? ''));
  }, []);

  const go = (next) => { setMode(next); setError(''); setNotice(null); };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice(null);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: webRedirect() } });
        if (error) throw error;
        if (!data.session) setNotice({ icon: I.mail, text: <>We sent a confirmation link to <strong>{email}</strong>. Open it on this phone to finish.</> });
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: webRedirect() });
        if (error) throw error;
        setNotice({ icon: I.mail, text: <>If <strong>{email}</strong> has an account, a reset link is on its way.</> });
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        onPasswordSaved();
      }
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError('');
    try { await signInWithGoogle(); } catch (err) { setError(friendly(err)); }
  }

  return (
    <main className="login">
      <div className="login-theme"><ThemeToggle /></div>
      <div className="login-card">
        {mode === 'forgot'
          ? <button className="link back-link" onClick={() => go('signin')}><Icon d={I.left} />Back to sign in</button>
          : <Logo size={48} />}
        <h1>{TITLES[mode]}</h1>
        <p className="lede">
          {mode === 'forgot' ? "Enter the email you signed up with. We'll send you a link to choose a new password."
            : mode === 'reset' ? resetEmail && `For ${resetEmail}`
            : 'RentIO: rent tracking made simple.'}
        </p>

        {(mode === 'signin' || mode === 'signup') && (
          <>
            <button type="button" className="btn google-btn" onClick={google} disabled={busy}><GoogleG />Continue with Google</button>
            <p className="divider">or</p>
          </>
        )}

        <form className="form" onSubmit={submit}>
          {mode !== 'reset' && (
            <label className="field">
              <span>Email</span>
              <input type="email" autoComplete="email" required placeholder="e.g. you@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          )}
          {mode !== 'forgot' && (
            <label className="field">
              <span>{mode === 'reset' ? 'New password' : 'Password'}</span>
              <input
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'signin' ? undefined : 6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode !== 'signin' && <small>At least 6 characters</small>}
            </label>
          )}
          {error && <p className="box error" role="alert"><Icon d={I.alert} /><span>{error}</span></p>}
          {notice && <p className="box info" role="status"><Icon d={notice.icon} /><span>{notice.text}</span></p>}
          <button className="btn primary block" disabled={busy}>{busy ? <><span className="spinner" /> Please wait…</> : BUTTONS[mode]}</button>
        </form>

        <div className="login-links">
          {mode === 'signin' && (
            <>
              <button className="link" onClick={() => go('forgot')}>Forgot password?</button>
              <p>New to RentIO? <button className="link" onClick={() => go('signup')}>Create an account</button></p>
            </>
          )}
          {mode === 'signup' && <p>Already have an account? <button className="link" onClick={() => go('signin')}>Sign in</button></p>}
          {(mode === 'signin' || mode === 'signup') && onGuest && <button className="link plain" onClick={onGuest}>Continue as guest</button>}
        </div>
      </div>
    </main>
  );
}
