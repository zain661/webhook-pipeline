# Webhook Pipeline

A webhook-driven task processing pipeline inspired by Zapier, built for **Humanitarian Aid Intelligence**. Field teams from different NGOs send reports in different formats; this system normalizes, classifies, and routes them to the right coordination teams automatically.

---

## The Problem This Solves

NGOs operating in conflict zones use different field systems with different data formats. A report from UNRWA uses `area`, while the Red Crescent uses `zone`, and a local NGO uses `region`. Coordinators are overwhelmed by noise, and critical alerts get lost in routine updates. This pipeline:

- **Normalizes** inconsistent field names into a standard format
- **Classifies** reports by severity and drops low-priority noise
- **Scans** free-text descriptions for critical keywords
- **Enriches** payloads with response metadata and priority windows
- **Delivers** processed reports to the right teams automatically with retry logic
- **Prioritizes** critical reports so they are processed before routine ones

---

## Architecture

```
Webhook Source        API Server           Redis Queue         Worker (BullMQ)
─────────────        ──────────           ───────────         ───────────────
Field Report  ──►   POST /webhooks  ──►   BullMQ Queue  ──►  5 concurrent workers
(any format)        /ingest/:token        priority 1          │
                          │               (critical)          ├── Run Action
                          │               priority 10         │   (normalize/classify/
                          ▼               (routine)           │    scan/enrich)
                     jobs table                               │
                     status: pending                          ├── Deliver to subscribers
                     (source of truth)                        │   (with retry + backoff)
                                                              │
                                                              └── Update job status
```

**Key design decisions:**

1. **Database as source of truth** : The API and worker never talk directly. The database stores every job permanently. Redis is only the notification layer — if Redis restarts, no jobs are lost.

2. **Event-driven over polling**: Jobs are processed the moment they arrive in the queue (not every 3 seconds). First job latency: ~330ms vs ~1216ms with polling.

3. **Priority queue**: Critical reports (severity ≥ 8) get priority 1 and jump ahead of routine reports (priority 10). In disaster scenarios, order of processing matters.

4. **5 concurrent workers**: BullMQ processes 5 jobs simultaneously. At 100 concurrent jobs: 47 jobs/sec vs 21 jobs/sec with polling.

---

## Architectural Evolution

This project went through two architectural phases, both preserved in separate branches for comparison:

| | `feature/polling-approach` | `main` (current) |
|---|---|---|
| Worker | Polls DB every 3s | BullMQ event-driven |
| Concurrency | 1 job at a time | 5 jobs simultaneously |
| Priority | FIFO only | Critical reports first |
| First job latency | ~1216ms | ~330ms |
| Throughput (100 jobs) | 21 jobs/sec | 47 jobs/sec |
| Extra infrastructure | None | Redis |

---

## Performance Results

Measured with `npm run simulate` performance tests:

### Test 1 — First Job Latency
```
Polling:  1216ms   (waits for next poll cycle)
BullMQ:    330ms   (instant queue pickup) → 4x faster
```

### Test 2 — Burst Traffic (simultaneous jobs)
```
              Polling    BullMQ     Improvement
10 jobs:      3/sec      17/sec   → 5.7x faster
50 jobs:      13/sec     29/sec   → 2.2x faster
100 jobs:     21/sec     47/sec   → 2.2x faster
```

