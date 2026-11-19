# Phone notifications (Firebase) — 5 steps

1. https://console.firebase.google.com → **Add project** (any name).
2. In the project: **Add app → Android**, package name exactly `com.primegram.app` → register → **download `google-services.json`**.
3. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**
   name `GOOGLE_SERVICES_JSON`, value = the full contents of that file.
4. Firebase → **Project settings → Service accounts → Generate new private key** → download JSON.
   Supabase → **Edge Functions → Secrets** → add `FCM_SERVICE_ACCOUNT` = the full contents of that JSON.
   (If "Firebase Cloud Messaging API (V1)" shows disabled, enable it in Project settings → Cloud Messaging.)
5. GitHub → **Actions → Build Android APK → Run workflow**, then install the new APK, open it once, allow notifications, sign in.

Test: from another account send yourself a message while the app is closed.
