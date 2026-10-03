# RentIO

Rent tracking for landlords: properties, tenants, and who has paid this month. A React app wrapped as an Android app with Capacitor. No account and no server: everything is stored on the phone, and Android's own backup carries it to a new phone.

```sh
npm install   # also installs backend/ and frontend/
npm run dev   # open http://localhost:5173
npm test      # tests for the shared report and validation code
```

`frontend/src/local.js` is the app's "backend": it stores data in the phone's storage and reuses `backend/reports.js` and `backend/validate.js` for the rent maths and form checks. The rest of `backend/` (the old Express API, Nena and the email digest) is no longer used by the app.

## Android
Needs Android Studio and a **JDK 21**. If Gradle says it can't find a Java 21 installation, point it at Android Studio's: add `org.gradle.java.installations.paths=C:/Program Files/Android/Android Studio/jbr` to `~/.gradle/gradle.properties`.

- **Development:** `npm run android:dev --prefix frontend` (loads the Vite dev server), then `npm run android:connect --prefix frontend` and run the app from Android Studio, or `./gradlew installDebug` in `frontend/android`.
- **Release (Play Store):**
  1. Create an upload key once and keep it safe (losing it means you can't update the app):
     `keytool -genkey -v -keystore frontend/android/upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
  2. Create `frontend/android/keystore.properties` (git-ignored):
     ```
     storeFile=upload.jks
     storePassword=…
     keyAlias=upload
     keyPassword=…
     ```
  3. Raise `versionCode` (and `versionName`) in `frontend/android/app/build.gradle` for every upload.
  4. `npm run android:release --prefix frontend`, then `./gradlew bundleRelease` in `frontend/android`. Upload `app/build/outputs/bundle/release/app-release.aab`.
- **Notifications** are the phone's own, shown while the app is open or alive in the background.

## Erasing data
Account › Erase all data removes everything from the phone. Uninstalling the app does the same.