### Test 3 — Priority Queue
```
Polling:  FIFO only — critical waits behind routine
BullMQ:   Critical processed 5th out of 21 jobs
          (only 4 routine jobs already grabbed by workers)
          → critical jumps the queue ✅
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20, TypeScript |
| Framework | Express |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Queue | BullMQ + Redis 7 |
| Containerization | Docker + Docker Compose |
| CI | GitHub Actions |
| Testing | Vitest |

---

## Project Structure

```
src/
├── api/
│   ├── server.ts               # Express app setup
│   └── routes/
│       ├── pipelines.ts        # CRUD for pipelines
│       ├── webhooks.ts         # Webhook ingestion + queue push
│       └── jobs.ts             # Job status, history, attempts
├── worker/
│   ├── worker.ts               # BullMQ event-driven worker (5 concurrent)
│   └── delivery.ts             # HTTP delivery + retry logic
├── queues/
│   └── jobQueue.ts             # Redis connection + BullMQ queue setup
├── actions/
│   ├── index.ts                # Action router
│   ├── severity_classifier.ts  # Classify and filter by severity
│   ├── field_normalizer.ts     # Normalize inconsistent field names
│   ├── keyword_alert.ts        # Scan text for critical keywords
│   └── response_enricher.ts   # Add metadata and response windows
├── db/
│   ├── schema.ts               # Drizzle table definitions
│   ├── client.ts               # PostgreSQL connection pool
│   ├── migrate.ts              # Migration runner
│   ├── migrations/             # Generated SQL migrations
│   └── queries/
│       ├── pipelines.ts        # Pipeline + subscriber queries
│       ├── jobs.ts             # Job queries
│       └── deliveries.ts       # Delivery attempt queries
├── scripts/
│   ├── mock-subscriber.ts      # Fake subscriber server (port 3001)
│   └── simulate.ts             # End-to-end simulation + performance tests
├── tests/
│   └── actions.test.ts         # 17 unit tests for all action types
└── types/
    └── index.ts                # Shared TypeScript types
```

---

## Database Schema

```
pipelines
  id, name, source_token, action_type, action_config (JSONB), created_at, updated_at

pipeline_subscribers
  id, pipeline_id (FK → pipelines), url, created_at

jobs
  id, pipeline_id (FK → pipelines), payload (JSONB), status, result (JSONB),
  error, created_at, processed_at

delivery_attempts
  id, job_id (FK → jobs), subscriber_url, status, attempt_number,
  response_code, error, attempted_at
```

---

## Setup

### Prerequisites

- Docker + Docker Compose
- Node.js 20+ (for local development)

### Run with Docker (recommended)

```bash
git clone https://github.com/zain661/webhook-pipeline.git
cd webhook-pipeline
docker compose up --build
```

This starts 6 services automatically:
- `postgres` — database on port 5433
- `redis` — queue broker on port 6379
- `migrate` — runs migrations once, then exits
- `api` — HTTP server on port 3000
- `worker` — BullMQ event-driven job processor
- `mock` — fake subscriber server on port 3001

### Run locally (development)

```bash
# Install dependencies
npm install

# Start postgres and redis only
docker compose up -d postgres redis

# Run migrations
npm run db:migrate

# Terminal 1: API server
npm run dev

# Terminal 2: Worker
npm run worker

# Terminal 3: Mock subscriber
npm run mock
```

### Environment variables

Create a `.env` file:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/webhook_pipeline
REDIS_URL=redis://localhost:6379
```

---

## API Reference

### Pipelines

#### Create pipeline
```
POST /pipelines
```
```json
{
  "name": "Medical Emergency Pipeline",
  "action_type": "severity_classifier",
  "action_config": {
    "severity_field": "severity_score",
    "drop_below": 3,
    "levels": {
      "critical": { "operator": "gte", "value": 8 },
      "high":     { "operator": "gte", "value": 5 }
    }
  },
  "subscriber_urls": [
    "https://your-server.com/coordination",
    "https://your-server.com/emergency"
  ]
}
```

Response:
```json
{
  "id": "uuid",
  "name": "Medical Emergency Pipeline",
  "source_token": "uuid",
  "action_type": "severity_classifier",
  "created_at": "2026-03-11T..."
}
```

#### Other pipeline endpoints
```
GET    /pipelines          → list all pipelines
GET    /pipelines/:id      → get pipeline by id
PUT    /pipelines/:id      → update pipeline
DELETE /pipelines/:id      → delete pipeline
```

---

### Webhooks

#### Ingest webhook
```
POST /webhooks/ingest/:source_token
```

Send any JSON payload — it gets saved to the database and pushed to the Redis queue instantly. Reports with `severity_score >= 8` are assigned priority 1 (critical) and jump ahead in the queue.

```json
{
  "event": "medical.request",
  "location": "Al Shifa Hospital",
  "severity_score": 9,
  "reporter": "Dr. Ahmad Khalil"
}
```

Response:
```json
{
  "message": "Webhook received, job queued",
  "job_id": "uuid"
}
```

