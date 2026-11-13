# Stackly — System Architecture & Codebase Guide

This document provides a comprehensive technical guide to the **Stackly** platform architecture. It is designed to help engineers, technical leads, and mentors understand the system's design, module boundaries, data flows, database schemas, security guarantees, and exact file locations.

---

## 1. Executive Summary & Product Overview

**Stackly** is a high-performance, developer-first portfolio and link-in-bio platform. Unlike traditional link-in-bio tools, Stackly is built specifically for software engineers, tech creators, and open-source contributors:
- **Custom Identity & Slugs:** Every developer claims a unique username handle (`stackly.dev/@username`), rendering a customized public portfolio page.
- **Theme & Appearance Engine:** Deep personalization across color themes (presets + custom hex for accent, secondary, text, and background), background surfaces (Solid, Gradient, Aurora glow), surface glassmorphism (opacity, border width, border color, corner radius), typography scales (Heading, Subheading, Body, Small text sliders), button shapes (Rounded, Pill, Sharp) and canvas layouts (Centered single-column vs. Spacious two-column tech canvas).
- **First-Class Developer Integrations:** Live, synced data feeds from **GitHub** (public repositories, stars, language distribution, commit activity), **Spotify** (currently playing track, top artists), **WakaTime** (coding time and language breakdown), and **Discord** (real-time presence and status).
- **Media Asset Pipeline:** Cloudflare R2 (S3-compatible object storage) presigned URL direct uploads for avatars and project banners with server-side validation.
- **Analytics & Changelog:** First-party, privacy-preserving profile view tracking and link click telemetry with complete audit history for profile mutations.

---

## 2. High-Level System Architecture

Stackly is structured as a decoupled full-stack TypeScript application composed of a **Next.js 16** frontend client and a **NestJS 12** backend API service backed by **MongoDB**:

```mermaid
flowchart TD
    subgraph Client ["Frontend — Next.js 16 (Port 3000)"]
        UI["React 19 Components / App Router"]
        Shell["App Shell & Navigation"]
        Editor["Appearance & Profile Editors"]
        Preview["Interactive Live Preview Engine"]
        PublicPage["Server-Rendered /[username] Portfolio"]
    end

    subgraph API ["Backend API — NestJS 12 (Port 3001)"]
        Gateway["Express Gateway / CORS / Helmet / Session"]
        AuthMod["AuthModule (Session + CSRF + OAuth PKCE)"]
        ProfileMod["ProfileModule (Handle & Appearance Engine)"]
        LinksMod["LinksModule (CRUD + Reordering + Clicks)"]
        ProjectsMod["ProjectsModule (Portfolio Showcase)"]
        IntegMod["IntegrationsModule (GitHub, Spotify, WakaTime)"]
        MediaMod["MediaModule (Cloudflare R2 Presigned URLs)"]
        AnalyticsMod["AnalyticsModule (Views & Click Telemetry)"]
    end

    subgraph Storage ["Databases & External Infrastructure"]
        Mongo[("MongoDB (Port 27017)<br/>Sessions, Users, Profiles, Appearances")]
        R2[("Cloudflare R2 Storage<br/>Avatars & Uploaded Assets")]
        GitHubAPI["GitHub REST API v3"]
        GoogleOIDC["Google OAuth2 / OIDC"]
    end

    UI -->|HTTP / REST (Cookies + Credentials)| Gateway
    Gateway --> AuthMod
    Gateway --> ProfileMod
    Gateway --> LinksMod
    Gateway --> ProjectsMod
    Gateway --> IntegMod
    Gateway --> MediaMod
    Gateway --> AnalyticsMod

    AuthMod <-->|OAuth Code / Token Exchange| GitHubAPI
    AuthMod <-->|OIDC Token Exchange| GoogleOIDC
    IntegMod <-->|Fetch Repos, Stars, Activity| GitHubAPI
    MediaMod <-->|S3 Presigned PutObject| R2

    AuthMod --> Mongo
    ProfileMod --> Mongo
    LinksMod --> Mongo
    ProjectsMod --> Mongo
    IntegMod --> Mongo
    AnalyticsMod --> Mongo
```

---

## 3. Backend Architecture (NestJS 12)

The backend is built with **NestJS 12**, **Node.js**, and **TypeScript**, utilizing **Mongoose** for MongoDB object data modeling. It follows strict modular architecture, separation of concerns, and dependency injection.

### Directory Structure & Module Layout

