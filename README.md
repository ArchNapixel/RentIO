# RentIO

Property management: web first, later wrapped as a mobile app.

- `backend/` is the Express API on :4000. Data lives in Supabase: run `backend/schema.sql` once in the Supabase SQL Editor, and put `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `GEMINI_API_KEY` in `backend/.env`.
- Daily overdue-rent email (optional): add `RESEND_API_KEY` to `backend/.env`. Sent at 8am (`DIGEST_HOUR`) while the backend runs; test now with `npm run digest --prefix backend`. Without your own domain, Resend only delivers to your Resend account's email; verify a domain and set `DIGEST_FROM` to email other owners.
- `frontend/` is the React app (Vite) on :5173. It proxies `/api` to the backend.

```sh
npm install   # also installs backend/ and frontend/
npm run dev   # starts both; open http://localhost:5173
```

Tests: `npm test`
