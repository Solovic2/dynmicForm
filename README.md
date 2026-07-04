# dynmicForm

A monorepo with two independent applications:

| App | Stack | Dev port | Prod port |
|-----|-------|----------|-----------|
| `frontend/` | React + Vite + TypeScript | 5173 | 8080 (nginx) |
| `backend/` | Fastify + Node + TypeScript | 3000 | 3000 |

```
.
├─ frontend/   # React SPA (Vite), nginx-served in production
├─ backend/    # Fastify REST API
├─ docker-compose.yml       # production-style stack
└─ docker-compose.dev.yml   # dev overrides (hot reload + volume mounts)
```

## Prerequisites
- Node.js 22+ and npm (for running apps directly)
- Docker + Docker Compose (for containerized runs)

## Run locally (without Docker)

**Backend:**
```bash
cd backend
cp .env.example .env
npm install
npm run dev            # http://localhost:3000  (GET /health)
```

**Frontend** (in a second terminal):
```bash
cd frontend
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

The frontend proxies `/api/*` to the backend, so `GET /api/health` in the
browser hits the Fastify `/health` route.

## Run with Docker

**Development** (hot reload, source volume-mounted):
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
# frontend: http://localhost:5173   backend: http://localhost:3000
```

**Production-style** (optimized builds, nginx serving the SPA):
```bash
docker compose up --build
# frontend: http://localhost:8080   backend: http://localhost:3000
```

In production, nginx serves the built frontend and proxies `/api/` to the
`backend` service over the compose network.

## Useful scripts

Backend (`backend/`):
- `npm run dev` — watch mode via `tsx`
- `npm run build` — compile TypeScript to `dist/`
- `npm start` — run compiled output
- `npm run typecheck` — type-check only

Frontend (`frontend/`):
- `npm run dev` — Vite dev server with HMR
- `npm run build` — type-check + production build to `dist/`
- `npm run preview` — preview the production build
