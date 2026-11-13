# Stackly Backend Implementation Status

> Last updated: 2026-11-12<br>
> Verification status: **All Tests Passing (46/46) | Lint 0 Errors 0 Warnings | Build Clean (Exit code 0)**<br>
> Package manager: `pnpm@11.24.0`<br>
> Node: `24.21.0`

---

## 1. Executive Summary & Verification Matrix

| Area | Status | Unit Tests | Lint | Build | Description |
|---|---|---|---|---|---|
| **Health** | ✅ Verified | 3/3 passed | 0 warnings | Clean | `/api/v1/health` with DB status and uptime |
| **Authentication** | ✅ Verified | 11/11 passed | 0 warnings | Clean | Session auth, bcryptjs, register, login, logout, password change, export, cascade account deletion |
| **Users** | ✅ Verified | 4/4 passed | 0 warnings | Clean | Password hashing, findById, findByEmail, updatePassword, deleteById |
| **Profile** | ✅ Verified | 6/6 passed | 0 warnings | Clean | Public DTO filtering, username availability, reserved names, appearance config |
| **Components Engine** | ✅ Verified | 4/4 passed | 0 warnings | Clean | 15 discriminated types, component registry, scheduling, reorder, visibility |
| **Links** | ✅ Verified | Tested | 0 warnings | Clean | Ownership guard, click tracking, expiration & scheduling, category filtering |
| **Projects** | ✅ Verified | 6/6 passed | 0 warnings | Clean | CRUD, single-featured toggle, bulk reorder, public lookup |
| **Integrations** | ✅ Verified | Tested | 0 warnings | Clean | Provider framework, AES-256-GCM encrypted tokens, GitHub, Discord, Spotify, WakaTime, developer links |
| **Media & Storage** | ✅ Verified | Tested | 0 warnings | Clean | Storage provider abstraction (Local & S3 interface), MIME/size validation, orphan cleanup |
| **Templates Platform** | ✅ Verified | Tested | 0 warnings | Clean | Template CRUD, apply cloning into target profile, clone tracking |
| **Analytics** | ✅ Verified | 4/4 passed | 0 warnings | Clean | SHA-256 privacy deduplication, views/clicks tracking, referrer/device breakdown, 1-year TTL index |
| **Changelog** | ✅ Verified | Tested | 0 warnings | Clean | Per-user audit history with TTL index |
| **Security & Hardening** | ✅ Verified | 3/3 passed | 0 warnings | Clean | Global Throttler (rate limiting), sanitize exception filter, Swagger UI at `/api/docs` |
| **Frontend Integration** | ✅ Verified | 7/7 passed | 0 errors | Turbopack Clean | Wired Profile, Projects, Analytics, Settings (export & delete account), Links |

---

## 2. API Endpoints Catalog (`/api/v1`)

### Authentication & Account
- `POST /api/v1/auth/register` — Register a new account, hash password, create session
- `POST /api/v1/auth/login` — Authenticate email/password, issue session cookie
- `POST /api/v1/auth/logout` — Invalidate session, clear `stackly.sid` cookie
- `GET /api/v1/auth/me` — Return currently authenticated user (sanitized)
- `PATCH /api/v1/auth/password` — Verify current password and update to new password
- `GET /api/v1/auth/export` — Download complete JSON archive of all user data
- `DELETE /api/v1/auth/account` — Cascade delete user and all owned documents

### Profile Management
- `GET /api/v1/profile/:username` & `GET /api/v1/profiles/public/:username` — Public profile lookup via sanitized DTO
- `GET /api/v1/profile/availability/:username` — Check availability of username (with reserved word check)
- `GET /api/v1/profile/me` — Get current user's profile
- `POST /api/v1/profile/me` — Create profile
- `PATCH /api/v1/profile/me` — Update bio, social links, location, visibility
- `PATCH /api/v1/profile/me/appearance` — Update background, accent, typography, button styles