```
backend/
├── src/
│   ├── main.ts                       # Application bootstrap, CORS, session, Helmet, validation pipes
│   ├── app.module.ts                 # Root NestJS module importing feature modules and ConfigModule
│   ├── common/                       # Shared decorators, guards, filters, crypto, HTTP fetch utilities
│   │   ├── crypto/crypto.util.ts     # AES-256-GCM token encryption & SHA-256 state hashing
│   │   ├── guards/                   # AuthenticatedGuard, SessionGuard
│   │   ├── http/resilient-fetch.ts   # Fetch client with exponential backoff & retry
│   │   └── oauth/oauth-state.service.ts # PKCE state, code challenge, CSRF token validation
│   └── modules/
│       ├── auth/                     # Authentication & OAuth 2.0 implementation
│       │   ├── auth.controller.ts    # /api/v1/auth (login, register, logout, me, session check)
│       │   ├── auth.service.ts       # Password verification (bcrypt), user registration
│       │   ├── session/              # express-session backed by MongoDB session store
│       │   └── oauth/                # OAuth 2.0 PKCE flow (GitHub & Google)
│       │       ├── oauth.controller.ts # /api/v1/auth/oauth/:provider & callback handlers
│       │       ├── oauth.service.ts    # Account linking, user provisioning, state verification
│       │       └── providers/          # GitHubOAuthProvider, GoogleOAuthProvider
│       ├── users/                    # User account schema, credentials, identities
│       │   ├── schemas/user.schema.ts
│       │   └── users.service.ts
│       ├── profile/                  # Core Profile & Appearance Engine
│       │   ├── profile.controller.ts # /api/v1/profile, /api/v1/profile/appearance, /api/v1/u/:username
│       │   ├── profile.service.ts    # Slug reservation, appearance merging, view tracking
│       │   ├── schemas/
│       │   │   ├── profile.schema.ts
│       │   │   └── appearance.schema.ts # Strongly-typed appearance configuration schema
│       │   └── dto/profile.dto.ts    # Validation DTOs for appearance, links, social
│       ├── links/                    # Linkcard CRUD, drag-and-drop reordering, click tracking
│       │   ├── links.controller.ts   # /api/v1/links
│       │   ├── links.service.ts
│       │   └── schemas/link.schema.ts
│       ├── projects/                 # Portfolio showcase projects
│       │   ├── projects.controller.ts # /api/v1/projects
│       │   ├── projects.service.ts
│       │   └── schemas/project.schema.ts
│       ├── integrations/             # Third-party integrations (GitHub, Discord, Spotify, WakaTime)
│       │   ├── integrations.controller.ts # /api/v1/integrations
│       │   ├── integrations.service.ts    # Periodic sync, token refresh, encrypted token storage
│       │   ├── schemas/integration.schema.ts
│       │   └── providers/github.provider.ts # Fetches user repos, language stats, and star counts
│       ├── media/                    # Cloudflare R2 presigned URL generator & asset validation
│       │   ├── media.controller.ts   # /api/v1/media/upload-url
│       │   └── media.service.ts      # AWS S3 SDK integration for R2 bucket
│       ├── analytics/                # Telemetry & aggregation
│       │   ├── analytics.controller.ts # /api/v1/analytics
│       │   └── analytics.service.ts
│       └── changelog/                # Audit trail for account modifications
│           └── changelog.service.ts
```

### Key Backend Technical Patterns

1. **Stateful Session Authentication:**
   - Sessions are stored in MongoDB using `connect-mongo`. Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
   - User identity resolution occurs on every authenticated request via `@UseGuards(AuthenticatedGuard)` and custom parameter decorator `@CurrentUser()`.
2. **Robust OAuth 2.0 Authorization Code Flow with PKCE:**
   - File: `src/modules/auth/oauth/`
   - Generates cryptographically secure `state`, `code_challenge`, and `code_verifier` (SHA-256).
   - Prevents CSRF and authorization code interception attacks.
   - Seamlessly links GitHub or Google identities to existing accounts by verified email, or creates a new account.
   - Automatically synchronizes GitHub public repositories and stats on GitHub OAuth sign-in.
3. **Structured & Validated Appearance Schema:**
   - File: `src/modules/profile/schemas/appearance.schema.ts`
   - Uses Mongoose embedded schemas and Class-Validator DTOs.
   - Validates hex colors (`^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$`), numeric ranges (opacity 0-100%, border width 0-4px, radius 0-48px), typography scales (16-72px headings, 10-32px body), and layout options (`centered`, `compact`).
4. **Token Encryption at Rest:**
   - OAuth tokens for third-party integrations (GitHub, Spotify, Discord) are encrypted before writing to MongoDB using **AES-256-GCM** via `TokenEncryption` in `src/common/crypto/crypto.util.ts`.
5. **Direct-to-Cloudflare R2 Media Uploads:**
   - File: `src/modules/media/media.service.ts`
   - Generates presigned `PutObjectCommand` URLs directly to Cloudflare R2 bucket. The client uploads the file directly to R2, avoiding server bandwidth bottlenecks while maintaining strict MIME type and file size limits.

---

## 4. Frontend Architecture (Next.js 16)

