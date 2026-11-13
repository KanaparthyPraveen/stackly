# Stackly Integrations Setup Guide

This guide details the OAuth and API credentials needed for external integrations in Stackly.

---

## 1. GitHub Integration

### Capabilities
- Link GitHub developer account via OAuth2
- Fetch identity, avatar, public repositories, stars, and language stats
- Public developer profile preview via `GET /api/v1/github-test/profile/:username`

### Setup Instructions
1. Navigate to **GitHub Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**.
2. Fill in:
   - **Application name:** Stackly
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:3001/api/v1/integrations/oauth/github/callback`
3. Generate a Client Secret.
4. Set in `.env`:
   ```env
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   ```

---

## 2. Discord Integration

### Capabilities
- Connect authorized Discord identity (`@username` or `@username#1234`)
- Fetch avatar and display name

### Setup Instructions
1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Create **New Application**.
3. Under **OAuth2** → **Redirects**, add:
   ```
   http://localhost:3001/api/v1/integrations/oauth/discord/callback
   ```
4. Set scopes: `identify`, `email`.
5. Set in `.env`:
   ```env
   DISCORD_CLIENT_ID=your_discord_client_id
   DISCORD_CLIENT_SECRET=your_discord_client_secret
   ```

---

## 3. Spotify Integration

### Capabilities
- Connect Spotify account
- Display currently playing track and top 5 tracks

### Setup Instructions
1. Open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Create an App.
3. In App Settings, add Redirect URI:
   ```
   http://localhost:3001/api/v1/integrations/oauth/spotify/callback
   ```
4. Set in `.env`:
   ```env
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   ```

---

## 4. WakaTime Integration

### Capabilities
- Display total coding time, daily average, top languages, and editor breakdown over the last 7 days

### Setup Instructions
1. Users provide their own personal WakaTime API key from [WakaTime Settings](https://wakatime.com/settings/api-key).
2. The key is encrypted at rest on the Stackly server using AES-256-GCM and never returned to the frontend.
3. Configure optional base URL in `.env`:
   ```env
   WAKATIME_API_BASE_URL=https://wakatime.com/api/v1
   ```

---

## 5. Other Developer Profiles (LeetCode, CodeChef, HackerRank)

- **API Status:** None of these platforms offer official public OAuth2 user authentication.
- **Implementation:** Stackly supports verified manual profile linking and handle extraction, distinguishing verified handles from OAuth live feeds.
