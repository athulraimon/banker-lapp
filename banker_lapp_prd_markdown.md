# Banker Lapp — Product Requirements Document (PRD)

Version: 1.0
Platform: Android
Frontend: React Native + Expo + TypeScript
Backend: Go (Echo)
Database: PostgreSQL
Cache: Redis
Deployment Target: Hobby/Low-Cost Infrastructure

---

# 1. Product Overview

## Product Name
Banker Lapp

## Product Type
Private Formula 1 predictions championship application.

## Product Vision
Banker Lapp is a lightweight Formula 1 prediction platform designed for friend groups competing over a Formula 1 season.

Users predict:
- Pole Position
- Race Winner (P1)
- P2
- P3

Predictions lock at the start of FP1 for each race weekend.

After qualifying and race completion, official results are fetched from external F1 APIs and points are automatically awarded.

The app maintains a season-long global championship leaderboard.

---

# 2. Goals

## Primary Goals
- Create a simple and competitive F1 predictions app
- Automate scoring and standings
- Minimize admin effort
- Provide clean mobile UX
- Keep hosting and maintenance costs low

## Secondary Goals
- Provide historical race breakdowns
- Provide season standings and analytics
- Allow admin controls for recalculation and API refresh
- Build scalable backend foundations for future features

---

# 3. Non-Goals (V1)

The following features are intentionally excluded from V1:

- Sprint race predictions
- Multiple leagues
- iOS support
- Live timing
- Push notifications
- Fantasy budgets
- Driver transfers
- Fastest lap predictions
- Constructors predictions
- Chat/social feeds
- Web app

---

# 4. Target Users

## Primary Audience
Friend groups and Formula 1 fans who want a simple season-long prediction competition.

## Expected Scale
- 10–100 users
- Low write volume
- Moderate read traffic during race weekends

---

# 5. Core Gameplay Rules

## Predictions
Users predict:
- Pole Position
- Race P1
- Race P2
- Race P3

## Lock Deadline
Predictions lock exactly when FP1 starts for a race weekend.

Users may edit predictions unlimited times before FP1.

After FP1 begins:
- Predictions become immutable
- Users can no longer submit or edit predictions

## Exact Match Scoring
Predictions score only if the position is exactly correct.

Example:

Actual Results:
1. Verstappen
2. Norris
3. Leclerc

Prediction:
1. Norris
2. Verstappen
3. Leclerc

Result:
- Only P3 is correct
- User receives 8 points

No partial scoring is awarded.

---

# 6. Scoring System

| Prediction | Points |
|---|---|
| Correct Pole Position | 5 |
| Correct P1 | 15 |
| Correct P2 | 10 |
| Correct P3 | 8 |

## Tie-breaker Logic
If users have equal points:
1. Most correct race winners
2. Shared position if still tied

## Missed Predictions
If a user fails to submit predictions before lock:
- User receives 0 points for the race

---

# 7. Authentication

## Authentication Strategy
Google OAuth authentication.

Firebase Authentication will NOT be used.

## Flow
1. User signs in with Google
2. React Native app receives Google ID token
3. Token sent to Go backend
4. Backend validates token with Google
5. Backend creates/fetches user
6. Backend issues JWT access token

## User Data
Stored user information:
- Google ID
- Display name
- Email
- Profile photo URL
- Admin flag

---

# 8. Core Features

## 8.1 Authentication

### Features
- Google Sign-In
- Persistent login session
- Secure JWT authentication
- Automatic account creation

---

## 8.2 Race Calendar

### Features
- Fetch official race schedule from F1 APIs
- Display:
  - Grand Prix name
  - Circuit
  - Country
  - Race weekend schedule
  - FP1 time
  - Prediction lock countdown

### Race States
- Upcoming
- Predictions Open
- Locked
- Completed

---

## 8.3 Predictions

### Features
- Searchable dropdowns for driver selection
- Editable predictions before lock
- Server-side validation

### Validation Rules
- Duplicate drivers are not allowed
- Predictions lock at FP1 start
- Users cannot modify locked predictions

### UX Requirements
- Fast search experience
- Minimal friction for prediction editing
- Clean mobile-first interface

---

## 8.4 Race Results

