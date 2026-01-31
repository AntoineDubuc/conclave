# Wave 1: Foundation -- Review

**Reviewed:** 2026-01-31
**Plan:** `wave_1_foundation_plan.md`
**Context:** `architecture_review_and_solutions.md`

---

## Verdict: APPROVE WITH CHANGES

The plan is well-structured, the task ordering is sound, and the core technical approach is correct. However, one assumption about JWT verification is outdated, there are several inaccurate code references, and an existing test-vs-code discrepancy will bite during Task 7. The changes required are localized and do not require restructuring the plan.

---

## PM Review (User Persona)

1. **This wave correctly front-loads the invisible work.** Sessions cannot exist without persistence, auth, and event logging. Deferring any of these to Wave 2 would create a false start. The sequencing is right.

2. **Zero UI changes is fine, but the "proof of life" is weak.** Task 10 (integration testing) is entirely manual verification against logs and Supabase Studio. There is no automated regression check that a future refactor can run. Recommendation: require at least one automated integration test in Task 10 (not "optionally create") -- without it, Wave 2 developers will break persistence without noticing.

3. **The fire-and-forget persistence strategy has a user-visible risk the plan understates.** If the Supabase write fails silently (network blip, schema mismatch, RLS misconfiguration), the user has no indication that their session data was not saved. They will discover the loss only when they try to resume in Wave 3. The plan should mandate a visible log warning during development, and the Wave 3 plan should include a "session health" indicator showing whether the last event was durably persisted. This is not a Wave 1 blocker, but it should be tracked as a known risk.

4. **Task 9 (frontend token passing) is correctly prioritized last before integration testing.** It is the only task that touches the Next.js codebase, minimizing cross-team conflicts.

5. **Missing from this wave: no `.env.example` update for the agent service.** The plan mentions three new environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`) but does not create or update a `.env.example` file in `agent-service/`. Any developer onboarding after Wave 1 will not know these variables exist. Add a subtask to Task 2 or Task 3 to create `agent-service/.env.example` with all required variables documented.

---

## Senior Engineer Review

### CRITICAL

**C1: JWT verification approach is outdated -- Supabase has moved to asymmetric signing keys.**

The plan recommends manual HS256 JWT verification using `jsonwebtoken` and the `SUPABASE_JWT_SECRET` (see Task 4, Technical Decision TD1). This was the standard approach in 2024, but Supabase has since transitioned to asymmetric JWT signing keys (ES256/RS256). The Supabase docs now explicitly label HS256 as "Not recommended for production applications."

Current Supabase projects use ES256 (NIST P-256) by default. The `SUPABASE_JWT_SECRET` still exists for backward compatibility, but:
- New projects may not use HS256 at all.
- Supabase recommends verifying tokens against the JWKS endpoint: `GET https://<project-id>.supabase.co/auth/v1/.well-known/jwks.json`

**Impact:** If the project uses asymmetric keys, `jsonwebtoken.verify(token, HS256_SECRET)` will fail silently or throw a signature mismatch error. Every authenticated request to the agent service will return 401.

**Recommended fix:** Replace the `jsonwebtoken` approach with one of:
- **Option A (Recommended):** Use the `jose` library (already the standard for JWKS-based verification) to fetch and cache the public key from the JWKS endpoint. This is zero-configuration (no `SUPABASE_JWT_SECRET` env var needed) and works with both HS256 legacy and ES256 new projects. Latency concern is moot -- the JWKS response is cached locally after the first fetch.
- **Option B:** Use `supabase.auth.getUser(token)` for V1 (simpler, but adds 50-100ms network latency as the plan already noted).
- **Option C:** Check the project's signing algorithm first. If HS256, the `jsonwebtoken` approach works. If ES256/RS256, use `jose` with JWKS. This is the most defensive approach.

At minimum, Task 4 must be updated to detect the signing algorithm before choosing a verification method. The `jsonwebtoken` dependency may be replaced by `jose`.

