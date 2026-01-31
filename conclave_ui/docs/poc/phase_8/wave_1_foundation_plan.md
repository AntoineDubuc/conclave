# Implementation Plan: Phase 8, Wave 1 -- Session Foundation

---

## Executive Summary

Wave 1 builds the invisible data layer that every subsequent wave of Phase 8 (Conclave Sessions) depends on. Today, the agent service is fully ephemeral: sessions live in an in-memory `Map`, user identity is hardcoded to `"demo-user"`, and nothing survives a server restart. This wave introduces real persistence (Supabase `sessions` and `session_events` tables), real user identity (JWT auth middleware on the agent service), and the append-only event log pattern that will power session rehydration, context management, and the session list UI in later waves.

There are zero visible UI changes in this wave. A user interacting with Conclave after Wave 1 will notice no difference. But under the hood, every conversation turn is now durably stored, tied to a real user, and recoverable -- which is the prerequisite for everything Sessions promises.

**Key Outcomes:**
- Sessions persist in Supabase and survive agent service restarts
- Every conversation event (user message, agent response, tool call, flow result) is recorded in an append-only event log
- The agent service validates Supabase JWTs (via JWKS-based verification) and uses real `user_id` values instead of the hardcoded `"demo-user"`
- Session types gain `name`, `goal`, and `brief` fields required by the session UI in Wave 3

---

## Product Manager Review

### Feature Overview

Wave 1 delivers four foundational capabilities that are invisible to end users but critical for the Sessions feature. Each one removes a hard blocker for subsequent waves.

### Features

#### Feature 1: Supabase Tables (sessions + session_events)

**What it is:** Two new database tables that store session metadata and an append-only event log of everything that happens within a session.

**Why it matters:** Without persistent storage, sessions die when the server restarts or when the 30-minute in-memory TTL expires. The event log is the single source of truth that enables session resume (Wave 3), context summarization (Wave 2), and the session list (Wave 3).

**User perspective:** No direct user interaction. This is infrastructure. Users will benefit from it starting in Wave 3 when they can list, resume, and name their sessions.

---

#### Feature 2: Auth Middleware on Agent Service

**What it is:** Express middleware that validates the Supabase JWT sent by the Next.js frontend, extracts the real `user_id`, and attaches it to the request. Unauthenticated requests are rejected.

**Why it matters:** The agent service currently hardcodes `userId: "demo-user"` on every session (see the `userId` assignment in `SessionStore.create()` in `store.ts`). Without real user identity, we cannot associate sessions with users in the database, and Row Level Security on Supabase tables would be meaningless.

**User perspective:** No visible change. The frontend already has Supabase Auth and holds a valid JWT. This wave makes the agent service consume that token. Users who are not logged in will see agent requests fail, which aligns with existing auth requirements.

---

#### Feature 3: Session Persistence (Event Logging)

**What it is:** After each conversational turn, the agent service writes one or more event rows to `session_events` in Supabase. Events are append-only, sequenced, and typed (e.g., `user_message`, `agent_message`, `tool_use`, `tool_result`).

**Why it matters:** This is the mechanism that makes sessions durable. The in-memory session store remains the hot path for active sessions, but every event is also written to Supabase. When a session falls out of memory (TTL, restart), it can be rehydrated from the event log -- though rehydration itself is a Wave 2/3 concern.

**User perspective:** No visible change. The write happens asynchronously after each turn. The user does not wait for the database write.

**Known risk (fire-and-forget persistence):** If the Supabase write fails silently (network blip, schema mismatch, RLS misconfiguration), the user has no indication that their session data was not saved. They will discover the loss only when they try to resume in Wave 3. During development, the error logging in the catch handler must produce a clearly visible warning. The Wave 3 plan should include a "session health" indicator showing whether the last event was durably persisted. This is not a Wave 1 blocker but is tracked here as a known risk.

---

#### Feature 4: Session Types Update

**What it is:** Add `name`, `goal`, and `brief` fields to the `Session` TypeScript type and the Supabase `sessions` table.

**Why it matters:** The session UI (Wave 3) needs a name and goal to display in the session list and tree. The `brief` field is the running summary used by the smart context system (Wave 2). Adding these fields now avoids a breaking migration later.

**User perspective:** No visible change. These fields are populated with sensible defaults (`name: null`, `goal: null`, `brief: ""`). Wave 3 will auto-generate names from the first user message.

---

## Master Checklist

### Instructions for Claude Code

> **CRITICAL: You must follow these rules exactly.**
>
> 1. **Save after every cell write.** You cannot batch writes to this table. Each time you update a cell (start time, end time, estimate, etc.), you must save the file immediately before proceeding to other cells or other work.
>
> 2. **Check the checkbox** when you begin a task. This serves as a visual indicator of which task is currently in progress.
>
> 3. **Workflow for each task:**
>    - Check the checkbox `[x]` -> Save
>    - Write start time -> Save
>    - Complete the implementation work
>    - Write end time -> Save
>    - Calculate and write total time -> Save
>    - Write human time estimate -> Save
>    - Calculate and write multiplier -> Save
>    - Move to next task
>
> 4. **Time format:** Use `HH:MM` (24-hour format) for start/end times. Use minutes for total time and estimates.
>
> 5. **Multiplier calculation:** `Multiplier = Human Estimate / Total Time`. Express as `Nx` (e.g., `10x` means 10 times faster than human estimate).
>
> 6. **If blocked:** Note the blocker in the task description section below and move to the next unblocked task.

### Progress Dashboard

