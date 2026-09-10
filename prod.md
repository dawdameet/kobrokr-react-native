# Kobrokr Mobile — Production & Release Playbook (`prod.md`)

This document is your end-to-end guide to taking **Kobrokr Mobile** from local development to the **Apple App Store** and **Google Play Store**, plus how to maintain, test, and auto-deploy updates henceforth.

---

## 1. Architecture Overview

- **Mobile App:** React Native / Expo (`kobrokr-mobile`)
- **Production Backend:** Python API hosted on Render (`https://abc.onrender.com`)
- **Database:** Managed Cloud PostgreSQL (Render / Supabase / AWS RDS)
- **Deployment Platform:** Expo Application Services (EAS)
- **OTA Updates:** EAS Update (bypasses App Store review for JS/UI changes)

---

## 2. Phase 1: Pre-Flight Backend Checks (Render)

Before building the production app, verify your live backend:

- [ ] **Prevent Free Tier Sleep / Cold Starts:**
  - If your Render backend is on the Free tier, it goes to sleep after 15 minutes. The 30–50s wake-up delay will cause Apple/Google store reviewers to reject the app for timeouts.
  - **Solution:** Upgrade to Render Starter plan ($7/mo) **OR** set up a free monitor on [UptimeRobot](https://uptimerobot.com) to ping your `/health` endpoint every 5 minutes.
- [ ] **Cloud Database Persistence:**
  - Ensure your backend connects to a managed PostgreSQL database, not a local SQLite file (Render container storage is wiped on redeploys).
- [ ] **Reviewer Demo Accounts:**
  - Create two dedicated accounts in your production database that reviewers can log into:
    - Broker Account: `reviewer_broker@kobrokr.com` (with 2–3 sample active listings already added)
    - Tenant Account: `reviewer_tenant@kobrokr.com`

---

## 3. Phase 2: Developer Accounts & Store Requirements

### A. Apple Developer Program ($99 / year)
- [ ] Enroll at [developer.apple.com](https://developer.apple.com/programs/).
- [ ] Individual account requires government ID; Organization account requires a D-U-N-S number (takes 3–5 days to obtain for free).
- [ ] Provides access to **App Store Connect** and **TestFlight**.

### B. Google Play Console ($25 one-time fee)
- [ ] Register at [play.google.com/console](https://play.google.com/console).
- [ ] **Important note for personal accounts created after Nov 2023:** Google requires running a closed test with at least 12–20 testers for 14 continuous days before production release is enabled. (Organization accounts are exempt).

### C. Mandatory Store Policies & Legal Assets
- [ ] **Privacy Policy URL:** Host a privacy policy page on your website (e.g., `https://kobrokr.com/privacy`).
- [ ] **Terms of Service URL:** (e.g., `https://kobrokr.com/terms`).
- [ ] **In-App Account Deletion (Mandatory):**
  - Both Apple (Guideline 5.1.1(v)) and Google require apps with account creation to allow users to initiate account and data deletion from within the app (e.g. inside the Profile screen).
- [ ] **Support Contact:** Public support email address (e.g., `support@kobrokr.com`).
- [ ] **Store Graphics & Screenshots:**
  - App Icon: 1024x1024 PNG (no transparency).
  - Screenshots: iOS (6.7" and 6.5" iPhones) and Android phone screenshots.

---

## 4. Phase 3: Expo Application Services (EAS) Setup

Expo Application Services (EAS) compiles and signs your iOS (`.ipa`) and Android (`.aab`) binaries in the cloud without needing local Xcode or Android Studio signing keys.

1. **Install EAS CLI and Log In:**
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. **Initialize EAS in `kobrokr-mobile`:**
   ```bash
   eas build:configure
   ```
   This generates `eas.json` in your project with build profiles (`development`, `preview`, `production`).

3. **Configure Production Environment Variables:**
   - In EAS, configure your live Render API URL (`EXPO_PUBLIC_API_URL=https://abc.onrender.com`).
   - You can set this via the Expo web dashboard under **Project Secrets** or in `eas.json`.

---

## 5. Phase 4: Building & Beta Testing (Before Public Launch)

Never release directly to the public store without testing a signed build.

### A. Build for Testing (Preview / TestFlight)
Run the build command:
```bash
# Build for both platforms in EAS cloud
eas build --platform all --profile preview
```
- **For iOS:** Produces a TestFlight build uploaded automatically or manually to App Store Connect.
- **For Android:** Produces an `.aab` or `.apk` for Google Play Internal Testing.

### B. Testing Routine
- [ ] Install on real physical iPhones via **Apple TestFlight**.
- [ ] Install on Android devices via **Google Play Internal Testing track**.
- [ ] Test on cellular data (4G/5G) to ensure network timeouts and Render API latency behave properly.
- [ ] Verify core journeys: Login, OTP/Auth, Listings Feed, Create Listing, Image Uploads, Profile, and Logout.

---

## 6. Phase 5: Store Submission & Review

Once testing on TestFlight and Internal Testing is verified:

1. **Build Production Binaries:**
   ```bash
   eas build --platform all --profile production
   ```

2. **Submit to Stores:**
   ```bash
   eas submit --platform all
   ```
   EAS automatically connects to App Store Connect and Google Play Console using your store credentials and uploads the binaries.

3. **Complete Store Listings:**
   - In App Store Connect & Google Play Console:
     - Enter title, keywords, descriptions, and categories.
     - Upload screenshots and app icon.
     - Complete content rating questionnaires (select all that apply).
     - Paste your test reviewer credentials into the "App Review Information" section.
4. **Submit for Review:**
   - Apple review typically takes **24–48 hours**.
   - Google Play review typically takes **1–4 days**.

---

## 7. Phase 6: Maintenance & CI/CD Pipeline (Henceforth)

Once your app is live in the stores, your release flow splits into two paths:

### 1. Day-to-Day Changes: Over-The-Air (OTA) Updates via `EAS Update`
For UI changes, bug fixes, text corrections, and logic updates:
- **No store review required.**
- **No app download required from users.**
- When you run:
  ```bash
  eas update --branch production --message "Fix dashboard layout"
  ```
- EAS publishes the updated bundle to Expo's CDN.
- When users open the app on iOS or Android, the app silently downloads the update and applies it immediately.

### 2. Full Native Store Releases (Only when necessary)
You only need to rebuild binaries and submit to Apple/Google review when:
- Adding a new native library or device API (e.g. camera, Bluetooth, Apple Pay).
- Upgrading Expo SDK version (e.g. SDK 51 to 52).
- Changing app permissions, app icon, or splash screen.

### 3. Automated "Push to Git" Pipeline (GitHub Actions)
You can automate OTA updates so merging to Git feels like web deployment:

```
Developer pushes code ➔ Pull Request merged to `main` 
                       ➔ GitHub Action runs tests & typechecks
                       ➔ GitHub Action runs `eas update --branch production`
                       ➔ All iOS & Android users receive update within 2 minutes!
```

### 4. Health & Crash Monitoring
- **Sentry for React Native:** Integrates into Expo to alert you immediately whenever a user encounters a crash, identifying the exact line of code and device model.
- **Expo Dashboard (`expo.dev`):** View real-time rollouts and perform **1-Click Rollback** if an update introduces an unexpected bug.