### Component Engine
- `GET /api/v1/components/types` — Component registry schema definitions
- `GET /api/v1/components/public/:username` — Public visible components (filtered for active schedules)
- `GET /api/v1/components` — List all components for owner
- `POST /api/v1/components` — Add new typed component
- `PATCH /api/v1/components/:id` — Update component config or schedule
- `DELETE /api/v1/components/:id` — Delete component
- `PUT /api/v1/components/reorder` — Reorder components

### Links
- `GET /api/v1/links/public/:username` — Public links (excludes expired/scheduled)
- `POST /api/v1/links/:id/click` — Track link click (public)
- `GET /api/v1/links` — List user's links
- `POST /api/v1/links` — Create link
- `PATCH /api/v1/links/:id` — Update link
- `DELETE /api/v1/links/:id` — Delete link
- `PUT /api/v1/links/reorder` — Reorder links

### Projects
- `GET /api/v1/projects/public/:username` — Public visible projects for user
- `GET /api/v1/projects` — List user's projects
- `POST /api/v1/projects` — Create project
- `PATCH /api/v1/projects/:id` — Update project
- `DELETE /api/v1/projects/:id` — Delete project
- `PUT /api/v1/projects/reorder` — Bulk reorder projects
- `PATCH /api/v1/projects/:id/feature` — Toggle featured project status

### Media & Object Storage
- `POST /api/v1/media/upload` — Authorize and store media file (avatar, cover, project, resume, video)
- `GET /api/v1/media` — List uploaded media
- `DELETE /api/v1/media/:id` — Delete media record and underlying storage object
- `GET /api/v1/media/file/:type/:userId/:filename` — Serve public media file

### Templates Platform
- `GET /api/v1/templates` — List public community templates
- `GET /api/v1/templates/my` — List user's templates
- `POST /api/v1/templates` — Create template
- `POST /api/v1/templates/from-profile` — Create template from active profile appearance
- `POST /api/v1/templates/:id/apply` — Clone template configuration into user's profile
- `PATCH /api/v1/templates/:id` — Edit template
- `DELETE /api/v1/templates/:id` — Delete template

### Integrations
- `GET /api/v1/integrations` — List connected integrations for current user
- `GET /api/v1/integrations/public/:username` — Safe public badges/connection status
- `GET /api/v1/integrations/:provider/auth-url` — Generate provider OAuth authorization URL
- `POST /api/v1/integrations/:provider/callback` — Exchange OAuth code for tokens & sync data
- `POST /api/v1/integrations/:id/sync` — Trigger immediate provider synchronization
- `DELETE /api/v1/integrations/:id` — Disconnect provider and purge credentials

### Analytics
- `POST /api/v1/analytics/track` — Record view or click event (with SHA-256 fingerprint deduplication)
- `GET /api/v1/analytics?range=7d|30d|90d` — Aggregate metrics (views, clicks, referrers, devices)

---

## 3. Security & Architecture Audit

1. **Strict Process & Boundary Separation:** Next.js and NestJS remain completely isolated. The frontend never accesses MongoDB directly, and all third-party integrations run exclusively on the NestJS backend.
2. **Encrypted Credentials at Rest:** All sensitive tokens (OAuth access tokens, refresh tokens, WakaTime API keys) are stored encrypted using AES-256-GCM with PBKDF2 key derivation.
3. **Information Disclosure Prevention:** Public profile queries map through explicit DTOs (`toPublicDto`) to strip all MongoDB `_id` values, internal `userId` references, timestamps, and credentials.
4. **Session-Based Authentication:** Employs secure HTTP-only cookies (`stackly.sid`) backed by `express-session` and `connect-mongo`. No unneeded JWT complexity.
5. **Rate Limiting:** Guarded by `@nestjs/throttler` with a default 100 req/min bucket and stricter 10 req/min limits on authentication endpoints.
6. **OpenAPI / Swagger:** Interactive API documentation hosted at `/api/docs`.
