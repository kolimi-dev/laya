# Laya (లయ) Backend API — Personal Rhythm & Consistency Engine

> **Pressure-free personal consistency tracking and rhythm engine.**  
> Fastify 5 • TypeScript • PostgreSQL / In-Memory Event Sourcing • Resend OTP Gateway • Zero-Guilt Discipline

Part of the [Kolimi Studio](https://github.com/kolimi-dev) ecosystem.  
Live API Gateway: `https://tracker.kolimi.dev` | App Download: `https://laya.kolimi.dev/download`

---

## 1. Architecture Overview

Laya Backend is an asynchronous, high-throughput Fastify 5 REST API designed specifically for **offline-first consistency tracking**. It serves web clients, mobile apps (React Native / Expo), and platform integrations with deterministic mathematical evaluations and zero-guilt habit mechanics.

```mermaid
flowchart TD
    subgraph Clients["Clients"]
        Mobile["Laya Mobile (React Native / Expo)<br/>Local-first, AsyncStorage cache"]
        Web["Web Client (Static Bundle)<br/>Public Fastify assets"]
    end

    subgraph Fastify["Laya Fastify API Gateway (Port 4001)"]
        AuthMiddleware["JWT / Bearer Pre-Handler<br/>JWKS Verifier / Guest Mode"]
        Router["RFC 7807 Fastify Router"]
        
        subgraph Endpoints["Endpoints"]
            HealthEP["/health, /api/v1/health"]
            AuthEP["/api/v1/auth/email/*"]
            AppVerEP["/api/v1/app/version, /download"]
            FeedEP["/api/v1/feedback"]
            TaskEP["/api/v1/tasks, /api/v1/tasks/active"]
            GroupEP["/api/v1/groups"]
            ConstEP["/api/v1/consistency/summary"]
            DataEP["/api/v1/data/export, /import"]
            TelemEP["/api/v1/telemetry/events"]
        end
    end

    subgraph Persistence["Storage Layer (TrackerRepository)"]
        MemoryRepo["InMemoryTrackerRepository<br/>(Local dev, tests, zero-dependency)"]
        PGRepo["PostgresTrackerRepository<br/>(Production tracker.* append-only store)"]
    end

    subgraph Gateways["External Gateways"]
        Resend["Resend Email Gateway<br/>(auth@kolimi.dev, OTP & Direct Feedback)"]
        RawGitHub["GitHub Raw Manifest Proxy<br/>(kolimi-dev/laya-mobile publish/version.json)"]
    end

    Clients -->|Bearer JWT or Guest| AuthMiddleware
    AuthMiddleware --> Router
    Router --> Endpoints
    AuthEP --> Resend
    FeedEP --> Resend
    AppVerEP --> RawGitHub
    TaskEP --> Persistence
    GroupEP --> Persistence
    ConstEP --> Persistence
    DataEP --> Persistence
```

### Key Architectural Tenets:
1. **Offline-First Synchronization:** Clients log habits locally into an append-only store with client-generated UUID idempotency keys (`evt_...`). When connectivity is restored, clients post events to `POST /api/v1/tasks/:id/events` or synchronize state via `SyncService`. If an event was already processed, the backend returns idempotent success (`200 OK`).
2. **JWT Authorization & Guest Mode:** Production endpoints authenticate via standard `Authorization: Bearer <token>` signed by `kolimi-platform` JWKS or generated through the Email OTP flow (`/api/v1/auth/email/verify-otp`). Unauthenticated guest users operate with offline local persistence (`usr_guest`) and can submit feedback or check versions without friction.
3. **Resend Email Gateway:** Transactional emails (one-time verification passwords from `auth@kolimi.dev` and direct user feedback delivered to `FEEDBACK_TARGET_EMAIL`) are dispatched asynchronously using Resend. When `RESEND_API_KEY` is omitted (e.g., local development), OTP codes are printed directly to standard output (`stdout`) for frictionless developer velocity.
4. **Pluggable Storage (Postgres vs. In-Memory):** The service implements the `TrackerRepository` interface. Supplying a `DATABASE_URL` connects to PostgreSQL and applies schema migrations (`tracker.*`); omitting it boots an ultra-fast `InMemoryTrackerRepository`, enabling instantaneous testing and local development with zero external daemon setup.

---

## 2. API Endpoints Reference

All endpoints return JSON responses. Errors follow the **RFC 7807 Problem Details** standard with `code`, `title`, `status`, and `detail`.

### 2.1 Public Infrastructure & Discovery

#### `GET /health` or `GET /api/v1/health`
Checks server status and uptime.
- **Auth:** None (Public)
- **Response `200 OK`:**
  ```json
  {
    "status": "ok",
    "service": "laya",
    "timestamp": "2026-11-16T21:40:00.000Z"
  }
  ```

#### `GET /api/v1/app/version`
Serves the latest mobile release version manifest. Proxies `publish/version.json` with an in-memory 60-second cache.
- **Auth:** None (Public)
- **Response `200 OK`:**
  ```json
  {
    "latestVersion": "1.2.3",
    "apkUrl": "https://expo.dev/artifacts/eas/BMTsnXw8bDxRuygY_qhx5Z15Et9RpG_8PnQ_s5F_5pA.apk",
    "releaseNotes": [
      "Direct in-app feedback channel with silent delivery",
      "Task creation defaults to Once (Single occurrence)",
      "Habit rollover engine (ADR-0019)"
    ]
  }
  ```

#### `GET /download` or `GET /api/v1/app/download`
Issues an HTTP `302 Found` permanent redirect directly to the latest production APK artifact URL.
- **Auth:** None (Public)
- **Response:** `302 Found` with `Location: <apkUrl>`.

---

### 2.2 Email OTP Authentication (Resend)

#### `POST /api/v1/auth/email/send-otp`
Requests a 6-digit verification code sent to the specified email address.
- **Auth:** None (Public)
- **Rate Limit:** 3 requests per 15-minute sliding window; 60-second cooldown between requests.
- **Request Body:**
  ```json
  {
    "email": "user@kolimi.dev"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "message": "Verification code sent to your email."
  }
  ```

#### `POST /api/v1/auth/email/verify-otp`
Validates the 6-digit verification code and returns a signed JWT access token.
- **Auth:** None (Public)
- **Rate Limit:** Max 5 failed attempts per challenge before invalidation.
- **Request Body:**
  ```json
  {
    "email": "user@kolimi.dev",
    "otpCode": "271956"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "message": "Authentication successful",
    "user": {
      "id": "usr_01H...",
      "email": "user@kolimi.dev"
    },
    "session": {
      "accessToken": "eyJhbGciOi...",
      "tokenType": "Bearer",
      "expiresIn": 2592000
    }
  }
  ```

---

### 2.3 Universal Direct Feedback

#### `POST /api/v1/feedback`
Direct in-app feedback gateway. Dispatches user reports, feature requests, or bugs directly to `FEEDBACK_TARGET_EMAIL` via Resend with device diagnostics.
- **Auth:** Optional (`Bearer <token>` will identify user identity; unauthenticated guest submissions are accepted with `guest` identity).
- **Request Body:**
  ```json
  {
    "category": "bug",
    "message": "Chart heatmap cell tap shows misaligned date tooltip.",
    "senderName": "Alice",
    "email": "alice@example.com",
    "diagnostics": "App: 1.2.3 (6) | OS: android 14 | Screen: 1080x2400"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "feedbackId": "fbk_a1b2c3d4...",
    "receivedAt": "2026-11-16T21:45:00.000Z",
    "message": "Thank you! Your feedback has been routed directly to the engineering team."
  }
  ```

---

### 2.4 Habit Groups (`/api/v1/groups`)

- `GET /api/v1/groups`: Lists all active habit groups for the authenticated user ordered by `sortOrder`.
- `POST /api/v1/groups`: Creates a custom group (`name`, `color`, `sortOrder`, `schedule`).
- `PATCH /api/v1/groups/:id`: Updates group metadata, sort order, or pause/active lifecycle status.
- `DELETE /api/v1/groups/:id`: Soft-deletes a group and reassigns orphaned habits to fallback group.

---

### 2.5 Tasks & Dynamic Checklist (`/api/v1/tasks`)

- `GET /api/v1/tasks`: Lists all habit definitions for the user across all cadences.
- `POST /api/v1/tasks`: Creates a task. Supports 4 flavors:
  - `checklist`: Binary checkoff (Yes/No).
  - `quantified`: Target numeric amount and unit (e.g. `4 L`, `20 pages`).
  - `milestone`: Ordered checkpoints (e.g. `1L`, `2L`, `3L`) with `all` or `any` mode.
  - `flexible_baseline`: Multi-criterion criteria array (e.g. `Distance 2km OR Duration 20min`).
  Supports cadences: `daily`, `days_of_week`, `monthly`, `yearly`, `custom` (interval days), `one_time`, `anytime`.
- `GET /api/v1/tasks/active`: Computes and returns **Today's Active Checklist**, evaluating recurrence masks, operational day cutoffs, and rolling forward uncompleted habits (ADR-0019).
- `PATCH /api/v1/tasks/:id`: Updates habit configuration, lifecycle status (`active`, `paused`, `completed`, `retired`), or cadence.
- `DELETE /api/v1/tasks/:id`: Soft-deletes habit (`deletedAt: ISO timestamp`).
- `POST /api/v1/tasks/:id/archive`: Retires habit from active checklist while preserving historical consistency.
- `POST /api/v1/tasks/:id/events`: Appends a completion event (`status: 'completed' | 'in_progress' | 'ignored'`). Client-generated UUIDs ensure idempotent offline sync.

---

### 2.6 Consistency Math & Denominator Exemption

#### `GET /api/v1/consistency/summary`
Calculates consistency ratings across all user groups.
- **The Guilt-Free Rest Formula (ADR-0001):**
  $$\text{Consistency Rating (\%)} = \frac{\sum \text{Completed Points}}{\text{Total Scheduled Points} - \text{Ignored Points}} \times 100$$
  Ignored rest days are subtracted from the denominator, ensuring intentional rest or recovery never degrades a user's score.

---

### 2.7 Data Portability & Telemetry

- `GET /api/v1/data/export`: Full GDPR JSON export of all groups, tasks, and completion events.
- `POST /api/v1/data/import`: Merges an exported JSON backup with existing user state.
- `POST /api/v1/telemetry/events`: Ingests anonymous UX interaction telemetry.

---

## 3. Environment Configuration Standards

Create a `.env` file in the project root:

| Variable | Type | Default | Description |
|---|---|---|---|
| `NODE_ENV` | String | `development` | Environment mode (`development`, `test`, `production`). |
| `PORT` | Number | `4001` | Fastify server listening port. |
| `HOST` | String | `0.0.0.0` | Binding host address (`0.0.0.0` for all interfaces). |
| `CORS_ORIGIN` | String | `*` | Allowed CORS origins (set to `https://laya.kolimi.dev` in production). |
| `JWT_SECRET` | String | `laya_dev_jwt_secret...` | Secret key used to sign and verify local JWT sessions. |
| `JWKS_URL` | String | `https://platform.kolimi.dev/.well-known/jwks.json` | Remote JWKS authority endpoint. |
| `RESEND_API_KEY` | String | *(Optional)* | Resend API key (`re_...`). If omitted, OTPs log to console. |
| `EMAIL_FROM` | String | `Kolimi ID <auth@kolimi.dev>` | Sender email header for authentication OTPs. |
| `FEEDBACK_TARGET_EMAIL` | String | `hemanth@kolimi.dev` | Recipient inbox for direct in-app feedback submissions. |
| `FEEDBACK_FROM_EMAIL` | String | `Laya Feedback <feedback@kolimi.dev>` | Sender email header for routed feedback emails. |
| `DATABASE_URL` | String | *(Optional)* | PostgreSQL connection string (`postgres://user:pass@host:5432/db`). If omitted, uses in-memory store. |

---

## 4. Development & Quality Gates

Strict engineering guardrails are enforced across the codebase:
- **Line Count Budget:** Every `.ts` file must be strictly `< 300 lines` (`npm run lint:lines`).
- **Zero Architecture Violations:** Clean onion architecture validated by dependency cruiser (`npm run lint:arch`).
- **100% Test Pass Rate:** Vitest suites covering recurrence, math, errors, API routes, and end-to-end habit scenarios.

```bash
# Install dependencies
npm install

# Run unit and integration tests (127+ tests)
npm test

# Check line budgets (< 300 lines per file)
npm run lint:lines

# Check architectural boundaries
npm run lint:arch

# Compile TypeScript to dist/
npm run build
```

---

## 5. License

Apache-2.0 © Kolimi Studio