**Evidence:** Supabase signing keys documentation (https://supabase.com/docs/guides/auth/signing-keys) states HS256 is "Not recommended for production applications." The JWKS endpoint is the preferred verification path.

---

### HIGH

**H1: Existing test expects `"demo_user"` (underscore) but code uses `"demo-user"` (hyphen) -- this test is already broken.**

The plan references `store.ts:95` with `userId: "demo-user"` (hyphen). This is correct -- the actual code at that line reads:
```typescript
userId: "demo-user", // Hardcoded for POC (hyphen, not underscore - must match validation regex)
```

However, the test at `__tests__/session.test.ts:37-39` asserts:
```typescript
test("creates session with demo_user userId", () => {
  const session = store.create();
  expect(session.userId).toBe("demo_user"); // UNDERSCORE -- does not match code
});
```

And the mock session in `__tests__/tools.test.ts:34` uses `userId: "demo_user"` (underscore).

The comment in `types/index.ts:64` also says `"demo_user"` (underscore).

This means the session test is currently failing or was never run after the hyphen change. Task 7 says to "update test calls" to pass a mock userId, but the implementer will encounter a pre-existing broken test first.

**Recommended fix:** Task 7 should explicitly note this discrepancy and instruct the implementer to fix the test assertion as part of the task. The plan should also note that `tools.test.ts` mock sessions need updating.

**H2: Plan references `store.ts:95` line number and `types/index.ts` lines 57-104 -- these are correct today but fragile.**

Verified: `store.ts:95` is indeed the `userId: "demo-user"` line, and the `Session` interface spans lines 57-104 in `types/index.ts`. However, any merge between now and implementation may shift these lines. The plan should reference the code symbolically (e.g., "the `create()` method in `SessionStore`" or "the `Session` interface") in addition to line numbers.

**H3: `use-agent-chat.ts` has no Supabase import or access pattern -- the plan's approach needs nuance.**

The plan (Task 9) says: "Use `createClient()` from `conclave-app/lib/supabase/client.ts` to get the browser Supabase client."

This is technically correct but has an ergonomic issue. The `use-agent-chat.ts` hook currently imports nothing from Supabase. Adding a `createClient()` call inside the hook means creating a new Supabase client instance on every hook render (since `createBrowserClient()` is called each time `createClient()` is invoked in `client.ts`). While `@supabase/ssr`'s `createBrowserClient` may internally deduplicate, this is not guaranteed.

**Recommended fix:** Pass the Supabase client instance as a parameter to the hook (via options), or use a React context provider for the Supabase client. Alternatively, call `createClient()` once at the top of the `sendMessage` callback, outside the render cycle. The plan should specify which pattern to follow rather than leaving it to the implementer.

---

### MEDIUM

**M1: The `server.ts` middleware ordering does not match the plan's description.**

The plan (Task 5) says: "The Express middleware stack in `server.ts` currently is: CORS -> request logger -> JSON parser -> routes -> error handlers."

Verified. The actual order in `server.ts` is:
1. CORS middleware (`app.use(corsMiddleware)`)
2. Request logger (`app.use(requestLoggerMiddleware)`)
3. JSON parser (`app.use(express.json({ limit: BODY_SIZE_LIMIT }))`)
4. Health check route (`app.get("/health", ...)`)
5. Chat router (`app.use("/api/chat", chatRouter)`)
6. 404 handler
7. Error handler

This matches the plan's description. However, the plan then suggests `app.use("/api/chat", authMiddleware, chatRouter)` as the wiring pattern. This is correct, but the plan fails to note that the `/health` endpoint is defined **before** the chat router on its own `app.get()` line (line 47-49), not as part of a shared router. This means the selective `app.use("/api/chat", ...)` pattern works correctly -- auth will not apply to `/health`. The plan's analysis is correct, but it would help to explicitly confirm that `/health` is safe because it is registered before the chat router, not because of path filtering.

**M2: The plan says to add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `REQUIRED_ENV_VARS` at "line 19" of `index.ts`.**

Verified: Line 19 of `agent-service/src/index.ts` is indeed `const REQUIRED_ENV_VARS = ["ANTHROPIC_API_KEY"];`. The reference is accurate.

**M3: The `chatRouter` in `routes/chat.ts` calls `sessionStore.create(api_keys)` in two places (line 77 and line 154) -- the plan only mentions one.**

The plan (Task 7) says the route handler in `chat.ts` must pass `req.userId` to `sessionStore.create()`. But there are two endpoints that create sessions:
- `POST /api/chat/message` (non-streaming) at line 77: `session = sessionStore.create(api_keys);`
- `POST /api/chat/message/stream` (streaming) at line 154: `session = sessionStore.create(api_keys);`

Both must be updated. The plan should explicitly list both call sites to avoid an implementer missing the non-streaming endpoint.

**M4: The `task.ts` tool uses `session.userId` via the prompt context (`context.user_id`) for disk-based flow storage.**

The `task.ts` tool (line 10) documents that `user_id` comes from `session.userId` via the Flow Architect prompt. When `session.userId` changes from `"demo-user"` to a real UUID, the disk path for flows will change from `flows/demo-user/<slug>` to `flows/<uuid>/<slug>`. Existing flows created during the POC will be orphaned at the old path.

This is not a blocker (POC data is disposable), but the plan should note this as a known side effect of Task 7.

---

### LOW

**L1: The plan says `@supabase/supabase-js@^2.90.1` -- verify this version still resolves.**

The frontend `conclave-app/package.json` uses `"@supabase/supabase-js": "^2.90.1"`. The plan correctly matches this version. As long as the npm registry has not yanked this version, this is fine. Given the `^` range, any `2.x` above `2.90.1` will install.

**L2: The plan's `conclave-app/../agent-service/package.json` path in Task 2 is technically correct but confusing.**

Task 2 references `conclave-app/../agent-service/package.json`. This is a relative path from `conclave-app/` going up one level and into `agent-service/`. While correct, the canonical path is simply `agent-service/package.json`. Minor style issue.

**L3: The `session_events.event_type` CHECK constraint lists 8 types, but the persistence code (Task 8) only writes 4.**

The migration (Task 1) defines: `'user_message','agent_message','tool_use','tool_result','flow_started','flow_completed','user_edit','artifact_created'`. Task 8 only writes `user_message`, `agent_message`, `tool_use`, `tool_result`. The additional types (`flow_started`, `flow_completed`, `user_edit`, `artifact_created`) are forward-looking for Waves 2-4. This is fine -- the CHECK constraint is inclusive, not restrictive. But the plan should note that these additional types are placeholders for future waves.

---

## Assumptions Audit

| # | Assumption | Plan Verdict | Reviewed Verdict | Evidence |
|:-:|-----------|:-------:|:-------:|----------|
| A1 | The frontend already has Supabase Auth configured and users have valid JWTs when logged in | **Confirmed** | **CONFIRMED** | `conclave-app/lib/supabase/client.ts` creates a browser client with `createBrowserClient()`. `conclave-app/lib/supabase/middleware.ts` calls `supabase.auth.getUser()` to refresh sessions on each request. `conclave-app/lib/supabase/server.ts` provides server-side auth via `createServerClient()`. The full Supabase auth pipeline is operational. |
| A2 | The CORS middleware on the agent service already allows the `Authorization` header | **Confirmed** | **CONFIRMED** | `agent-service/src/middleware/cors.ts` line 44-45 sets `Access-Control-Allow-Headers` to `"Content-Type, Accept, Authorization, X-Requested-With"`. The `Authorization` header is explicitly permitted. |
| A3 | The Supabase JWT contains a `sub` claim with the user's UUID that matches `profiles.id` | **Confirmed** | **CONFIRMED** | The `handle_new_user()` trigger in `20260110210609_initial_schema.sql` (lines 107-118) creates a profile with `id = NEW.id` where `NEW.id` is `auth.users.id`. Supabase JWTs set `sub` to `auth.users.id` per the JWT claims reference. Therefore `sub` == `profiles.id`. |
| A4 | The agent service can use `@supabase/supabase-js` without `@supabase/ssr` since it is not a Next.js app | **Confirmed** | **CONFIRMED** | `conclave-app/lib/supabase/admin.ts` imports `createClient` directly from `@supabase/supabase-js` (not from `@supabase/ssr`) and works correctly for server-side admin operations. The agent service is a plain Express server and does not need cookie-based session management. `@supabase/supabase-js` alone is sufficient. |
| A5 | The `session_events` table with JSONB payload is efficient enough for V1 session sizes (50-100 events per session, up to 50KB per event) | **Plausible** | **PLAUSIBLE** | PostgreSQL JSONB storage and querying at this scale (100 events x 50KB = 5MB per session) is well within PostgreSQL's operational comfort zone. The composite index on `(session_id, sequence_number)` will keep replay queries fast. No load testing has been done, but this is a reasonable assumption for V1 volumes. Would need verification at 1000+ concurrent sessions with heavy flow results. |
| A6 | The `use-agent-chat.ts` hook can access the Supabase browser client to get the access token | **Confirmed** | **CONFIRMED** | The hook has `"use client"` at line 1, confirming it runs in the browser. `createClient()` from `conclave-app/lib/supabase/client.ts` uses `createBrowserClient()` which stores tokens in browser storage. The hook can call `supabase.auth.getSession()` to retrieve the current access token. However, the hook currently has no Supabase import -- this must be added (see finding H3). |
| A7 | The agent service currently has no Supabase dependency | **Confirmed** | **CONFIRMED** | `agent-service/package.json` lists only five dependencies: `@anthropic-ai/sdk`, `dotenv`, `express`, `uuid`, and `zod`. No `@supabase/*` packages are present in either `dependencies` or `devDependencies`. |
| A8 | The `sessionStore.create()` method is the only place where `userId` is set to "demo-user" | **Confirmed** | **CONFIRMED WITH CAVEATS** | `store.ts:95` is the only place where `userId` is assigned `"demo-user"`. However, the `tools.test.ts` mock at line 34 independently hardcodes `userId: "demo_user"` (underscore variant) when creating mock sessions. The `task.ts` tool comment (line 10) also references `"demo-user"`. A grep across the agent service confirms no other runtime assignment, but test fixtures and comments must also be updated. The plan acknowledges `__tests__/session.test.ts` but omits `__tests__/tools.test.ts`. |
| A9 | The `jsonwebtoken` npm package can verify Supabase JWTs using the project's JWT secret | **Plausible** | **WRONG (CONDITIONALLY)** | This assumption holds only if the Supabase project uses the legacy HS256 signing algorithm. Supabase has transitioned to asymmetric signing keys (ES256/RS256) as the default for new projects. The Supabase docs now label HS256 as "Not recommended for production." If this project uses ES256 (which is likely for any project created in 2025+), `jsonwebtoken.verify(token, HS256_SECRET)` will fail because the token was signed with a different algorithm. The plan must be updated to handle both signing algorithms, or to use JWKS-based verification with a library like `jose`. See finding C1 for the full analysis and recommended fix. |
| A10 | Fire-and-forget Supabase writes (not awaiting in request path) will not cause data loss under normal operation | **Plausible** | **PLAUSIBLE** | Under normal operation (no process crashes, no network failures), the Node.js event loop will complete the async Supabase write after the HTTP response is sent. The `persistSessionEvents(events).catch(err => console.error(...))` pattern is standard for non-critical async writes. Data loss occurs only if: (a) the process crashes between response and write, (b) the Supabase connection fails, or (c) the write is rejected by a schema/RLS error. Cases (b) and (c) are logged but not surfaced to the user. This is acceptable for V1 but should be monitored. |

---

## Recommended Changes

1. **[CRITICAL] Update Task 4 to handle Supabase's asymmetric JWT signing keys.** Replace the `jsonwebtoken` + `SUPABASE_JWT_SECRET` approach with JWKS-based verification using the `jose` library. Alternatively, detect the project's signing algorithm and branch accordingly. Update the dependency table in the Appendix: replace `jsonwebtoken` / `@types/jsonwebtoken` with `jose` (which has built-in TypeScript types). Remove `SUPABASE_JWT_SECRET` from required environment variables if using JWKS (the public key is fetched from the Supabase endpoint automatically). If the team prefers to keep the HS256 approach for simplicity in local development, add a note in Task 4 requiring verification of the project's signing algorithm before implementation, and document the fallback.

2. **[HIGH] Add explicit instructions in Task 7 to fix the `demo_user` / `demo-user` discrepancy in tests.** The session test at `__tests__/session.test.ts:37-39` expects `"demo_user"` (underscore) while the code uses `"demo-user"` (hyphen). Also update the mock session in `__tests__/tools.test.ts:34` and the JSDoc comment in `types/index.ts:64`. This is a pre-existing bug that will block Task 7 if tests are run.

3. **[HIGH] Specify the Supabase client access pattern for Task 9.** The plan should state whether the `use-agent-chat.ts` hook should (a) accept a Supabase client via the `UseAgentChatOptions` interface, (b) call `createClient()` once inside `sendMessage`, or (c) use a React context. Recommendation: option (b) -- call `createClient()` inside `sendMessage` before the fetch, since the Supabase browser client is lightweight and `@supabase/ssr` handles deduplication internally. But this should be an explicit decision, not left to the implementer.

4. **[MEDIUM] Note both `sessionStore.create()` call sites in Task 7.** The plan mentions updating `routes/chat.ts` but does not specify that there are two endpoints (`POST /message` at line 77 and `POST /message/stream` at line 154) that both call `sessionStore.create()`. Both must pass `req.userId`.

5. **[MEDIUM] Add `__tests__/tools.test.ts` to the list of files modified in Task 7.** The plan lists `__tests__/session.test.ts` but omits `__tests__/tools.test.ts`, which also uses a mock session with the hardcoded `userId`.

6. **[MEDIUM] Make at least one integration test in Task 10 mandatory, not optional.** Change "Optionally create: `agent-service/src/__tests__/integration/auth.test.ts`" to "Create: ...". Without automated integration tests, regressions in the auth or persistence layer will go undetected until Wave 3 manual testing.

7. **[LOW] Add a subtask to create `agent-service/.env.example`** with all required environment variables (`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and -- if kept -- `SUPABASE_JWT_SECRET`). This prevents onboarding friction for any developer joining after Wave 1.

8. **[LOW] Note in Task 7 that existing disk-based flows will be orphaned.** When `session.userId` changes from `"demo-user"` to a real UUID, the `task.ts` tool will create flows under `flows/<uuid>/` instead of `flows/demo-user/`. Existing POC flows at the old path will not be accessible. This is acceptable but should be documented as a known side effect.

9. **[LOW] Annotate the forward-looking `event_type` values in Task 1.** The migration's CHECK constraint includes `flow_started`, `flow_completed`, `user_edit`, and `artifact_created`, but Task 8 only writes four of the eight types. Add a SQL comment in the migration noting which types are reserved for future waves.

10. **[LOW] Use symbolic code references alongside line numbers.** Line numbers shift with any merge. Where the plan says "store.ts:95", also say "the `userId` assignment in `SessionStore.create()`". This makes the plan robust to unrelated changes.

---

## Sources

- [Supabase JWT Signing Keys Documentation](https://supabase.com/docs/guides/auth/signing-keys)
- [Supabase JWT Claims Reference](https://supabase.com/docs/guides/auth/jwt-fields)
- [Supabase JWT Overview](https://supabase.com/docs/guides/auth/jwts)
- [Supabase Discussion: Verifying JWT Myself](https://github.com/orgs/supabase/discussions/20763)
- [Supabase Discussion: Validating JWT Tokens](https://github.com/orgs/supabase/discussions/34196)
