# Stackly REST API Reference

- **Base URL:** `http://localhost:3001/api/v1`
- **Interactive OpenAPI Documentation:** `http://localhost:3001/api/docs` (Swagger UI)
- **Session Cookie:** `stackly.sid` (HTTP-only, Secure in production)

---

## Authentication (`/api/v1/auth`)

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Register a new user account and start session |
| POST | `/auth/login` | No | Log in with email and password |
| POST | `/auth/logout` | No | Destroy session and clear cookie |
| GET | `/auth/me` | Yes | Get currently authenticated user |
| PATCH | `/auth/password` | Yes | Update password with current password verification |
| GET | `/auth/export` | Yes | Export complete user data archive in JSON format |
| DELETE | `/auth/account` | Yes | Cascade delete user account, profile, links, projects, etc. |

---

## Profiles (`/api/v1/profile` or `/api/v1/profiles`)

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/profile/:username` | No | Public profile lookup (filtered DTO) |
| GET | `/profiles/public/:username` | No | Public profile lookup alias |
| GET | `/profile/availability/:username` | No | Check if a username is available |
| GET | `/profile/me` | Yes | Get own profile |
| POST | `/profile/me` | Yes | Create profile |
| PATCH | `/profile/me` | Yes | Update profile bio/social links/visibility |
| PATCH | `/profile/me/appearance` | Yes | Update theme, background, accent, typography |

---

## Components Engine (`/api/v1/components`)

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/components/types` | No | Registry of supported component types and default configs |
| GET | `/components/public/:username` | No | Public active components for a user |
| GET | `/components` | Yes | List all components for authenticated user |
| POST | `/components` | Yes | Add component (validated against discriminated registry) |
| PATCH | `/components/:id` | Yes | Update component configuration or schedule |
| DELETE | `/components/:id` | Yes | Remove component |
| PUT | `/components/reorder` | Yes | Reorder components |

---

## Links (`/api/v1/links`)

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/links/public/:username` | No | Public visible links |
| POST | `/links/:id/click` | No | Record link click |
| GET | `/links` | Yes | List links for authenticated user |
| POST | `/links` | Yes | Create new link |
| PATCH | `/links/:id` | Yes | Update link |
| DELETE | `/links/:id` | Yes | Delete link |
| PUT | `/links/reorder` | Yes | Reorder links |

---

## Projects (`/api/v1/projects`)

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/projects/public/:username` | No | Public visible projects for user |
| GET | `/projects` | Yes | List user's projects |
| POST | `/projects` | Yes | Create project |
| PATCH | `/projects/:id` | Yes | Update project |
| DELETE | `/projects/:id` | Yes | Delete project |
| PUT | `/projects/reorder` | Yes | Reorder projects |
| PATCH | `/projects/:id/feature` | Yes | Toggle featured project |

---

## Templates Platform (`/api/v1/templates`)

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/templates` | No | Browse published public templates |
| GET | `/templates/:id` | No | Preview template |
| GET | `/templates/mine` | Yes | List own templates |
| POST | `/templates` | Yes | Create template |
| POST | `/templates/from-profile` | Yes | Create template snapshot from current profile |
| POST | `/templates/:id/apply` | Yes | Apply template to profile (clones config) |
| PATCH | `/templates/:id` | Yes | Edit template |
| DELETE | `/templates/:id` | Yes | Delete template |

---

## Integrations (`/api/v1/integrations`)

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/integrations/public/:username` | No | List connected integration badges |
| GET | `/integrations` | Yes | List user's integrations |
| GET | `/integrations/oauth/:providerId/url` | Yes | Get OAuth authorization URL |
| POST | `/integrations/oauth/:providerId/callback` | Yes | Exchange OAuth code for tokens |
| POST | `/integrations/wakatime` | Yes | Connect WakaTime via API key |
| POST | `/integrations/connect` | Yes | Connect manual integration (LeetCode, etc.) |
| POST | `/integrations/:integrationId/sync` | Yes | Trigger integration sync |
| DELETE | `/integrations/:integrationId` | Yes | Disconnect integration |

---

## Analytics (`/api/v1/analytics`)

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| POST | `/analytics/track` | No | Track privacy-conscious view/click event |
| GET | `/analytics?range=30d` | Yes | Get analytics report (7d/30d/90d) |

---

## Media & Storage (`/api/v1/media`)

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| POST | `/media/upload` | Yes | Upload file (avatar, cover, project, resume, etc.) |
| GET | `/media` | Yes | List user's uploaded files |
| DELETE | `/media/:id` | Yes | Delete media file |
| GET | `/media/file/:type/:userId/:filename` | No | Stream stored media file |