### Features
- Display official qualifying results
- Display official race results
- Show user predictions vs actual results
- Show points earned for the race

---

## 8.5 Championship Standings

### Features
Global leaderboard showing:
- Rank
- User name
- Total points
- Correct winners count
- Pole prediction count

### Additional Views
- Race-specific standings
- User season history
- Race-by-race breakdown

---

## 8.6 Admin Controls

### Admin Capabilities
Admins can:
- Re-fetch race results from APIs
- Recalculate race scoring
- Override race results manually
- Re-run scoring engine

### Access Control
Admin routes protected by role-based authorization.

---

# 9. User Flows

## 9.1 Login Flow

1. User opens app
2. User taps Google Sign-In
3. Google authentication completes
4. App sends token to backend
5. Backend validates token
6. JWT issued
7. User enters app

---

## 9.2 Prediction Flow

1. User opens upcoming race
2. User views countdown to FP1
3. User selects:
   - Pole
   - P1
   - P2
   - P3
4. User saves predictions
5. User may edit predictions until FP1 begins

---

## 9.3 Result Processing Flow

1. Race or qualifying completes
2. Admin triggers fetch OR scheduled job runs
3. Backend fetches official results
4. Results stored locally
5. Scoring engine calculates points
6. Standings updated

---

# 10. Functional Requirements

## Authentication
System must:
- Support Google OAuth
- Verify Google tokens securely
- Issue JWT tokens
- Protect authenticated routes

## Race Management
System must:
- Fetch season schedule
- Store races locally
- Track FP1 lock timing
- Support race status updates

## Predictions
System must:
- Allow editable predictions before FP1
- Prevent edits after lock
- Prevent duplicate drivers
- Store historical predictions

## Scoring
System must:
- Calculate scores automatically
- Support recalculation
- Prevent duplicate scoring jobs
- Store scoring history

## Standings
System must:
- Calculate cumulative season standings
- Apply tie-breakers correctly
- Provide race-specific rankings

---

# 11. Non-Functional Requirements

## Performance
- Common API responses under 500ms
- Cached standings responses
- Optimized database queries

## Reliability
- Server-side prediction lock enforcement
- Resilient scoring jobs
- Retry mechanisms for API failures

## Scalability
System should comfortably support:
- 100+ concurrent users
- Entire F1 season history

## Security
- JWT authentication
- Protected admin routes
- Request validation
- Rate limiting

---

# 12. Frontend Architecture

## Stack
- React Native
- Expo
- TypeScript

## State Management
- Zustand

## Navigation
- Expo Router

## API Layer
- Axios

## Styling
- Tailwind Native OR custom theme system

## Design Direction
Hybrid of:
- Official F1 aesthetic
- Minimal modern UI

### Visual Characteristics
- Dark theme
- Red accent colors
- Sharp typography
- Large leaderboard cards
- Race countdown timers
- Minimal clutter

---

# 13. Backend Architecture

## Stack
- Go
- Echo framework

## Database
- PostgreSQL

## Cache
- Redis

## Auth
- Google OAuth verification
- JWT access tokens

## Deployment
- Fly.io OR Railway OR Render

---

# 14. Suggested External APIs

## Primary API
OpenF1 API

Used for:
- Sessions
- Drivers
- Qualifying results
- Race results

## Backup API
Jolpica F1 API

Used for:
- Historical race data
- Backup race schedules

---

# 15. Database Schema

## users

| Column | Type |
|---|---|
| id | uuid |
| google_id | text |
| display_name | text |
| email | text |
| photo_url | text |
| is_admin | boolean |
| created_at | timestamp |

---

## races

| Column | Type |
|---|---|
| id | uuid |
| api_race_id | text |
| grand_prix | text |
| circuit_name | text |
| country | text |
| fp1_time | timestamp |
| qualifying_time | timestamp |
| race_time | timestamp |
| season | int |
| status | text |

---

## predictions

| Column | Type |
|---|---|
| id | uuid |
| user_id | uuid |
| race_id | uuid |
| pole_driver_id | text |
| p1_driver_id | text |
| p2_driver_id | text |
| p3_driver_id | text |
| locked | boolean |
| created_at | timestamp |
| updated_at | timestamp |

---

## race_results

