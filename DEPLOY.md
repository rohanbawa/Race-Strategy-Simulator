# Deploying the Race Strategy Simulator

This app has three parts, and they can't all live on the same host:

| Part | Stack | Where it goes | Why |
|---|---|---|---|
| `frontend/` | Vite + React SPA | **Vercel** | Static build; Vercel is ideal. |
| `backend/` | Java 17 / Spring Boot | **Render** (or Railway/Fly/Cloud Run) | Long-running JVM server — Vercel has no Java runtime. |
| `ml-service/` | Python / FastAPI + scikit-learn | **Render** (or Railway/Fly/Cloud Run) | Stateful, trains a model — a poor fit for serverless. |

The frontend talks to the two backends through same-path proxies: `/api/*` → Java backend,
`/ml/*` → ML service. In production, **Vercel rewrites** (in `frontend/vercel.json`) forward
those paths to the hosted backends, so the browser only ever talks to your Vercel domain
(no CORS to fight).

```
 Browser ──▶ your-app.vercel.app ──/api/*──▶ racesim-backend (Render)
                                 └─/ml/*───▶ racesim-ml      (Render)
```

---

## Step 1 — Push these files to GitHub

The deploy configs (`render.yaml`, the two `Dockerfile`s, `frontend/vercel.json`) must be in
the repo both Render and Vercel read. Commit and push to the branch they'll build (usually
`main`).

## Step 2 — Deploy the backends on Render (Blueprint)

1. Sign in at <https://render.com> → **New** → **Blueprint**.
2. Connect and pick this repo. Render reads [`render.yaml`](./render.yaml) and creates two
   services: **racesim-backend** (Docker, from `backend/`) and **racesim-ml** (Docker, from
   `ml-service/`). Click **Apply**.
3. Wait for both to go **Live** (first build is slow: the ML image trains the model, the Java
   image runs a full Maven build). Copy each service's URL, e.g.:
   - `https://racesim-backend-xxxx.onrender.com`
   - `https://racesim-ml-xxxx.onrender.com`

> **Free-tier note:** free services spin down after ~15 min idle, so the first request after a
> lull cold-starts (~30–60s for the JVM). Upgrade the plan, or accept the delay for a demo.

> **Database note:** the backend uses a file-based H2 DB on the container's ephemeral disk, so
> ingested race data resets on redeploy. That's fine — the app re-ingests any race on demand.
> To persist it, add a Render Disk mounted at `/app/data`.

## Step 3 — Point the frontend at the backend URLs

Edit [`frontend/vercel.json`](./frontend/vercel.json) and replace the two placeholders with the
URLs from Step 2 (keep the paths exactly as shown):

```jsonc
{ "source": "/api/:path*", "destination": "https://racesim-backend-xxxx.onrender.com/api/:path*" },
{ "source": "/ml/:path*",  "destination": "https://racesim-ml-xxxx.onrender.com/:path*" },
```

Note `/ml` **drops** its prefix (the FastAPI service serves at the root), while `/api` **keeps**
it. Commit and push.

## Step 4 — Deploy the frontend on Vercel

1. Sign in at <https://vercel.com> → **Add New… → Project** → import this repo.
2. Set **Root Directory** to `frontend`. Framework preset auto-detects as **Vite**
   (Build `npm run build`, Output `dist`).
3. **Deploy.** You'll get `https://<project>.vercel.app`.

`render.yaml` already allows any `*.vercel.app` origin, so no extra CORS setup is needed. If you
add a **custom domain**, append it to the backend's `RACESIM_CORS_ALLOWED_ORIGINS` and the ML
service's `CORS_ORIGINS` env vars in Render.

## Step 5 — Verify

- Open the Vercel URL. The **Predict Race Winner** tab should populate (hits `/ml`).
- In **Strategy Sim**, pick a season and ingest a race (hits `/api`). First hit may cold-start
  the backend.

---

## Local build test (optional)

Both Dockerfiles build and run locally if you have Docker:

```bash
docker build -t racesim-ml ./ml-service      && docker run -p 8000:8000 racesim-ml
docker build -t racesim-backend ./backend    && docker run -p 8080:8080 racesim-backend
```

## Using Railway / Fly.io / Cloud Run instead

The Dockerfiles are host-agnostic. Point your platform at `backend/Dockerfile` and
`ml-service/Dockerfile`; each reads `$PORT` from the environment. Then set the two Vercel
rewrite destinations to whatever URLs that platform assigns.
