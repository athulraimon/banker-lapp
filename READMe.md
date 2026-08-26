# Banker Lapp — F1 Private Predictions

A private Formula 1 predictions championship: predict Pole + the P1/P2/P3 podium for each Grand Prix, get scored against the real results, and climb the season leaderboard.

- **Backend:** Go (Echo) · PostgreSQL
- **App:** Expo / React Native — runs as an **installable PWA** (iOS, Android, desktop) and as a native Android APK, from one codebase
- **Auth:** Google Sign-In (admin rights via an email allowlist)
- **Data:** live F1 calendar + driver grid from the [Jolpica F1 API](https://api.jolpi.ca) (the community successor to Ergast) — no mock/seed data
- **Hosting:** Render free tier (API + PWA) with a [Neon](https://neon.tech) free Postgres, auto-deployed on push

> **Deploying, Google login setup, or installing on an iPhone?** See **[DEPLOYMENT.md](DEPLOYMENT.md)**.

## Architecture

Clean-architecture Go backend (domain → repository → service → handler) with:

- **Auth** — Google ID-token verification → short-lived JWT access tokens + refresh tokens stored in Postgres. Admin status is derived from the `ADMIN_EMAILS` allowlist on every login.
- **Schedule & drivers** — pulled live from Jolpica (admin taps *Sync Schedule*; the driver grid is cached in-process).
- **Scoring engine** — exact-match: Pole = 5, P1 = 15, P2 = 10, P3 = 8.
- **Admin controls** — set official results (auto-rescores), re-run scoring, and edit any user's prediction.
- **Migrations** — embedded SQL, applied automatically on boot.

App: Google login, dashboard with the active GP + calendar, prediction editor with a live driver search sheet, championship standings, per-race breakdown, and an admin panel.

### One codebase, three targets

Screens and styling are shared. Only two modules have platform-specific
implementations, resolved automatically by Metro's `.web.ts` extension:

| Module | Native | Web |
|---|---|---|
| `src/auth/googleAuth` | Google Play Services sign-in | OpenID Connect redirect |
| `src/store/storage` | `expo-secure-store` | `localStorage` |

`src/components/AppShell` additionally constrains the web layout to a
phone-width column so the mobile design isn't stretched across a desktop
monitor.

## Quick start (local development)

### Prerequisites
- Go 1.24+
- Node.js 18+
- Docker + Docker Compose
- Android Studio (emulator) or a physical Android device — only if you want the native build

### 1. Infrastructure

```bash
docker compose up -d
```

Starts PostgreSQL on host port **5433** (→ container 5432). Port 5433 avoids clashing with a native PostgreSQL install that commonly owns 5432 on Windows. Redis is no longer needed.

### 2. Backend

`backend/.env` (already present for local dev):

```env
APP_ENV=development
DATABASE_URL=postgres://postgres:password@localhost:5433/banker_lapp?sslmode=disable
JWT_SECRET=super_secret_jwt_key_for_local_dev_123
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
ADMIN_EMAILS=you@example.com
DEFAULT_SEASON=2026
PORT=9000
```

Run it:

```bash
cd backend
go run ./cmd/api
```

Migrations apply automatically. Health: `GET http://localhost:9000/health`, readiness: `GET /ready`.

> In development, `ENABLE_DEV_LOGIN` defaults on, exposing `POST /auth/dev` for an admin session with no Google account. It is force-disabled when `APP_ENV=production`.

### 3. App

```bash
cd mobile
npm install --legacy-peer-deps
```

**Web (fastest loop — no emulator, no native build):**

```bash
npm run web          # http://localhost:8081
```

**Android:**

```bash
npx expo run:android
```

`mobile/.env.local` points the app at the backend:

```env
EXPO_PUBLIC_API_URL=http://localhost:9000
EXPO_PUBLIC_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

On the Android emulator use `http://10.0.2.2:9000` — the emulator cannot see `localhost`. The native build uses native modules (Google Sign-In), so **Expo Go will not work**; use the development build above. The web target has no such restriction.

### 4. Try it

1. Launch the app → **Dev Mode Login Bypass** (dev builds only) signs you in as an admin.
2. **Admin tab → Sync F1 Schedule** loads the real 2026 calendar from Jolpica.
3. Open a race and submit a prediction; as admin, set results and watch scores + standings update.

## Scoring

| Slot | Points |
|------|--------|
| Pole (exact) | 5 |
| P1 (exact) | 15 |
| P2 (exact) | 10 |
| P3 (exact) | 8 |

The pole-sitter may also be your P1 (that's allowed); P1/P2/P3 must be three different drivers.

## Repo layout

```
backend/          Go API (cmd/api, internal/*, migrations/)
mobile/           Expo app — app/ routes, src/ shared code, public/ PWA assets
render.yaml       Render Blueprint: API + Postgres + static web app
docker-compose.yml  Local Postgres
.github/workflows/  CI on every push, plus the free-tier keep-alive ping
```