---

### Jobs

```
GET /jobs                    → list all jobs (supports ?status= and ?pipeline_id= filters)
GET /jobs/:id                → full job details + delivery attempts
GET /jobs/:id/status         → just the job status
GET /jobs/:id/history        → input payload vs output result (before/after transformation)
GET /jobs/:id/attempts       → delivery attempts with response codes
```

#### Example: job history response
```json
{
  "job_id": "uuid",
  "status": "completed",
  "received_at": "2026-03-11T...",
  "processed_at": "2026-03-11T...",
  "input": {
    "event": "medical.request",
    "severity_score": 9
  },
  "output": {
    "event": "medical.request",
    "severity_score": 9,
    "classification": "critical",
    "escalate": true
  }
}
```

#### Example: delivery attempts response
```json
{
  "job_id": "uuid",
  "status": "completed",
  "total_attempts": 2,
  "attempts": [
    {
      "subscriber_url": "https://your-server.com/coordination",
      "status": "success",
      "attempt_number": 1,
      "response_code": 200
    }
  ]
}
```

---

## Action Types

### `severity_classifier`

Classifies reports by severity score and drops below-threshold reports entirely.

```json
{
  "action_type": "severity_classifier",
  "action_config": {
    "severity_field": "severity_score",
    "drop_below": 3,
    "levels": {
      "critical": { "operator": "gte", "value": 8 },
      "high":     { "operator": "gte", "value": 5 }
    }
  }
}
```

- Score 9 → `classification: "critical"`, `escalate: true` → delivered
- Score 6 → `classification: "high"`, `escalate: true` → delivered
- Score 2 → dropped, no delivery

---

### `field_normalizer`

Maps alternative field names to standard names and removes null fields.

```json
{
  "action_type": "field_normalizer",
  "action_config": {
    "normalize": {
      "location": ["area", "zone", "region", "place"],
      "contact":  ["submitted_by", "reporter", "officer"]
    },
    "remove_nulls": true
  }
}
```

- `area: "North Gaza"` → `location: "North Gaza"`
- `submitted_by: "UNRWA Officer"` → `contact: "UNRWA Officer"`
- `notes: null` → removed

---

### `keyword_alert`

Scans a text field for critical keywords and flags matches.

```json
{
  "action_type": "keyword_alert",
  "action_config": {
    "scan_field": "description",
    "critical_keywords": ["airstrike", "casualty", "evacuation"],
    "flag_field": "requires_immediate_action",
    "drop_if_no_match": false
  }
}
```

- Keywords found → `requires_immediate_action: true`, `matched_keywords: [...]`
- No keywords + `drop_if_no_match: true` → dropped, no delivery

---

### `response_enricher`

Adds metadata, timestamps, and response windows to payloads.

```json
{
  "action_type": "response_enricher",
  "action_config": {
    "addTimestamp": true,
    "addPipelineId": true,
    "addField": { "system": "humanitarian-aid", "region": "Gaza" },
    "priorityMap": {
      "critical": "P1 - Respond within 1 hour",
      "high":     "P2 - Respond within 4 hours"
    },
    "prioritySource": "classification"
  }
}
```

Adds `processedAt`, `pipelineId`, custom fields, and `responseWindow` based on classification.

---

## Retry Logic

Failed deliveries are retried with exponential backoff:

```
Attempt 1 → immediate
Attempt 2 → retry after 30 seconds
Attempt 3 → retry after 2 minutes
Attempt 4 → retry after 10 minutes
Max attempts: 4 → job marked as failed
```

---

## Testing

### Unit tests

```bash
npm run test
```

17 tests covering all 4 action types:
- severity_classifier — 4 tests (critical, high, drop, low)
- field_normalizer — 4 tests (normalize, remove nulls, keep fields)
- keyword_alert — 4 tests (match, no match, drop, deliver)
- response_enricher — 5 tests (timestamp, pipelineId, fields, priority, no match)

### Run simulation (requires Docker running)

```bash
# Start everything
docker compose up --build

# Run simulation (in separate terminal)
npm run simulate
```

The simulation runs 4 pipeline demos, then 3 performance tests:

**Test 1 — Latency:** measures time from webhook to job completed