The frontend is built with **Next.js 16 (App Router)**, **React 19**, and **Tailwind CSS**, designed with an elevated, dark luxury developer aesthetic (deep midnight `#0F0B16`, Electric Lavender `#B88CFF`, crisp typography, and fluid micro-interactions).

### Directory Structure & Route Hierarchy

```
frontend/
├── src/
│   ├── app/                          # Next.js App Router pages and route handlers
│   │   ├── layout.tsx                # Root layout with AuthProvider and ProfileProvider
│   │   ├── page.tsx                  # Public marketing & landing page
│   │   ├── login/page.tsx            # Login page (Password + GitHub OAuth + Google OAuth)
│   │   ├── register/page.tsx         # Account registration page
│   │   ├── claim-username/page.tsx   # Immediate onboarding username reservation page
│   │   ├── [username]/page.tsx       # Dynamic server-rendered public developer portfolio
│   │   └── dashboard/                # Authenticated developer control center
│   │       ├── page.tsx              # Dashboard overview (metrics, quick links, status)
│   │       ├── appearance/page.tsx   # Live Theme & Appearance Customizer
│   │       ├── profile/page.tsx      # Bio, avatar upload, and social profile links
│   │       ├── links/page.tsx        # Link cards editor (drag-and-drop, toggle, edit)
│   │       ├── projects/page.tsx     # Portfolio project showcase manager
│   │       ├── integrations/page.tsx # Manage GitHub, Discord, Spotify, WakaTime
│   │       ├── analytics/page.tsx    # Traffic analytics, views, and click-through rates
│   │       └── settings/page.tsx     # Account security, password update, OAuth links
│   ├── components/stackly/           # Reusable UI component library
│   │   ├── app-shell.tsx             # Responsive dashboard layout with sidebar and user menu
│   │   ├── profile-preview.tsx       # The live, reactive portfolio card preview engine
│   │   ├── profile-link-card.tsx     # Dynamic link card (preview & management modes)
│   │   ├── project-card.tsx          # Dynamic project card (preview & management modes)
│   │   ├── profile-avatar.tsx        # Avatar with fallback initials and live pulse badge
│   │   ├── theme-picker.tsx          # Preset theme selector (Signal, Ocean, Ember, etc.)
│   │   ├── color-input.tsx           # Hex color picker with preset resets
│   │   ├── slider.tsx                # Calibrated range sliders with pixel / percent indicators
│   │   └── save-status.tsx           # Auto-save indicator (Saving..., Saved, Error)
│   ├── context/                      # React context providers
│   │   ├── auth-context.tsx          # Manages current user session, login, logout
│   │   └── profile-context.tsx       # Caches active user profile and triggers preview refreshes
│   └── lib/                          # Core frontend libraries & helpers
│       ├── api.ts                    # Strongly-typed HTTP client for Stackly backend API
│       ├── appearance.ts             # Appearance normalization, color resolvers, style helpers
│       └── utils.ts                  # cn (clsx + tailwind-merge)
```

### Key Frontend Technical Patterns

1. **Reactive Appearance & Live Preview Engine:**
   - File: `src/lib/appearance.ts` & `src/components/stackly/profile-preview.tsx`
   - Resolvers dynamically compute CSS values:
     - `resolveAccent`: Computes primary hex, soft tint, and ambient glow rgba.
     - `resolveButton`: Computes corner radius in pixels (0 for Sharp, 999 for Pill, slider value for custom), padding, and height.
     - `resolveSurface`: Computes surface background fill, glassmorphism opacity, border width, and border color.
     - `resolveTypography`: Computes multiplier-adjusted font sizes in pixels for heading, subheading, body, and small text.
     - `resolveCanvas`: Computes content max width, spacing, padding, and alignment.
2. **Debounced Atomic Auto-Saving:**
   - File: `src/app/dashboard/appearance/page.tsx`
   - Sliders and color inputs apply changes locally instantly for zero-latency preview feedback.
   - Changes are queued and batched via `combinePatches` and debounced with a 400ms flush window. If the user navigates away, an unmount hook guarantees any pending patch is flushed immediately.
3. **Dedicated Onboarding Username Claiming Flow:**
   - File: `src/app/claim-username/page.tsx`
   - Both password registration and GitHub/Google OAuth automatically direct unclaimed or placeholder accounts (`user_xxxxxx`) to `/claim-username`.
   - Live validation checks availability against `/api/v1/profile/username/available?u=...` and reserves the handle before transitioning to `/dashboard`.
4. **Server-Side Rendered Public Portfolios with Dynamic Styles:**
   - File: `src/app/[username]/page.tsx`
   - Pre-renders profile, links, projects, and integrations using Next.js Server Components.
   - Reads appearance settings directly from backend and renders inline CSS matching the user's custom typography, button geometry, surface opacity, and text colors.

