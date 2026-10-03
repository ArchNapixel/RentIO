// npm run android:dev      the app loads the Vite dev server (start `npm run dev` and `npm run android:connect` first)
// npm run android:release  bundles the built web app into the APK; (everything runs on the phone)
// capacitor.config.json is left in dev mode afterwards, so the repo never carries a release-only change.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const mode = process.argv[2];
if (!['dev', 'release'].includes(mode)) throw new Error('Use: node scripts/android.mjs dev|release');

const file = new URL('../capacitor.config.json', import.meta.url);
const { server, ...bundled } = JSON.parse(readFileSync(file, 'utf8'));
const write = (config) => writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
const dev = { ...bundled, server: { url: 'http://localhost:5173', cleartext: true } };

try {
  write(mode === 'dev' ? dev : bundled);
  if (mode === 'release') execSync('npx vite build', { stdio: 'inherit' });
  execSync('npx cap sync android', { stdio: 'inherit' });
} finally {
  write(dev);
}