| Done | # | Task Name | Start | End | Total (min) | Human Est. (min) | Multiplier |
|:----:|:-:|-----------|:-----:|:---:|:-----------:|:----------------:|:----------:|
| [ ] | 1 | Supabase migration: sessions + session_events tables | | | | 90 | |
| [ ] | 2 | Add @supabase/supabase-js to agent service | | | | 20 | |
| [ ] | 3 | Create Supabase client module in agent service | | | | 45 | |
| [ ] | 4 | Auth middleware: validate JWT and extract user_id | | | | 90 | |
| [ ] | 5 | Wire auth middleware into Express server | | | | 30 | |
| [ ] | 6 | Update Session type: add name, goal, brief fields | | | | 30 | |
| [ ] | 7 | Update SessionStore: accept userId from auth, remove demo-user | | | | 45 | |
| [ ] | 8 | Event persistence: write session events to Supabase | | | | 120 | |
| [ ] | 9 | Update frontend: pass Supabase access token to agent service | | | | 60 | |
| [ ] | 10 | Integration testing and verification | | | | 90 | |

**Summary:**
- Total tasks: 10
- Completed: 0
- Total time spent: 0 minutes
- Total human estimate: 620 minutes (~10.3 hours)
- Overall multiplier: --

---

## Task Descriptions

This section provides context for each task. Read the relevant description before starting implementation.

---

### Task 1: Supabase Migration -- sessions + session_events Tables

**Intent:** Create the database tables that will store session data and the append-only event log.

**Context:** This is the foundation table. Every other task in this wave (and in Waves 2-4) depends on these tables existing. The migration must follow the conventions established by existing migrations (see `20260110210609_initial_schema.sql` and `20260127100000_create_flows_table.sql`). Both tables must reference `public.profiles(id)` for the user foreign key, enable RLS, and define policies that restrict access to the owning user. The agent service will use the service role key (bypassing RLS) for writes, but these policies protect data if we later expose tables through PostgREST or the frontend.

**Expected behavior:** After running `supabase db reset` or applying the migration, two new tables exist:
- `public.sessions` with columns: `id` (UUID PK), `user_id` (FK to profiles), `name` (TEXT, nullable), `goal` (TEXT, nullable), `brief` (TEXT, default ''), `status` (TEXT, default 'active', CHECK in 'active'/'archived'/'deleted'), `created_at`, `updated_at`
- `public.session_events` with columns: `id` (UUID PK, default gen_random_uuid()), `session_id` (FK to sessions, ON DELETE CASCADE), `event_type` (TEXT, CHECK in 'user_message','agent_message','tool_use','tool_result','flow_started','flow_completed','user_edit','artifact_created'), `payload` (JSONB, NOT NULL), `sequence_number` (INTEGER, NOT NULL), `created_at` (TIMESTAMPTZ, default NOW())
- Composite index on `session_events(session_id, sequence_number)` for efficient replay
- Index on `sessions(user_id, updated_at DESC)` for session listing
- RLS enabled on both tables with user-scoped SELECT/INSERT/UPDATE policies
- Auto-update trigger on `sessions.updated_at`

**Key components:**
- Create file: `conclave-app/supabase/migrations/YYYYMMDDHHMMSS_create_sessions_tables.sql`
- Reference: `conclave-app/supabase/migrations/20260110210609_initial_schema.sql` (pattern for RLS policies, FK references)
- Reference: `conclave-app/supabase/migrations/20260127100000_create_flows_table.sql` (pattern for updated_at trigger, comments)

**Notes:**
- The `session_events` table uses a `sequence_number` INTEGER rather than relying on `created_at` ordering. Sequence numbers are assigned by the agent service per-session and guarantee deterministic replay order even if two events have identical timestamps.
- The `payload` column is JSONB and its shape varies by `event_type`. We do NOT add a CHECK constraint on the JSONB structure -- validation happens at the application layer.
- Do NOT add a service-role-only INSERT policy. The service role key already bypasses RLS. Policies are for user-facing access only.
- The `event_type` CHECK constraint includes 8 types, but only 4 (`user_message`, `agent_message`, `tool_use`, `tool_result`) are written by Wave 1 (Task 8). The remaining 4 (`flow_started`, `flow_completed`, `user_edit`, `artifact_created`) are reserved for future waves. Add a SQL comment in the migration noting which types are placeholders: `-- Wave 1 writes: user_message, agent_message, tool_use, tool_result. Reserved for future waves: flow_started, flow_completed, user_edit, artifact_created.`
- After creating the migration, regenerate TypeScript types: `npm run db:types` from the `conclave-app/` directory.

---

### Task 2: Add @supabase/supabase-js to Agent Service

**Intent:** Install the Supabase client library as a dependency of the agent service so it can connect to Supabase for auth validation and data persistence.

**Context:** The agent service (`agent-service/package.json`) currently has no Supabase dependency. The Next.js frontend uses `@supabase/supabase-js@^2.90.1` and `@supabase/ssr@^0.8.0`. The agent service only needs `@supabase/supabase-js` -- it does not need `@supabase/ssr` because it is a plain Express server, not a Next.js app.

**Expected behavior:** After this task, `@supabase/supabase-js` appears in `agent-service/package.json` under `dependencies`, and `npm install` runs clean with no peer dependency warnings.

**Key components:**
- Modify: `agent-service/package.json` (add dependency)
- Run: `cd agent-service && npm install @supabase/supabase-js`
- Create file: `agent-service/.env.example` (document all required environment variables: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Include comments describing each variable and where to find its value.)

**Notes:**
- Use a version compatible with the frontend's `@supabase/supabase-js@^2.90.1`. Install `^2.90.1` to stay in sync.
- Also add the new environment variables to the agent service's startup validation: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. These will be needed by Tasks 3 and 4.
- The `.env.example` file prevents onboarding friction for developers joining after Wave 1. It should list all required environment variables with descriptions.

---

### Task 3: Create Supabase Client Module in Agent Service

