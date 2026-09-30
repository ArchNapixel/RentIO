# RentIO

Rent tracking for landlords: properties, tenants, who has paid this month, and Nena, an assistant that reads receipts and marks rent paid after you confirm. React web app, wrapped as an Android app with Capacitor.

- `backend/` is the Express API on :4000 (needs Node 22.9+). Data lives in Supabase. Run `backend/schema.sql` once in the Supabase SQL Editor and copy `backend/.env.example` to `backend/.env`.
- `frontend/` is the React app (Vite) on :5173. It proxies `/api` to the backend. Copy `frontend/.env.example` to `frontend/.env`.
- Dates use Philippine time (`Asia/Manila`) on the server whatever the host's clock says. Set `TZ` to change it.

```sh
npm install   # also installs backend/ and frontend/
npm run dev   # starts both; open http://localhost:5173
npm test      # backend tests
```

## Sign-in
Email + password and Google, through Supabase Auth. In the Supabase dashboard, under Authentication › URL Configuration, add your site URL and `com.rentio.app://login-callback` to the Redirect URLs (the Android app uses the second one for Google sign-in, confirmation emails and password resets).

## Daily overdue email (optional)
Add `RESEND_API_KEY` to `backend/.env`. It's sent at 8 am (`DIGEST_HOUR`) while the backend runs; try it now with `npm run digest --prefix backend`. Without your own domain, Resend only delivers to your Resend account's email; verify a domain and set `DIGEST_FROM` to email other owners.

## Android
Needs Android Studio and a **JDK 21**. If Gradle says it can't find a Java 21 installation, point it at Android Studio's: add `org.gradle.java.installations.paths=C:/Program Files/Android/Android Studio/jbr` to `~/.gradle/gradle.properties`.

- **Development:** `npm run android:dev --prefix frontend` (loads the Vite dev server), then `npm run android:connect --prefix frontend` and run the app from Android Studio, or `./gradlew installDebug` in `frontend/android`.
- **Release build:** the installed app can't use the dev proxy, so it needs your deployed backend. `VITE_API_URL=https://your-backend npm run android:release --prefix frontend` bundles the app and syncs it; build the APK/AAB in Android Studio. The backend allows the app's origin by default (`CORS_ORIGINS`).
- **Notifications** are the phone's own, shown while the app is open or alive in the background. Waking a fully closed app needs Firebase push, which isn't set up.

## Account deletion
Owners can delete their account and all its data from the Account sheet (the person icon in the header), as app stores require.
