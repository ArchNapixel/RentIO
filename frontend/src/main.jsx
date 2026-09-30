import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles.css';

const root = createRoot(document.getElementById('root'));

// Without these the login library throws on import and the screen stays white, so say what's missing instead.
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  root.render(
    <main className="login">
      <div className="login-card">
        <h1>RentIO isn't set up yet</h1>
        <p className="lede">Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to frontend/.env, then restart the dev server.</p>
      </div>
    </main>,
  );
} else {
  import('./App.jsx').then(({ default: App }) => root.render(<App />));
}