---

## 5. Core Features & File Map

| Feature | Frontend File(s) | Backend File(s) | Description |
| :--- | :--- | :--- | :--- |
| **Authentication (Password)** | `src/app/login/login-form.tsx`<br/>`src/app/register/register-form.tsx` | `src/modules/auth/auth.controller.ts`<br/>`src/modules/auth/auth.service.ts` | Bcrypt password hashing, session cookies, input validation. |
| **GitHub OAuth 2.0** | `src/app/login/login-form.tsx`<br/>`src/components/stackly/icons.tsx` | `src/modules/auth/oauth/oauth.controller.ts`<br/>`src/modules/auth/oauth/providers/github.provider.ts` | Authorization code flow with PKCE, auto-syncs repos upon login. |
| **Username Claiming** | `src/app/claim-username/page.tsx` | `src/modules/profile/profile.controller.ts`<br/>`src/modules/profile/profile.service.ts` | Handle reservation, slug collision detection, reserved word checks. |
| **Theme & Appearance** | `src/app/dashboard/appearance/page.tsx`<br/>`src/lib/appearance.ts`<br/>`src/components/stackly/profile-preview.tsx` | `src/modules/profile/schemas/appearance.schema.ts`<br/>`src/modules/profile/profile.service.ts` | Theme presets, custom accent/text/background, typography & geometry sliders. |
| **Links Management** | `src/app/dashboard/links/page.tsx`<br/>`src/components/stackly/profile-link-card.tsx` | `src/modules/links/links.controller.ts`<br/>`src/modules/links/links.service.ts` | Link card CRUD, drag-and-drop order updates, click telemetry. |
| **Projects Showcase** | `src/app/dashboard/projects/page.tsx`<br/>`src/components/stackly/project-card.tsx` | `src/modules/projects/projects.controller.ts`<br/>`src/modules/projects/projects.service.ts` | Showcase repository/live URLs, tech stack tags, status dots (Live/Beta/WIP). |
| **GitHub Integration** | `src/app/dashboard/integrations/page.tsx`<br/>`src/app/[username]/page.tsx` | `src/modules/integrations/integrations.service.ts`<br/>`src/modules/integrations/providers/github.provider.ts` | Pulls public repos, total stars, top languages, and renders cards on profile. |
| **Avatar / R2 Uploads** | `src/app/dashboard/profile/page.tsx`<br/>`src/components/stackly/profile-avatar.tsx` | `src/modules/media/media.controller.ts`<br/>`src/modules/media/media.service.ts` | S3 presigned URL generation, file sanitization, Cloudflare R2 bucket. |
| **Public Portfolio** | `src/app/[username]/page.tsx` | `src/modules/profile/profile.controller.ts` (`/u/:username`) | Dynamic public route matching developer handle with custom styles and SEO metadata. |
| **Analytics & Views** | `src/app/dashboard/analytics/page.tsx` | `src/modules/analytics/analytics.controller.ts`<br/>`src/modules/analytics/analytics.service.ts` | Daily/weekly view charts, unique visitors, top performing links. |

---

## 6. Verification & Development Commands

### Backend Commands (Port 3001)
```powershell
cd backend

# Run TypeScript compilation
pnpm run build

# Run Unit and Integration Tests
pnpm test

# Start in Development Mode with Hot Reload
pnpm run dev
```

### Frontend Commands (Port 3000)
```powershell
cd frontend

# Run Typecheck
pnpm typecheck

# Run Linter
pnpm lint

# Run Production Build
pnpm build

# Start in Development Mode (Turbopack)
pnpm dev
```

---

## 7. Key Architecture Explanations for Mentors

1. **How is data persistence handled?**
   - All account, profile, appearance, link, project, and integration state is persisted in MongoDB. Schema changes are strictly typed using Mongoose `@Schema()` decorators, ensuring that partial appearance updates merge correctly without overwriting untouched properties.
2. **How does the Theme & Appearance system work under the hood?**
   - The theme configuration is stored as a validated nested JSON document on the `Profile` record in MongoDB.
   - When modified in `/dashboard/appearance`, changes trigger instant local state updates in the live preview while a debounced API request saves the configuration to the backend.
   - When a visitor navigates to `/[username]`, Next.js SSR fetches the appearance document from the backend and resolves typography, button geometry, surface styling, and accent colors into CSS rules, ensuring exact visual parity between the editor and the public page.
3. **How does GitHub OAuth protect user credentials?**
   - Stackly strictly follows the OAuth 2.0 PKCE flow. The GitHub Client Secret is stored exclusively on the backend in environment variables and never exposed to the client. The backend signs state tokens with server secrets to prevent CSRF attacks, exchanges authorization codes securely over TLS, and encrypts OAuth access tokens using AES-256-GCM before saving them to the database.
