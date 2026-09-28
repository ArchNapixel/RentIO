import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 127.0.0.1 so the Android emulator can reach it at 10.0.2.2
  server: { host: '127.0.0.1', proxy: { '/api': 'http://localhost:4000' } },
});
