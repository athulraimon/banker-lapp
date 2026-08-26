# Banker Lapp — F1 Private Predictions

A private Formula 1 predictions championship. Call the pole-sitter and the
podium for each Grand Prix, get scored against the real result, climb the
season table.

**Live app:** [banker-lapp-web.onrender.com](https://banker-lapp-web.onrender.com)
— installs to any phone or desktop. Look around as a guest, or sign in with
Google to play.

## The game

- Pick **Pole, P1, P2 and P3** before Practice 1 starts, which is when picks lock.
- Points, exact matches only: **Pole 5 · P1 15 · P2 10 · P3 8**.
- Your pole pick can also be your P1. P1/P2/P3 must be three different drivers.
- The calendar, the driver grid and the official results come live from the
  [Jolpica F1 API](https://api.jolpi.ca). Nothing is made up.

Guests see the calendar, circuits, results and the F1 drivers' championship, and
can try the prediction sheet. Saving a prediction or seeing the league table
needs an account.

## Built with

| Part | What it is |
|---|---|
| Backend | Go (Echo) API, one Docker container on Render's free tier |
| Database | [Neon](https://neon.tech) free Postgres |
| App | One Expo / React Native codebase, shipped as an installable web app (PWA) and an Android APK |
| Auth | Google Sign-In. Admin rights come from an `ADMIN_EMAILS` list |

Every push to `main` deploys itself.

## Run it locally

You need Go 1.24+, Node 18+ and Docker.

```bash
docker compose up -d                  # Postgres on port 5433
cd backend && go run ./cmd/api        # API on :9000, migrations run themselves
```

The API reads `backend/.env` — copy `backend/.env.example` to start.

```bash
cd mobile
npm install --legacy-peer-deps
npm run web                           # http://localhost:8081
```

In development, `POST /auth/dev` hands you an admin session with no Google
account needed. From there: **Admin → Sync F1 Schedule** loads the real
calendar, then set a result and watch the scores land.

For the native build use `npx expo run:android`, and point it at
`http://10.0.2.2:9000` in `mobile/.env.local` — an emulator cannot see
`localhost`. Expo Go will not work, because Google Sign-In is a native module.

## Repo layout

```
backend/            Go API — cmd/api, internal/*, migrations/
mobile/             Expo app — app/ routes, src/ shared code, public/ PWA assets
scripts/            Database migration + backup helper
render.yaml         Render blueprint: the API and the web app
docker-compose.yml  Local Postgres
.github/workflows/  CI on every push, plus the keep-alive ping
```

## Deploying, Google sign-in, installing on an iPhone

All in **[DEPLOYMENT.md](DEPLOYMENT.md)**.