**Test 2 — Load:** sends 10, 50, 100 simultaneous jobs and measures throughput

**Test 3 — Priority:** sends 20 routine + 1 critical simultaneously, verifies critical processes first

### Watch live deliveries

```bash
docker compose logs -f mock
```

### Check job results

```bash
# All jobs
curl http://localhost:3000/jobs

# Job history (before vs after transformation)
curl http://localhost:3000/jobs/<job_id>/history

# Delivery attempts
curl http://localhost:3000/jobs/<job_id>/attempts
```

---

## CI

GitHub Actions runs on every push to `main` and `feature/*` branches:

- **Tests job** — runs 17 Vitest unit tests with coverage
- **Style job** — checks Prettier formatting and ESLint rules

---

## Design Decisions

**Why BullMQ + Redis instead of polling?**
The initial version used polling every 3 seconds (see `feature/polling-approach` branch). This worked but created two problems for disaster scenarios: up to 3 second delay before processing starts, and only 1 job is processed at a time. BullMQ gives instant pickup (~330ms vs ~1216ms) and 5 concurrent workers. At 100 simultaneous jobs: 47 jobs/sec vs 21 jobs/sec. The tradeoff is one additional service (Redis) in the stack.

**Why is the database the source of truth, not Redis?**
Redis is ephemeral — if it restarts, queue contents are lost. Every job is saved to PostgreSQL before being pushed to Redis. If Redis goes down, jobs are not lost — they can be requeued from the database. This is critical for a humanitarian system where losing a report is not acceptable.

**Why priority queue?**
In disaster scenarios, a field team's routine daily check should not block a hospital's emergency request. Reports with `severity_score >= 8` are pushed to the queue with priority 1. Everything else gets priority 10. BullMQ processes lower-priority numbers first.

**Why separate containers for API and worker from the same image?**
One Dockerfile builds one image. Docker Compose runs it with different commands. This is simpler than maintaining separate Dockerfiles while still giving full process isolation; either service can restart independently.

**Why JSONB for payload, result, and action_config?**
Webhooks can have any shape. Action configs vary by type. JSONB lets each pipeline define its own schema without database migrations for every new field. TypeScript types enforce structure at the application layer.

**Why exponential backoff for retries?**
A subscriber that is temporarily down should not be hammered with requests. 4 attempts over ~30 minutes covers most transient failures. The delivery attempt history is stored in the database so you can inspect exactly what happened to every delivery.

**Security — ESLint object injection rule**
The `security/detect-object-injection` ESLint rule is disabled in this project with documented intent. The rule flags dynamic object property access (`obj[variable]`) as a potential prototype pollution risk. In this codebase, the two locations that trigger it are safe:

- `field_normalizer.ts` — the key (`standardName`) comes from `action_config`, which is set by the pipeline creator at setup time, not from the incoming webhook payload.
- `response_enricher.ts` — the key (`classificationValue`) is derived from a controlled classification result (`"critical"`, `"high"`, `"low"`), not arbitrary user input.

In a production system, the fix would be to replace direct bracket access with `Object.prototype.hasOwnProperty.call()` checks and sanitize config values at pipeline creation time.

---

## Live Demo

The API is deployed on Google Cloud Run:
```
https://webhook-pipeline-api-63h2nwxy3q-ew.a.run.app
```
```bash
# Health check
curl https://webhook-pipeline-api-63h2nwxy3q-ew.a.run.app/health

# Create a pipeline
curl -X POST https://webhook-pipeline-api-63h2nwxy3q-ew.a.run.app/pipelines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Pipeline",
    "action_type": "severity_classifier",
    "action_config": {
      "severity_field": "severity_score",
      "drop_below": 3,
      "levels": {
        "critical": { "operator": "gte", "value": 8 },
        "high":     { "operator": "gte", "value": 5 }
      }
    },
    "subscriber_urls": ["https://webhook.site/your-id"]
  }'
```

## Branches

| Branch | Description |
|---|---|
| `main` | Production-ready BullMQ version |
| `feature/polling-approach` | Original polling architecture (preserved for comparison) |
| `feature/redis-queue` | Redis upgrade branch (merged into main via PR #1) |