**Intent:** Create a `db/` module in the agent service that initializes and exports a Supabase admin client (service role) for database operations.

**Context:** The agent service needs to perform two types of Supabase operations: (a) validate user JWTs (auth, Task 4), and (b) write session data (persistence, Task 8). Both require a Supabase client. Following the frontend's pattern (`conclave-app/lib/supabase/admin.ts`), we create a service-role client that bypasses RLS. The agent service is a trusted backend -- it should use the service role key, not the anon key.

**Expected behavior:** A new module at `agent-service/src/db/supabase.ts` exports a `getSupabaseAdmin()` function that returns a Supabase client configured with the service role key. The client is created lazily (on first call) and reused. Environment variables `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required; the module throws a clear error if they are missing.

**Key components:**
- Create file: `agent-service/src/db/supabase.ts`
- Create file: `agent-service/src/db/index.ts` (barrel export)
- Reference: `conclave-app/lib/supabase/admin.ts` (pattern to follow)
- Modify: `agent-service/src/index.ts` (add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the `REQUIRED_ENV_VARS` array)

**Notes:**
- Use lazy initialization (singleton pattern) rather than top-level initialization. This avoids import-time side effects and makes testing easier.
- The client should be configured with `auth: { autoRefreshToken: false, persistSession: false }` since the service role key does not need token refresh.
- Do NOT add `SUPABASE_JWT_SECRET` to required env vars -- it is no longer needed. Task 4 uses JWKS-based verification, which fetches the public key from Supabase automatically.

---

### Task 4: Auth Middleware -- Validate JWT and Extract user_id

**Intent:** Create Express middleware that reads the `Authorization: Bearer <token>` header, validates it as a Supabase JWT, and attaches the authenticated `user_id` to the request object.

**Context:** The frontend already authenticates users via Supabase Auth. The Supabase client on the frontend holds an access token (JWT) that can be sent to backend services. Currently, the agent service ignores this token entirely and hardcodes `userId: "demo-user"` in the `userId` assignment in `SessionStore.create()` (in `store.ts`). This middleware will sit between the CORS middleware and the route handlers, rejecting unauthenticated requests with a 401.

There are three approaches to validate the JWT:
1. **Supabase `auth.getUser(token)`** -- Makes a network call to Supabase Auth to validate the token. Simple but adds latency (~50-100ms per request).
2. **Manual HS256 JWT verification** -- Verify the JWT signature locally using the `SUPABASE_JWT_SECRET` and the `jsonwebtoken` package. Fast but **only works if the project uses HS256 signing**. Supabase has transitioned to asymmetric signing keys (ES256/RS256) as the default, and their docs now label HS256 as "Not recommended for production applications."
3. **JWKS-based verification using `jose`** -- Fetch and cache the public key from Supabase's JWKS endpoint (`GET https://<project-id>.supabase.co/auth/v1/.well-known/jwks.json`) and verify the JWT locally. Works with both HS256 legacy and ES256 new projects. No `SUPABASE_JWT_SECRET` env var needed. The JWKS response is cached locally after the first fetch, so latency is only incurred once.

Recommended approach: **Option 3 (JWKS-based verification using `jose`)**. This is the most robust approach: it works regardless of the project's signing algorithm, requires no additional configuration (the public key is fetched automatically from the Supabase endpoint), and verifies locally after the initial fetch (no per-request network latency). The `jose` library is the standard for JWKS-based verification in Node.js and includes built-in TypeScript types (no separate `@types` package needed).

