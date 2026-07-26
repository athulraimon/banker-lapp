# Banker Lapp — Deployment & Operations Guide

Everything needed to run Banker Lapp for real users, with **no manual deploy step
and no machine of yours left switched on**.

1. [What changed](#what-changed)
2. [Architecture](#architecture)
3. [Environment variables](#environment-variables)
4. [Google Sign-In setup](#google-sign-in-setup) — **required for real logins**
5. [Deploying to Render](#deploying-to-render)
6. [Installing the app](#installing-the-app) — iPhone, Android, desktop
7. [The Android APK (optional)](#the-android-apk-optional)
8. [Cold starts and the keep-alive](#cold-starts-and-the-keep-alive)
9. [Admin workflow](#admin-workflow)
10. [Local development](#local-development)

---

## What changed

Three problems drove this restructure:

| Problem | Fix |
|---|---|
| Backend had to be started by hand on your laptop | Render Blueprint with `autoDeploy: true` — push to `main` and it ships |
| No free way to get the app onto an iPhone | The app is now also a **PWA**, installed from Safari for free |
| Three things to host (API, Postgres, Redis) | **Redis removed** — one container, one database |

The React Native codebase was **not** replaced. Expo's web target renders the
same components through `react-native-web`, so the design and functionality are
the ones you already had. Only two modules needed platform-specific versions:

- `src/auth/googleAuth.ts` / `.web.ts` — Play Services on Android, an OpenID
  Connect redirect on web.
- `src/store/storage.ts` / `.web.ts` — `expo-secure-store` on Android,
  `localStorage` on web.

Metro picks the right file per platform automatically. Every screen is shared.

---

## Architecture

- **Backend** — Go (Echo) API + PostgreSQL, deployed as a Docker container on
  Render's free tier.
- **Web app (PWA)** — the Expo app exported for web, served as a Render static
  site. Installable on iOS, Android and desktop.
- **Android app (optional)** — the same codebase built as an APK via EAS, still
  supported but no longer required.
- **Auth** — Google Sign-In only. Admin rights come from `ADMIN_EMAILS`.
- **Data** — F1 calendar and driver grid from the public
  [OpenF1 API](https://openf1.org). No mock/seed data.

**Redis is gone.** Refresh tokens live in a `refresh_tokens` Postgres table
(migration `006`), and the driver grid is cached in-process. That removed a whole
service from the deployment, which is what makes the free tier viable.

---

## Environment variables

Backend:

| Variable | Required | Example | Notes |
|---|---|---|---|
| `APP_ENV` | no | `production` | `production` enables strict safety checks |
| `DATABASE_URL` | yes | `postgres://…` | Injected by Render from the database |
| `JWT_SECRET` | yes | *(32+ random chars)* | Render generates and keeps this |
| `GOOGLE_CLIENT_ID` | yes | `123-abc.apps.googleusercontent.com` | **Web** client ID |
| `ADMIN_EMAILS` | yes | `athulraimon@gmail.com` | Comma-separated |
| `ALLOWED_ORIGINS` | yes in prod | `https://banker-lapp-web.onrender.com` | The PWA's origin — CORS blocks it otherwise |
| `DEFAULT_SEASON` | no | `2026` | |
| `PORT` | no | `8080` | |
| `AUTO_MIGRATE` | no | `true` | Runs SQL migrations on boot |
| `ENABLE_DEV_LOGIN` | no | `false` | Forced **off** in production |

`REDIS_URL` is no longer read and can be deleted from any `.env`.

Frontend (build-time, baked into the bundle):

| Variable | Example |
|---|---|
| `EXPO_PUBLIC_API_URL` | `https://banker-lapp-api.onrender.com` |
| `EXPO_PUBLIC_WEB_CLIENT_ID` | `123-abc.apps.googleusercontent.com` |

---

## Google Sign-In setup

Once, in the [Google Cloud Console](https://console.cloud.google.com/). It needs
your Google account, so it cannot be automated.

1. **Create a project** (e.g. "Banker Lapp").
2. **OAuth consent screen** → **External** → app name + support email.
   - **Publish to Production**. Banker Lapp requests only `openid`, `email` and
     `profile`, so Production needs no Google verification and shows no
     "unverified app" warning — and any Google account can log in. Leave it in
     **Testing** only if you want to restrict logins to a manual list (max 100).
   - Do not add sensitive scopes; that would trigger verification.
3. **Credentials → Create Credentials → OAuth client ID → Web application.**
   - Name it "Banker Lapp Web".
   - **Authorized JavaScript origins:** your PWA origin, e.g.
     `https://banker-lapp-web.onrender.com`
   - **Authorized redirect URIs:** the same origin **with a trailing slash**,
     e.g. `https://banker-lapp-web.onrender.com/`

     > This is new, and the web login **will not work without it**. The web flow
     > redirects to Google and back, and Google rejects any redirect URI not
     > listed here character-for-character. Add `http://localhost:8081/` too if
     > you want to test the web login locally.
   - Copy the **Client ID** → `GOOGLE_CLIENT_ID` (backend) and
     `EXPO_PUBLIC_WEB_CLIENT_ID` (frontend).
4. **Only if you still ship the Android APK** — Credentials → OAuth client ID →
   **Android**, package `com.athulraimon.mobile`, SHA-1
   `3B:DF:72:B3:6D:EF:ED:49:84:83:B8:A9:A2:04:E9:B6:25:B3:5D:22`.

---

## Deploying to Render

`render.yaml` in the repo root is a **Blueprint**: it declares the API, the
database and the static web app in one file.

### First, one git repository at the project root

Right now the only git repo is `mobile/.git`. Render needs to see `render.yaml`,
`backend/` and `mobile/` in a **single** repository, so initialise one at
`C:\coding\banker_lapp`:

```bash
cd C:\coding\banker_lapp
rmdir /s /q mobile\.git      # cmd; or: Remove-Item -Recurse -Force mobile\.git
git init
git add .
git commit -m "Restructure: PWA + Render deploy, drop Redis"
git remote add origin https://github.com/<you>/banker-lapp.git
git push -u origin main
```

Deleting `mobile/.git` matters: a nested repository is committed as an empty
gitlink, so Render would clone a repo with no app source in it. If you want the
mobile history preserved, move that repo up to the root instead of deleting it.

The new root `.gitignore` keeps `backend/.env`, keystores and the 84 MB
`BankerLapp.apk` out of the push — check `git status` before the first commit
and confirm no `.env` is staged.

### Then

1. Push the repo to GitHub.
2. Render Dashboard → **New** → **Blueprint** → pick the repo.
3. Render reads `render.yaml`, creates all three services, and wires
   `DATABASE_URL` and `JWT_SECRET` automatically.
4. Fill in the values marked `sync: false`, which Render prompts for:
   - `banker-lapp-api`: `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS`, `ALLOWED_ORIGINS`
   - `banker-lapp-web`: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_CLIENT_ID`

   Chicken-and-egg: you don't know the URLs until Render creates the services.
   Deploy once, copy the two URLs from the dashboard, set the variables, let it
   redeploy.
5. Add the web URL to Google's authorized origins and redirect URIs (above).

**From then on there is no deploy step.** `autoDeploy: true` means every push to
`main` rebuilds and ships both halves. Migrations apply themselves on boot.

`.github/workflows/ci.yml` typechecks, vets and builds both halves on every push,
so a broken commit is caught before Render tries to ship it.

### Free-tier limits worth knowing

- The API sleeps after 15 minutes idle — see [cold starts](#cold-starts-and-the-keep-alive).
- Render's free Postgres expires after **30 days** unless upgraded. If that
  bites, swap in a [Neon](https://neon.tech) free database: create it, copy the
  connection string into `DATABASE_URL`, and delete the `databases:` block from
  `render.yaml`. Nothing in the code changes.

---

## Installing the app

**iPhone / iPad** — open the web URL in **Safari** (this does not work in Chrome
on iOS), tap **Share** → **Add to Home Screen**. It launches full-screen with no
address bar, gets its own icon, and behaves like an installed app.

> This is the free route, and it is the only permanent one. Native iOS
> distribution — TestFlight or the App Store — requires the Apple Developer
> Program at $99/year, which has no free tier. Ad-hoc distribution needs the same
> paid account. A PWA is the standard answer, at the cost of no push
> notifications worth relying on and no App Store listing.

**Android** — open the URL in Chrome and accept the **Install app** prompt, or
menu → **Install app**. Or keep using the APK.

**Desktop** — Chrome/Edge show an install icon in the address bar.

---

## The Android APK (optional)

Still fully supported; nothing about the native build changed except that
`react-native-mmkv` and `@gorhom/bottom-sheet` were removed (both were unused).

```bash
cd mobile
npx eas-cli build --platform android --profile preview
```

Update `EXPO_PUBLIC_API_URL` in `eas.json` to the Render API URL first — the old
ngrok tunnel URL dies when you move off the laptop. JS-only changes can still go
out over the air with `npx eas-cli update --branch preview`.

If everyone is happy with the PWA you can skip this entirely and stop
maintaining the keystore.

---

## Cold starts and the keep-alive

Render's free tier sleeps a web service after **15 minutes** with no traffic. The
next request then waits **~50 seconds** while the container starts, during which
the app looks frozen.

`.github/workflows/keepalive.yml` pings `/health` every 10 minutes between 09:00
and 23:00 UTC to keep it awake during the hours anyone uses it. To turn it on,
set a repository variable `API_URL` (Settings → Secrets and variables → Actions →
Variables) to your Render API URL.

It deliberately does not run overnight — that would burn free instance hours for
nobody. If a race weekend falls outside that window, widen the cron.

The static web app has no cold start; it is plain files on a CDN.

---

## Admin workflow

Log in with an `ADMIN_EMAILS` account, open the **Admin** tab:

1. **Sync F1 Schedule** — pulls the real Grand Prix calendar from OpenF1.
2. **Set Results** — enter the official pole + P1/P2/P3. Scores recalculate.
3. **Run Scoring** — re-run scoring for a race.
4. **Predictions** — view and edit any user's prediction (bypasses the FP1 lock).

Scoring: Pole = 5, P1 = 15, P2 = 10, P3 = 8 (exact match).

---

## Local development

```bash
docker compose up -d          # Postgres only now
cd backend && go run ./cmd/api
```

```bash
cd mobile
npm install --legacy-peer-deps
npm run web                   # browser, http://localhost:8081
npx expo run:android          # native build
```

`mobile/.env.local` drives both:

```env
EXPO_PUBLIC_API_URL=http://localhost:9000
EXPO_PUBLIC_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

Use `http://10.0.2.2:9000` instead for the Android emulator, which cannot see
`localhost`. In development `ENABLE_DEV_LOGIN` defaults on, exposing
`POST /auth/dev` for an admin session with no Google account.

To check the production web bundle locally:

```bash
npm run build:web && npm run serve:web
```
