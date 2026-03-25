# CareerFlow AI

**Document-centric AI workflow** for job applications: align your resume and portfolio with a target posting, close evidence gaps through guided Q&A, then move into **cover letter & career narrative drafts** and **interview prep**—without treating everything as a one-shot generation.

The product is built around **traceable steps** and the ability to **resume** a workflow, not a single prompt dump.

---

## Overview

CareerFlow AI는 지원 서류와 채용공고를 한 흐름에서 다루고, 공고 대비 강·약점 정리 → 근거 보완 → 문서 초안 → 면접 준비까지 이어 주는 MVP입니다. (한국어 UI·카피 기준 제품입니다.)

---

## How it works

1. **Sign in** — A lightweight **demo session** gets you started quickly. Use the header profile to see the active session and recent accounts.  
2. On the **flow composer**, paste resume, portfolio, an optional highlighted project, and the job posting; optionally name the workflow.  
3. Run **analysis** to produce a structured view of fit, gaps, and **follow-up questions** grounded in your inputs.  
4. On the **results** view, read the posting-aligned strengths and gaps; answering questions refreshes the profile and summary.  
5. **Generate drafts** — a **cover letter / self-intro** draft and a **career narrative** draft.  
6. **Interview prep** — core and deep-dive questions with talking points.  
7. Open **My CareerFlow** to return to in-progress or completed workflows.

---

## Key differentiators

| | |
|--|--|
| **Stage orchestration** | Extraction, gap analysis, follow-up, documents, and interview steps run as separate pipeline stages—not one monolithic prompt. |
| **Explainable summaries** | Posting-aligned strengths, gaps, and follow-ups are stored as narrative structure—not collapsed into a single score. |
| **Operational guardrails** | Rate limits, execution locks, and optional skip rules for regeneration reduce duplicate cost and contention. |
| **Failure handling** | Document generation does not surface internal placeholder text to users; valid prior drafts are preserved when generation fails. |
| **Re-run analysis** | Each analysis request runs the full pipeline; viewing stored results is a separate read path. |

---

## Tech stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS  
- **Backend**: NestJS, TypeScript  
- **Database**: PostgreSQL, Prisma  
- **AI**: LangChain, Gemini Developer API (default) or OpenAI (optional)

---

## Local development

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Set DATABASE_URL, LLM keys, etc.
npx prisma generate
npx prisma migrate dev
npm run start:dev
# Default port 4000, API prefix /v1
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/v1
npm run dev
# Default port 3000
```

---

## Environment variables

| Area | Variable | Purpose |
|------|----------|---------|
| LLM | `LLM_PROVIDER` | `gemini` (default) or `openai` |
| LLM | `GEMINI_API_KEY` / `OPENAI_API_KEY` | Required for generation |
| LLM | `GEMINI_DEFAULT_MODEL` | Light tasks (extraction, gaps, follow-ups, rewrite assist) |
| LLM | `GEMINI_HIGH_QUALITY_MODEL` | Quality tier (documents, interview report) |
| LLM | `GEMINI_PREMIUM_MODEL` | Optional premium tier for the posting-fit analysis pass |
| Backend | `DATABASE_URL` | PostgreSQL connection string |
| Backend | `CORS_ORIGIN` | Frontend origins (comma-separated). **If empty in production, browser CORS is effectively off.** |
| Backend | `PORT` | Default `4000` |
| Frontend | `NEXT_PUBLIC_API_BASE_URL` | e.g. `http://localhost:4000/v1` — **required for production builds** |

See `backend/.env.example` and `frontend/.env.local.example` for details.

---

## Deployment

### Frontend (Vercel)

- **Root directory**: `frontend`  
- **HTTPS frontend → HTTP API on EC2**: avoid mixed content by setting `BACKEND_URL=http://<EC2_PUBLIC_IP>:4000` and `NEXT_PUBLIC_API_BASE_URL=/v1`, with `frontend/next.config.ts` rewrites proxying `/v1/*` to the backend.

### Backend (EC2)

- On the server: `git pull`, then build **on Linux** inside `backend` (avoid copying Windows-built `dist` only).  
- PM2: `backend/ecosystem.config.cjs`  
- Script: `backend/deploy-ec2.sh` (`npm ci` → `prisma generate` → `migrate deploy` → `npm run build` → PM2)

### Pre-flight checklist

1. Backend: `DATABASE_URL`, `CORS_ORIGIN` (include Vercel origin), LLM keys, `NODE_ENV=production`  
2. Frontend: `NEXT_PUBLIC_API_BASE_URL` — direct URL locally, `/v1` when using the Vercel proxy  
3. AWS: security group / reverse proxy for API port `4000` (or terminate TLS upstream)

---

## Integration notes

- Demo sessions send the active account via the **`x-test-user-id`** header; list endpoints require the path user and header to match.  
- Workflow titles and similar metadata: `PATCH /v1/source-documents/:id/meta`  
- Stage-level traces live in `WorkflowRun`; see [docs/architecture.md](docs/architecture.md).

---

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/project-overview.md](docs/project-overview.md) | Problem scope, MVP boundaries, output principles |
| [docs/architecture.md](docs/architecture.md) | Modules, pipeline stages, routing, persistence |
| [docs/api-spec.md](docs/api-spec.md) | REST contracts |
| [docs/db-schema.md](docs/db-schema.md) | Prisma model summary |
| [docs/langchain-in-this-project.md](docs/langchain-in-this-project.md) | LangChain role and non-goals (RAG / agents) |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Quick reference and incident notes |

---

## Repository hygiene

- Do not commit: `.env`, `.env.local`, real keys, DB credentials, `*.pem`  
- Do not commit: `node_modules/`, `dist/`, `.next/`, logs, large zip artifacts  

---

## REST API

Full reference: [docs/api-spec.md](docs/api-spec.md). Examples: `POST /v1/analysis/run`, `POST /v1/generated-documents/generate`, `POST /v1/interview/generate`.