**Expected behavior:**
- Requests to `/api/chat/*` must include `Authorization: Bearer <supabase_access_token>`
- The middleware fetches the JWKS from the Supabase endpoint on first use (cached thereafter) and verifies the JWT signature against the public key
- If valid, `req.userId` (added via TypeScript declaration merging on Express's `Request`) is set to the JWT's `sub` claim (which is the Supabase `auth.users.id`)
- If invalid or missing, the middleware returns `401 { error: "unauthorized", message: "..." }` and does not call `next()`
- The `/health` endpoint is exempt from auth (it must remain unauthenticated)

**Key components:**
- Create file: `agent-service/src/middleware/auth.ts`
- Modify: `agent-service/src/types/index.ts` (add Express Request augmentation for `userId`)
- Install: `jose` (for JWKS-based JWT verification; includes built-in TypeScript types)
- The `SUPABASE_URL` env var (already required by Task 3) provides the base URL for the JWKS endpoint. No additional env vars are needed for auth.

**Notes:**
- The Supabase JWT payload includes: `sub` (user UUID), `email`, `role` (e.g., "authenticated"), `aud` (e.g., "authenticated"), `exp` (expiration timestamp), `iat` (issued at). We only need `sub`.
- Use TypeScript declaration merging to add `userId` to Express's `Request` type:
  ```typescript
  declare global {
    namespace Express {
      interface Request {
        userId?: string;
      }
    }
  }
  ```
- The middleware should also handle expired tokens (check `exp` claim) with a clear error: "Token expired. Please refresh your session."
- For local development, consider an optional `SKIP_AUTH=true` environment variable that bypasses auth and uses a configurable default user ID. This helps developers who are only testing the agent service without the full frontend. Log a warning when this mode is active.
- The JWKS endpoint URL is constructed as `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`. Use `jose`'s `createRemoteJWKSet()` function, which handles fetching, caching, and key rotation automatically.
- **Reference:** Supabase signing keys documentation: https://supabase.com/docs/guides/auth/signing-keys

---

### Task 5: Wire Auth Middleware into Express Server

**Intent:** Register the auth middleware in the Express app so it applies to all `/api/chat/*` routes but not to `/health`.

**Context:** The Express middleware stack in `server.ts` currently is: CORS -> request logger -> JSON parser -> health check route -> chat router -> 404 handler -> error handler. The auth middleware must go after JSON parsing (it reads the Authorization header, not the body) but before the chat router. The `/health` endpoint is safe from auth because it is registered as its own `app.get()` on a dedicated line before the chat router, not because of path filtering.

**Expected behavior:**
- `GET /health` returns 200 without any auth token
- `POST /api/chat/message/stream` without a token returns 401
- `POST /api/chat/message/stream` with a valid token proceeds normally
- `POST /api/chat/message/stream` with an expired token returns 401 with an "expired" message

**Key components:**
- Modify: `agent-service/src/server.ts` (import auth middleware, apply before chat routes)

**Notes:**
- Apply the middleware selectively. Use `app.use("/api/chat", authMiddleware, chatRouter)` rather than `app.use(authMiddleware)` to keep `/health` unauthenticated. The `/health` endpoint is defined before the chat router on its own `app.get()` line, so the selective `app.use("/api/chat", ...)` pattern correctly excludes it from auth.
- Alternative: use a route-level guard. But the selective `app.use` pattern is cleaner and matches how `corsMiddleware` is applied.
- Depends on: Task 4 (auth middleware exists).

---

### Task 6: Update Session Type -- Add name, goal, brief Fields

**Intent:** Extend the `Session` TypeScript interface with the fields required by Sessions: `name`, `goal`, and `brief`.

**Context:** The current `Session` interface in `agent-service/src/types/index.ts` has: `id`, `userId`, `messages`, `createdAt`, `lastActivityAt`, `metadata`, `apiKeys`, `isProcessing`, `processingStartedAt`. The Phase 8 data model requires `name` (user-facing session title), `goal` (the user's stated objective), and `brief` (running summary for context management). Adding these now prevents type breakage when Wave 2 and 3 start using them.

**Expected behavior:**
- `Session.name` is `string | null` (null until auto-generated or user-set)
- `Session.goal` is `string | null` (null until derived from first message)
- `Session.brief` is `string` (default `""`, populated by Wave 2's summarization)
- `SessionStateResponse` is updated to include `name` and `goal` (the brief is internal, not exposed to the frontend yet)
- The `SessionStore.create()` method initializes these fields with their defaults
- Existing code continues to work without changes (all new fields are optional/defaulted)

**Key components:**
- Modify: `agent-service/src/types/index.ts` (add fields to `Session` interface, update `SessionStateResponse`)
- Modify: `agent-service/src/session/store.ts` (set defaults in the `create()` method)
- Modify: `agent-service/src/routes/chat.ts` (include `name`, `goal` in `GET /api/chat/session/:id` response)

**Notes:**
- Do NOT make `name` or `goal` required in the `Session` interface. Use `string | null`. Existing sessions created before this change should not break.
- The `brief` field is for internal use (context management in Wave 2). Do not include it in the `SessionStateResponse`. It may contain summarized context that should not leak to the frontend prematurely.
- This task has no dependency on the Supabase tables (Task 1). The types are TypeScript-only. However, the column names must match what Task 1's migration creates.
- Use symbolic references (e.g., "the `Session` interface in `types/index.ts`") rather than relying solely on line numbers, as line numbers may shift with unrelated merges.

---

### Task 7: Update SessionStore -- Accept userId from Auth, Remove demo-user

**Intent:** Modify `SessionStore.create()` to accept a `userId` parameter from the authenticated request instead of hardcoding `"demo-user"`.

**Context:** Today, the `userId` assignment in `SessionStore.create()` (in `store.ts`) hardcodes `userId: "demo-user"`. After Task 4, every authenticated request has `req.userId` available. The session store's `create()` method must accept this value. The route handler in `chat.ts` must pass it through.

**Pre-existing bug to fix:** The test at `__tests__/session.test.ts` asserts `userId` equals `"demo_user"` (underscore), but the actual code uses `"demo-user"` (hyphen). The comment in `types/index.ts` also says `"demo_user"` (underscore). This test is already broken and must be fixed as part of this task. Additionally, the mock session in `__tests__/tools.test.ts` independently hardcodes `userId: "demo_user"` (underscore). All three locations must be corrected.

**Expected behavior:**
- `SessionStore.create(userId, apiKeys?)` now requires a `userId` string as the first parameter
- The `chatRouter` in `routes/chat.ts` passes `req.userId` to `sessionStore.create()` in **both** endpoints that create sessions:
  - `POST /api/chat/message` (non-streaming endpoint)
  - `POST /api/chat/message/stream` (streaming endpoint)
- The comment `// Hardcoded for POC` is removed from `store.ts`
- The comment `// Hardcoded to "demo_user" for POC` is removed from `types/index.ts`
- Session tests in `__tests__/session.test.ts` are updated to pass a mock userId (and the broken `"demo_user"` assertion is fixed)
- Mock sessions in `__tests__/tools.test.ts` are updated to use a consistent mock userId

**Key components:**
- Modify: `agent-service/src/session/store.ts` (change `create()` signature, remove the `userId: "demo-user"` hardcode)
- Modify: `agent-service/src/routes/chat.ts` (pass `req.userId` to `sessionStore.create()` at **both** the `POST /message` and `POST /message/stream` endpoints)
- Modify: `agent-service/src/__tests__/session.test.ts` (update test calls, fix broken `"demo_user"` assertion)
- Modify: `agent-service/src/__tests__/tools.test.ts` (update mock session `userId` from `"demo_user"` to the test mock value)

**Notes:**
- The `userId` parameter should be a required `string`, not optional. By this point, the auth middleware guarantees it exists.
- Do NOT add Supabase session creation here. Task 8 handles writing to Supabase. This task only changes the in-memory store's API.
- **Known side effect:** When `session.userId` changes from `"demo-user"` to a real UUID, the `task.ts` tool will create flows under `flows/<uuid>/` instead of `flows/demo-user/`. Existing POC flows at the old path (`flows/demo-user/<slug>`) will not be accessible. This is acceptable (POC data is disposable) but should be noted for awareness.
- Use symbolic references (e.g., "the `create()` method in `SessionStore`") in addition to line numbers when locating code, as line numbers may shift with unrelated merges.
- Depends on: Task 4 (auth middleware), Task 5 (middleware wired in), Task 6 (updated types).

---

### Task 8: Event Persistence -- Write Session Events to Supabase

**Intent:** After each conversational turn (user message + agent response + any tool calls/results), write event rows to `session_events` and upsert the session record in `sessions`.

**Context:** This is the core persistence mechanism. The in-memory store remains the primary data path for active sessions. Supabase writes happen asynchronously after each turn completes -- they do NOT block the response to the user. If a Supabase write fails, the error is logged but the user is not affected. The data is best-effort durable: if the agent service crashes between completing a turn and writing to Supabase, that turn is lost. This is acceptable for V1; Wave 2 will add write-ahead buffering if needed.

**Expected behavior:**
- When a new session is created in memory, a corresponding row is inserted into `sessions` (with `user_id`, `name: null`, `goal: null`, `brief: ''`, `status: 'active'`)
- After each complete turn (user message in, agent response out, all tool calls resolved), the following events are written to `session_events`:
  - `user_message`: payload = `{ content: string }`
  - `agent_message`: payload = `{ content: string }`
  - `tool_use`: payload = `{ tool: string, input: object, tool_use_id: string }`
  - `tool_result`: payload = `{ tool: string, result: unknown, tool_use_id: string }`
- Each event gets an incrementing `sequence_number` per session (maintained in memory on the `Session` object)
- The `sessions.updated_at` is updated on each write (handled by the DB trigger from Task 1)
- Supabase writes are fire-and-forget (async, not awaited in the request path). Errors are logged to console.
- A new `persistSessionEvents()` function is created in a `db/session-persistence.ts` module

**Key components:**
- Create file: `agent-service/src/db/session-persistence.ts` (contains `createSessionInDb()`, `persistSessionEvents()`)
- Modify: `agent-service/src/db/index.ts` (export new functions)
- Modify: `agent-service/src/session/store.ts` (add `nextSequenceNumber` to Session tracking, call `createSessionInDb()` on create)
- Modify: `agent-service/src/routes/chat.ts` (call `persistSessionEvents()` after each turn completes, in the `finally` block)
- Modify: `agent-service/src/types/index.ts` (add `nextSequenceNumber: number` to `Session` interface)

**Notes:**
- The `persistSessionEvents()` function should accept the full list of new events from the turn and batch-insert them in a single Supabase call using `.insert([...events])`.
- Sequence numbers start at 1 for each session and increment monotonically. Store `nextSequenceNumber` on the in-memory `Session` object.
- For the `agent_message` event, store the full text content. For `tool_result`, store the complete result object. Yes, this means large payloads (flow results can be 50KB+). This is fine -- Supabase JSONB handles it, and we need the full data for rehydration in Wave 2.
- Fire-and-forget pattern: call `persistSessionEvents(events).catch(err => console.error('Failed to persist events:', err))` -- no `await` in the request path.
- Do NOT implement session rehydration (reading back from Supabase) in this task. That is Wave 2/3 scope.
- Depends on: Task 1 (tables exist), Task 3 (Supabase client), Task 6 (Session type with nextSequenceNumber), Task 7 (real userId).

---

### Task 9: Update Frontend -- Pass Supabase Access Token to Agent Service

**Intent:** Modify the frontend's `use-agent-chat.ts` hook to include the user's Supabase access token in the `Authorization` header when calling the agent service.

**Context:** The frontend already has the user's Supabase session available via `@supabase/ssr`. The `use-agent-chat.ts` hook (at `conclave-app/lib/hooks/use-agent-chat.ts`) currently makes fetch requests to the agent service without any auth headers. After Task 4, the agent service rejects unauthenticated requests with 401. The frontend must send `Authorization: Bearer <access_token>`.

**Expected behavior:**
- Before each fetch to the agent service, the hook retrieves the current Supabase session using `supabase.auth.getSession()`
- The access token is included as `Authorization: Bearer <token>` in the fetch headers
- If there is no session (user not logged in), the hook does not attempt the fetch and sets an appropriate error message
- If the agent service returns 401 (expired token), the hook attempts to refresh the session once and retry
- The existing `api_keys` field in the request body is unchanged

**Key components:**
- Modify: `conclave-app/lib/hooks/use-agent-chat.ts` (add token retrieval, add Authorization header to fetch calls)
- Reference: `conclave-app/lib/supabase/client.ts` (browser Supabase client for getting session)

**Notes:**
- **Supabase client access pattern:** Call `createClient()` from `conclave-app/lib/supabase/client.ts` once inside the `sendMessage` callback, before the fetch call -- not at the top level of the hook or on every render. This ensures the client is created outside the render cycle. While `@supabase/ssr`'s `createBrowserClient` may internally deduplicate instances, placing the call inside `sendMessage` is the explicit, safe pattern. Do NOT create the client at the module level or in a `useMemo`/`useEffect` -- a fresh call inside `sendMessage` is lightweight and avoids stale references.
- Call `supabase.auth.getSession()` to get the current access token. This reads from local storage and is effectively synchronous.
- The access token is a short-lived JWT (default 1 hour in Supabase). The `@supabase/ssr` middleware in the Next.js app already refreshes it on each page load. But for long-running sessions, the token might expire mid-conversation. Handle 401 responses by calling `supabase.auth.refreshSession()` and retrying once.
- Do NOT pass the token in the request body. Use the standard `Authorization` header. This matches what the agent service auth middleware (Task 4) expects.
- Depends on: Task 4 (agent service expects the token), Task 5 (middleware is wired in).

---

### Task 10: Integration Testing and Verification

**Intent:** Verify the entire Wave 1 pipeline end-to-end: frontend sends authenticated request -> agent service validates JWT -> session created in memory with real userId -> events persisted to Supabase.

**Context:** Each prior task can be unit-tested in isolation, but the real proof is the full flow working together. This task covers manual verification and the creation of automated integration tests that serve as regression checks for future waves.

**Expected behavior:**
- Start all services (`npm run dev:full` from `conclave-app/`)
- Log into the app via the frontend
- Open the agent chat and send a message
- Verify in the agent service logs:
  - No "demo-user" appears; the real user UUID is logged
  - The session is created with the correct `user_id`
  - Events are persisted (no "Failed to persist events" errors)
- Verify in Supabase Studio (or via `psql`):
  - A row exists in `sessions` with the correct `user_id`
  - Rows exist in `session_events` with correct `session_id`, sequential `sequence_number`, and correct `event_type`
  - Sending a second message appends new events with incrementing sequence numbers
- Verify error cases:
  - Removing the `Authorization` header returns 401
  - Using an expired/invalid token returns 401
  - The `/health` endpoint still works without auth

**Key components:**
- Run: Full-stack services (Next.js, Agent Service, Executor API, Supabase)
- Check: Agent service console output
- Check: Supabase `sessions` and `session_events` tables
- Create: `agent-service/src/__tests__/integration/auth.test.ts` (auth middleware tests -- validates JWT acceptance, rejection of invalid/expired tokens, 401 responses)
- Create: `agent-service/src/__tests__/integration/persistence.test.ts` (event persistence tests against local Supabase -- verifies events are written with correct sequence numbers and payloads)

**Notes:**
- Integration tests against Supabase require a running local Supabase instance (`supabase start`). The test setup should check for this and skip gracefully if not available.
- The most critical verification is: after a multi-turn conversation with tool use, the `session_events` table contains the correct sequence of events in the right order, and the payloads are complete (not truncated or malformed).
- Test the auth error path explicitly: send a request with `Authorization: Bearer invalid-token` and confirm 401.
- At least one automated integration test per area (auth and persistence) is required, not optional. Without automated regression tests, Wave 2 developers will break persistence without noticing.
- Depends on: All previous tasks (1-9).

---

## Assumptions Register

> Every assumption in this plan must be listed here with a verdict. Assumptions are validated through source code review, library documentation, or API contract verification -- not taken on faith.

| # | Assumption | Verdict | Evidence |
|:-:|-----------|:-------:|----------|
| A1 | The frontend already has Supabase Auth configured and users have valid JWTs when logged in | **Confirmed** | `conclave-app/lib/supabase/client.ts` creates a browser client with `createBrowserClient()`. `conclave-app/lib/supabase/middleware.ts` calls `supabase.auth.getUser()` to refresh sessions on each request. `conclave-app/lib/supabase/server.ts` provides server-side auth via `createServerClient()`. The full Supabase auth pipeline is operational. |
| A2 | The CORS middleware on the agent service already allows the `Authorization` header | **Confirmed** | `agent-service/src/middleware/cors.ts` line 44-45 sets `Access-Control-Allow-Headers` to `"Content-Type, Accept, Authorization, X-Requested-With"`. The `Authorization` header is explicitly permitted. |
| A3 | The Supabase JWT contains a `sub` claim with the user's UUID that matches `profiles.id` | **Confirmed** | The `handle_new_user()` trigger in `20260110210609_initial_schema.sql` (lines 107-118) creates a profile with `id = NEW.id` where `NEW.id` is `auth.users.id`. Supabase JWTs set `sub` to `auth.users.id` per the JWT claims reference. Therefore `sub` == `profiles.id`. |
| A4 | The agent service can use `@supabase/supabase-js` without `@supabase/ssr` since it is not a Next.js app | **Confirmed** | `conclave-app/lib/supabase/admin.ts` imports `createClient` directly from `@supabase/supabase-js` (not from `@supabase/ssr`) and works correctly for server-side admin operations. The agent service is a plain Express server and does not need cookie-based session management. `@supabase/supabase-js` alone is sufficient. |
| A5 | The `session_events` table with JSONB payload is efficient enough for V1 session sizes (50-100 events per session, up to 50KB per event) | **Plausible** | PostgreSQL JSONB storage and querying at this scale (100 events x 50KB = 5MB per session) is well within PostgreSQL's operational comfort zone. The composite index on `(session_id, sequence_number)` will keep replay queries fast. No load testing has been done, but this is a reasonable assumption for V1 volumes. Would need verification at 1000+ concurrent sessions with heavy flow results. |
| A6 | The `use-agent-chat.ts` hook can access the Supabase browser client to get the access token | **Confirmed** | The hook runs client-side (`"use client"` directive at line 1). `createClient()` from `conclave-app/lib/supabase/client.ts` creates a browser client using `createBrowserClient()` which stores tokens in browser storage. The hook can call `supabase.auth.getSession()` to get the current token. Note: the hook currently has no Supabase import -- this must be added in Task 9. |
| A7 | The agent service currently has no Supabase dependency | **Confirmed** | `agent-service/package.json` lists only `@anthropic-ai/sdk`, `dotenv`, `express`, `uuid`, and `zod` as dependencies. No `@supabase/*` packages are present in either `dependencies` or `devDependencies`. |
| A8 | The `sessionStore.create()` method is the only place where `userId` is set to "demo-user" | **Confirmed with caveats** | The `userId` assignment in `SessionStore.create()` (in `store.ts`) is the only runtime assignment of `"demo-user"`. However, `__tests__/tools.test.ts` independently hardcodes `userId: "demo_user"` (underscore) in a mock session, and the JSDoc comment in `types/index.ts` also references `"demo_user"` (underscore). These test fixtures and comments must also be updated in Task 7. |
| A9 | The `jsonwebtoken` npm package can verify Supabase JWTs using the project's JWT secret | **Wrong (conditionally)** | This assumption holds only if the Supabase project uses the legacy HS256 signing algorithm. Supabase has transitioned to asymmetric signing keys (ES256/RS256) as the default for new projects. The Supabase docs now label HS256 as "Not recommended for production." If this project uses ES256 (likely for projects created in 2025+), `jsonwebtoken.verify(token, HS256_SECRET)` will fail. **Mitigation applied:** Task 4 and TD1 have been updated to use JWKS-based verification with the `jose` library instead. This works with both HS256 and ES256 projects. See [Supabase signing keys docs](https://supabase.com/docs/guides/auth/signing-keys). |
| A10 | Fire-and-forget Supabase writes (not awaiting in request path) will not cause data loss under normal operation | **Plausible** | Under normal operation (no process crashes, no network failures), the Node.js event loop will complete the async Supabase write after the HTTP response is sent. Data loss occurs only if: (a) the process crashes between response and write, (b) the Supabase connection fails, or (c) the write is rejected by a schema/RLS error. Cases (b) and (c) are logged but not surfaced to the user. This is acceptable for V1 but should be monitored. See the known risk note in Feature 3 above. |

**Verdict definitions:**
- **Confirmed** -- Verified in source code, documentation, or by running a test. Include the evidence.
- **Plausible** -- Reasonable based on general knowledge but not verified against this specific codebase. Flag what would need to be checked.
- **Wrong** -- Contradicted by evidence. The plan section that depends on this assumption must be revised.

---

## Appendix

### Technical Decisions

**TD1: JWKS-based JWT verification using `jose` over HS256 `jsonwebtoken` or Supabase `auth.getUser()`.**
The agent service will verify JWT signatures locally using the public key fetched from Supabase's JWKS endpoint (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`) via the `jose` library's `createRemoteJWKSet()` function. Rationale: (1) Supabase has transitioned to asymmetric signing keys (ES256/RS256) as the default, and their docs label HS256 as "Not recommended for production." The `jose` JWKS approach works with both legacy HS256 and modern ES256/RS256 projects without any configuration. (2) Chat requests are latency-sensitive, and the JWKS response is cached locally after the first fetch, so subsequent verifications incur no network latency. (3) No `SUPABASE_JWT_SECRET` environment variable is needed, reducing configuration burden. Trade-off: if a user is deleted or deactivated in Supabase, the agent service will not know until the JWT expires (default 1 hour). This is acceptable for V1. Reference: https://supabase.com/docs/guides/auth/signing-keys

**TD2: Service role key for agent service database writes.**
The agent service uses the Supabase service role key (bypasses RLS) for all database operations. Rationale: the agent service is a trusted backend that already controls what data it writes. Adding RLS-aware user-scoped writes would require passing the user's JWT to the Supabase client per-request, which adds complexity for no security benefit (the agent service already validates auth at the middleware level). RLS policies exist as defense-in-depth for any future direct-access patterns.

**TD3: Append-only event log over state snapshots.**
Session history is stored as an append-only sequence of events rather than periodic state snapshots. Rationale: the event log is simpler to implement, naturally supports rehydration (replay events to rebuild state), and preserves full history for debugging and analytics. Trade-off: rehydrating a long session requires replaying all events, which will be addressed in Wave 2 with the session brief (summary) approach.

**TD4: Fire-and-forget persistence over synchronous writes.**
Supabase writes happen asynchronously and do not block the response to the user. Rationale: users should not wait for database writes during a conversation. The in-memory store is the primary data path. Trade-off: a crash between response and write loses that turn's data. Acceptable for V1; Wave 2 can add write-ahead buffering if needed. Silent write failures (network blip, schema mismatch) are logged but not surfaced to the user -- this is a known risk tracked in the PM Review (Feature 3).

**TD5: New environment variables for the agent service.**
This wave introduces two new required environment variables:
- `SUPABASE_URL` -- The Supabase project URL (same value as `NEXT_PUBLIC_SUPABASE_URL` in the frontend). Also used to construct the JWKS endpoint for JWT verification.
- `SUPABASE_SERVICE_ROLE_KEY` -- The service role key (same value as used by `conclave-app/lib/supabase/admin.ts`)

Note: `SUPABASE_JWT_SECRET` is **not** required. The JWKS-based verification approach (TD1) fetches the public key from the Supabase endpoint automatically.

### Dependencies

| Package | Version | Purpose | Install In |
|---------|---------|---------|------------|
| `@supabase/supabase-js` | ^2.90.1 | Supabase client for DB operations | agent-service |
| `jose` | ^5.0.0 | JWKS-based JWT verification (supports ES256/RS256/HS256, built-in TypeScript types) | agent-service |

### Out of Scope

The following items are explicitly NOT part of Wave 1. They are documented here so that implementing engineers do not accidentally scope-creep.

**Wave 2: Smart Context**
- Session brief (running summary updated after each turn via Haiku-class model)
- Sliding window (keeping last 10-15 messages in API context instead of all messages)
- Recall tool (`recall_context` for searching past events by keyword)
- Rehydration from Supabase (reading events back to rebuild in-memory session)

**Wave 3: Session UI**
- Session conductor prompt (new agent persona for session mode)
- Agent SDK migration (replacing hand-rolled agentic loop)
- Two-panel session UI (workspace + chat layout)
- Session tree component
- Session list page (GET /sessions endpoint)
- ViewHint type system and workspace renderer
- Auto-generating session names from the first message
- Session health indicator (showing whether last event was durably persisted -- addresses fire-and-forget risk from Wave 1)

**Wave 4: Flow Integration**
- Progress streaming during flow execution
- Cancellation support (POST /sessions/:id/cancel)
- Adaptive workspace views (card_grid, tabbed_view, comparison)
- Persistent input bar

**General deferrals:**
- Session sharing or collaboration (multi-user sessions)
- Session branching ("go back to step 3 and try a different approach")
- Cost guardrails per session
- Vector search on session history
- EventSource API migration or auto-reconnection
- Any executor API changes

---

## Post-Review Revisions

| # | Review Finding | Severity | Change Made |
|:-:|---------------|:--------:|-------------|
| 1 | C1: JWT verification approach is outdated -- Supabase has moved to asymmetric signing keys (ES256/RS256). HS256 `jsonwebtoken` approach will fail on modern projects. | CRITICAL | Replaced `jsonwebtoken` + `SUPABASE_JWT_SECRET` approach with JWKS-based verification using `jose` library throughout Task 4, TD1, TD5, Dependencies table, and Task 3 notes. Removed `SUPABASE_JWT_SECRET` from required env vars. Updated A9 verdict from Plausible to Wrong (conditionally). |
| 2 | H1: Existing test expects `"demo_user"` (underscore) but code uses `"demo-user"` (hyphen) -- pre-existing broken test. Also `tools.test.ts` mock uses underscore variant. | HIGH | Added explicit instructions in Task 7 to fix the `demo_user`/`demo-user` discrepancy in `session.test.ts`, `tools.test.ts`, and `types/index.ts` JSDoc. Added `tools.test.ts` to Key components list. |
| 3 | H2: Plan references fragile line numbers (e.g., `store.ts:95`, `types/index.ts` lines 57-104) that will shift with any merge. | HIGH | Replaced line-number-only references with symbolic references (e.g., "the `userId` assignment in `SessionStore.create()`", "the `Session` interface") throughout Tasks 4, 6, 7, and Feature 2. Added notes to Tasks 6 and 7 about preferring symbolic references. |
| 4 | H3: `use-agent-chat.ts` has no Supabase import -- plan did not specify the client access pattern, risking per-render client creation. | HIGH | Added explicit guidance in Task 9 Notes: call `createClient()` once inside the `sendMessage` callback, not at the top level of the hook or per render. Documented rationale. |
| 5 | M1: Plan described middleware order but did not note that `/health` is safe because it is registered before the chat router on its own line. | MEDIUM | Updated Task 5 Context and Notes to explicitly explain that `/health` is safe because it is registered as its own `app.get()` before the chat router, not because of path filtering. |
| 6 | M3: Two `sessionStore.create()` call sites in `routes/chat.ts` (streaming and non-streaming) -- plan only mentioned one. | MEDIUM | Updated Task 7 Expected behavior and Key components to explicitly list both `POST /message` and `POST /message/stream` endpoints. |
| 7 | M4: Changing `session.userId` from `"demo-user"` to UUID will orphan existing disk-based flows at `flows/demo-user/`. | MEDIUM | Added known side effect note to Task 7 Notes documenting that existing POC flows will be orphaned at the old path. |
| 8 | M5 (from Recommended Changes #5): `__tests__/tools.test.ts` omitted from Task 7 file list. | MEDIUM | Added `agent-service/src/__tests__/tools.test.ts` to Task 7 Key components. |
| 9 | M6 (from Recommended Changes #6): Integration tests in Task 10 should be mandatory, not optional. | MEDIUM | Changed "Optionally create" to "Create" for both `auth.test.ts` and `persistence.test.ts` in Task 10 Key components. Added note that at least one automated test per area is required. |
| 10 | PM finding: fire-and-forget persistence risk understated -- silent write failures not surfaced to user. | MEDIUM | Added "Known risk" paragraph to Feature 3 in PM Review. Updated TD4 to reference this risk. Added "Session health indicator" to Wave 3 Out of Scope as a tracked follow-up. |
| 11 | PM finding: no `.env.example` for agent service with the new environment variables. | LOW | Added `.env.example` creation as a Key component in Task 2 with instructions to document all required env vars. |
| 12 | L1: `@supabase/supabase-js@^2.90.1` version -- verify it still resolves. | LOW | No change needed. The `^` range ensures any `2.x` above `2.90.1` will install. Noted as verified. |
| 13 | L2: Task 2 used confusing relative path `conclave-app/../agent-service/package.json`. | LOW | Simplified to `agent-service/package.json` in Task 2 Key components. |
| 14 | L3: `session_events.event_type` CHECK has 8 types but Task 8 only writes 4 -- forward-looking types not annotated. | LOW | Added note to Task 1 instructing implementer to add a SQL comment in the migration identifying which event types are placeholders for future waves. |
| 15 | H2/L4: Use symbolic code references alongside line numbers throughout the plan. | LOW | Added notes to Tasks 6 and 7. Applied symbolic references in Tasks 4, 5, 6, 7, and Feature 2 descriptions. |
| 16 | A8 verdict updated from Confirmed to Confirmed with caveats. | -- | Updated A8 evidence to note `tools.test.ts` mock and `types/index.ts` JSDoc also reference the hardcoded userId. |
| 17 | A6 evidence refined. | -- | Added note that the hook currently has no Supabase import and this must be added in Task 9. |
| 18 | A10 evidence expanded. | -- | Added enumeration of failure modes (process crash, connection failure, schema/RLS error) and cross-reference to Feature 3 known risk note. |
