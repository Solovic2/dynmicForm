# Backend — Dynamic Forms API

A **Fastify 5 + TypeScript (ESM)** REST API with **Prisma + PostgreSQL** and **S3-compatible file storage** (MinIO locally). It powers a dynamic form builder: JWT auth, form/question CRUD, public form submissions with file uploads, and submission viewing.

## Stack

| Concern | Choice |
|---|---|
| Framework | Fastify 5 (ESM) |
| Language | TypeScript |
| ORM / DB | Prisma / PostgreSQL |
| Auth | JWT (access + rotating refresh) via `jsonwebtoken`, `bcryptjs` |
| Validation | zod |
| File storage | S3-compatible (`@aws-sdk/client-s3`) — MinIO in dev, Supabase/R2/S3 in prod |
| Uploads | `@fastify/multipart` |

## Project structure

```
src/
├─ config/env.ts          # zod-validated environment (fails fast on boot)
├─ db/prisma.ts           # PrismaClient singleton
├─ lib/
│  ├─ tokens.ts           # JWT sign/verify + refresh-token hashing
│  ├─ password.ts         # bcrypt hash/verify
│  ├─ storage.ts          # S3 wrapper (put / presign / ensureBucket)
│  ├─ errors.ts           # HttpError (status + message)
│  └─ http.ts             # zod body parsing + error → reply translation
├─ schemas/               # zod request schemas (auth, form)
├─ services/              # business logic (auth, form, submission)
├─ plugins/auth.ts        # `app.authenticate` decorator (fastify-plugin)
├─ routes/
│  ├─ health.ts           # GET /health
│  ├─ auth.ts             # public auth + protected /auth/me
│  ├─ forms.ts            # protected form/question/submission/file routes
│  ├─ public.ts           # unauthenticated public form fetch + submit
│  └─ protected.ts        # scoped guard: everything inside requires a token
├─ app.ts                 # buildApp() — plugins + route registration
└─ server.ts              # bootstrap (logger, ensureBucket, listen)
prisma/schema.prisma      # User, RefreshToken, Form, Question, QuestionOption,
                          # Submission, Answer, File
```

**Auth model:** short-lived **access token (1h)** on every request; **refresh token (7d)** stored *hashed* in the DB and **rotated** on use (revocable). Protected routes live inside the encapsulated scope in `routes/protected.ts`, whose `onRequest` hook runs `app.authenticate` — so protection is automatic and can't be forgotten.

## Environment variables

Copy `.env.example` → `.env` and fill in. Validated at boot by `config/env.ts`.

| Var | Required | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | | `development` | set `production` when deployed |
| `PORT` | | `3000` | on PaaS (Render) leave unset — the platform injects it |
| `HOST` | | `0.0.0.0` | needed inside Docker |
| `CORS_ORIGIN` | | reflect any | **set to the frontend URL in prod** (comma-separated allowed) |
| `DATABASE_URL` | ✅ | | Postgres connection string |
| `JWT_ACCESS_SECRET` | ✅ | | strong random (`openssl rand -hex 32`) |
| `JWT_REFRESH_SECRET` | ✅ | | strong random |
| `ACCESS_TOKEN_TTL` | | `1h` | jsonwebtoken/ms format |
| `REFRESH_TOKEN_TTL` | | `7d` | |
| `S3_ENDPOINT` | ✅ | | internal S3 endpoint the API uses |
| `S3_PUBLIC_ENDPOINT` | ✅ | | browser-reachable endpoint used to sign download URLs |
| `S3_REGION` | | `us-east-1` | |
| `S3_BUCKET` | ✅ | | must match an existing bucket |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | ✅ | | |
| `S3_FORCE_PATH_STYLE` | | `true` | required for MinIO |
| `MAX_UPLOAD_BYTES` | | `10485760` | global multipart size cap (10 MiB) |

> `S3_ENDPOINT` vs `S3_PUBLIC_ENDPOINT` differ under Docker (`http://minio:9000` internally, `http://localhost:9000` for the browser). With a hosted store (Supabase/R2) they're usually the same public URL.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | `tsx watch src/server.ts` (hot reload) |
| `npm run build` | `prisma generate && tsc` → `dist/` |
| `npm start` | `node dist/server.js` (production) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run prisma:migrate` | `prisma migrate dev` (create + apply a migration) |
| `npm run prisma:deploy` | `prisma migrate deploy` (apply pending migrations) |

## Run locally (without Docker)

```bash
cp .env.example .env          # fill JWT secrets etc.
npm install                   # also runs `prisma generate`
# needs a Postgres + an S3 store reachable per your .env
npm run prisma:migrate -- --name init
npm run dev                   # http://localhost:3000 (or your PORT)
```

## API overview

Public:
- `GET /health`
- `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout`
- `GET /public/forms/:token` · `POST /public/forms/:token/submit` (multipart)

Protected (Bearer access token):
- `GET /auth/me`
- `GET /forms` · `POST /forms` · `GET /forms/:id` · `PUT /forms/:id` (full save) · `PATCH /forms/:id` · `DELETE /forms/:id`
- `POST /forms/:id/publish` · `POST /forms/:id/unpublish`
- `GET /forms/:id/submissions` · `GET /forms/:id/submissions/:sid`
- `GET /files/:id` (owner-gated presigned URL; `?disposition=inline` to preview)

## Docker

The whole stack is orchestrated from the **repo root** `docker-compose.yml` (not this folder) — it runs **db (Postgres) + minio (S3) + backend + frontend** on one network. See the [root README](../README.md) and the Docker section below.

From the **repo root**:

```bash
# Production-style build + run
docker compose up --build
#   backend  → http://localhost:8000
#   frontend → http://localhost:3000
#   MinIO    → API http://localhost:9000, console http://localhost:9001 (minioadmin/minioadmin)
#   Postgres → db service (5432 exposed in dev)

# Development (hot reload, source volume-mounted):
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Backend specifics:
- On start the container runs `prisma migrate deploy` before booting, and `ensureBucket()` creates the S3 bucket if missing (non-fatal — the API still starts if storage is unavailable, only file ops fail).
- **`Dockerfile`** — multi-stage production image (`npm ci`, `prisma generate && tsc`, runs `dist/`). Requires `package-lock.json` (committed).
- **`Dockerfile.dev`** — dev image that runs the TS source via `tsx`.
- Backend env in compose (DB, JWT, S3) is set in the root compose files; MinIO is reachable at `http://minio:9000` inside the network.

> The base `docker-compose.yml` **bakes source into the image** (no volume mount), so backend code changes require `docker compose up -d --build backend`. Use the `docker-compose.dev.yml` override for live reload.

## Notes
- Prisma migrations live in `prisma/migrations/` and are committed.
- Secrets belong in `.env` (gitignored) or your host's env settings — never commit them.