| Column | Type |
|---|---|
| id | uuid |
| race_id | uuid |
| pole_driver_id | text |
| p1_driver_id | text |
| p2_driver_id | text |
| p3_driver_id | text |
| fetched_at | timestamp |

---

## race_scores

| Column | Type |
|---|---|
| id | uuid |
| user_id | uuid |
| race_id | uuid |
| points | int |
| correct_winner | boolean |
| calculated_at | timestamp |

---

# 16. Backend Services

## Auth Service
Responsible for:
- Google token validation
- JWT issuance
- User synchronization

## Race Service
Responsible for:
- Race schedule sync
- Race state updates
- Result fetching

## Prediction Service
Responsible for:
- Prediction CRUD
- Validation
- Lock enforcement

## Scoring Service
Responsible for:
- Score calculation
- Leaderboard updates
- Recalculation logic

## Admin Service
Responsible for:
- Manual result refresh
- Manual recalculation
- Admin-only operations

---

# 17. Scheduled Jobs

## Schedule Sync
Runs daily:
- Fetch new or updated races

## Prediction Lock Job
Runs every minute:
- Lock predictions at FP1 start

## Result Fetcher
Runs:
- After qualifying
- After race completion

## Score Calculator
Runs after results fetch:
- Calculate race points
- Update standings

---

# 18. API Endpoints

## Auth

```http
POST /auth/google
POST /auth/refresh
POST /auth/logout
```

---

## Races

```http
GET /races
GET /races/:id
GET /races/:id/results
```

---

## Predictions

```http
GET /predictions/:raceId
POST /predictions
PUT /predictions/:id
```

---

## Standings

```http
GET /standings
GET /standings/race/:id
GET /users/:id/history
```

---

## Admin

```http
POST /admin/races/:id/refetch
POST /admin/races/:id/recalculate
PUT /admin/races/:id/results
```

---

# 19. Suggested Folder Structure

## React Native Frontend

```txt
src/
 ├── api/
 ├── components/
 ├── screens/
 ├── hooks/
 ├── store/
 ├── types/
 ├── navigation/
 ├── utils/
 ├── theme/
 └── assets/
```

---

## Go Backend

```txt
cmd/
internal/
 ├── auth/
 ├── races/
 ├── predictions/
 ├── scoring/
 ├── admin/
 ├── middleware/
 ├── db/
 ├── cache/
 ├── external/
 └── utils/
```

---

# 20. Suggested Screens

## Authentication
- Splash Screen
- Login Screen

## Main App
- Home Dashboard
- Upcoming Race Screen
- Prediction Editor
- Championship Standings
- Race Results
- User History

## Admin
- Admin Panel
- Manual Refresh Controls

---

# 21. Deployment Recommendation

## Backend Hosting
Fly.io

## Database
Neon PostgreSQL

## Redis
Upstash Redis

## Mobile Distribution
Android APK distribution OR Play Store Internal Testing

---

# 22. MVP Roadmap

## Phase 1 — Foundations
- Project setup
- Auth system
- Database setup
- Race schedule sync

## Phase 2 — Core Gameplay
- Prediction submission
- Prediction locking
- Race result fetching
- Scoring engine

## Phase 3 — Championship Features
- Leaderboards
- Race history
- User history

## Phase 4 — Admin Features
- Admin panel
- Recalculation
- API refresh
- Manual overrides

## Phase 5 — Polish
- UI refinement
- Performance optimization
- Error handling
- Production deployment

---

# 23. Future Enhancements

Potential future features:

- Push notifications
- Sprint predictions
- Multiple leagues
- Team mode
- Live standings
- Driver statistics
- Web dashboard
- Prediction streaks
- Achievement system
- Social features

---

# 24. Final Technical Recommendation

## Recommended Stack

### Frontend
- React Native
- Expo
- TypeScript
- Zustand
- Expo Router

### Backend
- Go
- Echo
- PostgreSQL
- Redis
- JWT Authentication

### Infrastructure
- Fly.io
- Neon PostgreSQL
- Upstash Redis

### APIs
- OpenF1 API
- Jolpica F1 API

This stack provides:
- Low operational cost
- Good developer experience
- Clean architecture
- Easy scalability
- Fast development velocity

