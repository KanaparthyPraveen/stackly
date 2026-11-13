# Stackly

Stackly is a full-stack developer portfolio platform. The repository keeps the
Next.js client and NestJS API in separate top-level folders.

## Repository layout

- `frontend/` - Next.js 16 and React 19 web application.
- `backend/` - NestJS 12 REST API and MongoDB integration.
- `docs/` — API and integration setup guides.
- `ARCHITECTURE.md` — system overview and component boundaries.

## Requirements

- Node.js (see each application's `.nvmrc`)
- pnpm
- MongoDB and the external credentials required by the backend (see
  `backend/.env.example`)

## Run locally

Install dependencies and start each application in a separate terminal:

```powershell
cd frontend
pnpm install
pnpm dev
```

```powershell
cd backend
pnpm install
pnpm dev
```

The frontend runs on `http://localhost:3000`; the API runs on
`http://localhost:3001`. Configure the backend using `backend/.env.example`.
Never commit local `.env` files or credentials.

## Validation

Run the checks from the corresponding application folder:

```powershell
pnpm test
pnpm build
```
