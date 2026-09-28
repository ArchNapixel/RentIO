# RentIO

Property management: web first, later wrapped as a mobile app.

- `backend/` is the Express API on :4000. Data lives in memory (`store.js`) and starts empty; it resets on restart until the database is set up.
- `frontend/` is the React app (Vite) on :5173. It proxies `/api` to the backend.

```sh
npm install   # also installs backend/ and frontend/
npm run dev   # starts both; open http://localhost:5173
```

Tests: `npm test`
