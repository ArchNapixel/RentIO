// Light/dark switch. Follows the phone's setting until the owner picks one, then remembers it on this device.
import { useEffect, useState } from 'react';
import { I, Icon } from './Icons.jsx';

const KEY = 'rentio-theme';
const root = document.documentElement;
const systemDark = matchMedia('(prefers-color-scheme: dark)');

function apply(theme) {
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0f1115' : '#2847d6');
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(root.dataset.theme || 'light');

  useEffect(() => {
    apply(theme);
    // No saved choice: keep following the phone's setting.
    const follow = (e) => {
      let saved = null;
      try { saved = localStorage.getItem(KEY); } catch { /* storage blocked */ }
      if (!saved) setTheme(e.matches ? 'dark' : 'light');
    };
    systemDark.addEventListener('change', follow);
    return () => systemDark.removeEventListener('change', follow);
  }, [theme]);

  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      className="icon-btn"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={() => {
        try { localStorage.setItem(KEY, next); } catch { /* storage blocked: still switches for now */ }
        setTheme(next);
      }}
    >
      <Icon d={theme === 'dark' ? I.sun : I.moon} />
    </button>
  );
}
