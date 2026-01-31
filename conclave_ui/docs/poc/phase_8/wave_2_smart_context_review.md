# Wave 2: Smart Context -- Review

> **Reviewer:** Claude Opus 4.5 (dual-persona review, 2026-01-31)
>
> **Method:** Read the plan, architecture review, and every source file referenced. Verified each assumption against actual code (line numbers confirmed). Searched Anthropic's current documentation and pricing page for model IDs, pricing, and API features. Traced the SSE streaming path end-to-end through `handler.ts` and `chat.ts`.

---

## Verdict: APPROVE WITH CHANGES

The architecture is well-motivated and the three-component design (sliding window + session brief + recall tool) is a sound approach to context management for long-running sessions. The plan demonstrates genuine understanding of the codebase -- line number references are accurate, the task decomposition is practical, and dependencies are correctly identified. However, the plan contains a critical model ID error, a 4x pricing miscalculation, an overlooked Anthropic SDK feature that directly competes with the manual summarization approach, and several medium-severity gaps that should be resolved before implementation begins.

---

## PM Review (User Persona)

- **The invisible context management promise is credible.** The brief-as-system-prompt design means the user never sees the mechanism. They ask "what did we decide about medication tracking?" and the agent knows, either from the brief or by calling `recall_context`. This is good product design -- the complexity is entirely behind the curtain.

- **Removing the 100-message hard cap fixes a real user-facing bug today.** The current truncation at `store.ts:144-146` can split `tool_use`/`tool_result` pairs mid-conversation, producing a 400 error from the Anthropic API that surfaces to the user as "An error occurred while processing your message" (`handler.ts:349`). Users who run several flows in a single session will eventually hit this. Wave 2 eliminates it.

- **The recall tool name is an engineering abstraction.** A user will never say "recall context." They will say "what did Gemini say about the caregiver persona?" The recall tool works because the *agent* calls it, not the user -- but the tool description must be clear enough that Claude knows when to invoke it versus relying on the brief. The current description (Task 7) is good on this front: it explicitly says "Use this when you need to recall details that aren't in your current context window."

- **Brief staleness during rapid-fire turns is a real concern, but unlikely to bite in practice.** If a user sends 3 messages quickly and each triggers tool-heavy turns (consuming 3-5 messages each for `tool_use`/`tool_result` pairs), the 15-message window could fill faster than expected while the brief lags behind. However, 15 `Message` objects at the `session.messages` level represent 7-8 full turn pairs because tool results are embedded in the assistant `Message` (see handler.ts:291-297). The window is more generous than it appears.

- **Summarization quality is the key product risk.** If Haiku produces a bad summary -- mischaracterizing a decision, omitting a key flow result, or confusing which model said what -- the agent will confidently state something wrong on subsequent turns. The user has no way to know the brief is wrong because they never see it. **Mitigation:** The plan should include a way to surface the brief contents on demand (e.g., a debug/transparency mode in the UI, or a `show_session_brief` command). This is a monitoring concern, not a blocker.

- **Postgres keyword search will return noisy results from JSONB payloads.** When `payload::text` is cast for `to_tsvector`, JSON structure characters (`{`, `}`, `"`, `:`) and keys are included in the tsvector. A query for "medication" could match JSON keys or nested paths. The user asks "what did we decide about medication tracking?" and the agent gets back results polluted with JSON fragments. The agent can probably still produce a good answer, but it wastes tokens and adds latency. **Fix:** Use `jsonb_to_tsvector('english', payload, '["string"]')` (available in Postgres 11+; Supabase uses 15+) to index only string values within the JSON.

---

## Senior Engineer Review

### Issue 1: CRITICAL -- Haiku Model ID Does Not Exist

The plan specifies `SUMMARIZER_MODEL = "claude-haiku-4-20250414"` (Task 4, line 306). **This model ID is fictional.** There is no "claude-haiku-4" in Anthropic's model lineup. The Haiku line went from Claude 3 Haiku to Claude 3.5 Haiku to Claude Haiku 4.5.

**Current Haiku model IDs** (verified from Anthropic's models overview page, 2026-01-31):
- Pinned: `claude-haiku-4-5-20251001`
- Alias: `claude-haiku-4-5`

The plan's self-review (Part 2, Issue 1) already identifies this, proposes `claude-haiku-4-5-20251001`, and correctly recalculates the pricing. This is consistent with what I verified. Use the pinned ID `claude-haiku-4-5-20251001` in production code for deterministic behavior.

**Source:** [Models overview - Claude API Docs](https://platform.claude.com/docs/en/about-claude/models/overview)

### Issue 2: CRITICAL -- Pricing Is 4x Off (Plan Assumed Claude 3 Haiku Pricing)

The plan assumes Haiku pricing of $0.25/MTok input and $1.25/MTok output (assumptions A1, A8). These are the prices for **Claude 3 Haiku** (a legacy model). The current model, Claude Haiku 4.5, costs:

| | Plan Assumed | Actual (Haiku 4.5) | Ratio |
|---|---|---|---|
| Input | $0.25/MTok | $1/MTok | 4x |
| Output | $1.25/MTok | $5/MTok | 4x |

**Recalculated summarization cost per turn** (A8):
- Input: ~1,500 tokens at $1/MTok = $0.0015
- Output: ~200 tokens at $5/MTok = $0.001
- **Total: ~$0.0025 per turn** (not $0.000625)

The plan's conclusion that summarization cost is negligible compared to Sonnet agent calls remains valid -- $0.0025 vs. $0.15-$0.50 per agent turn is still two orders of magnitude cheaper. But the figures must be corrected for transparency.

**Source:** [Anthropic Pricing Page](https://platform.claude.com/docs/en/about-claude/pricing)

### Issue 3: HIGH -- Anthropic SDK Now Has Native Compaction That Directly Overlaps With Manual Summarization

Since the plan was written, Anthropic has shipped **client-side compaction** in both the Python and TypeScript SDKs. This feature is available when using `tool_runner` (beta) and does *exactly* what Wave 2's session brief does:

1. Monitors token usage after each model response
2. When a configurable threshold is exceeded, generates a structured summary
3. Replaces the full conversation history with the summary
4. Continues from the summary

Additionally, the **server-side context editing** beta (`context-management-2025-06-27`) provides:
- `clear_tool_uses_20250919`: Automatically clears oldest tool results when context exceeds a threshold
- `clear_thinking_20251015`: Manages thinking blocks in conversations
- Configurable `trigger`, `keep`, `clear_at_least`, and `exclude_tools` parameters

**This does NOT obsolete Wave 2**, but the plan must address it:

1. The SDK compaction uses `tool_runner`, which the plan explicitly says is out of scope (Wave 3 handles Agent SDK migration). So Wave 2 cannot use compaction directly.
2. However, the `clear_tool_uses_20250919` server-side strategy **can** be used with the existing hand-rolled loop by adding the beta header and `context_management` parameter. This provides a safety net: even if the sliding window logic has a bug, the API will not reject requests due to excessive context.
3. The plan should document this as a known alternative and explain why the manual approach (brief + recall) is still preferred: it preserves *conversational* context (not just tool results), gives the agent a searchable memory via recall, and does not depend on a beta feature.

**Source:** [Context editing - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/context-editing)

### Issue 4: HIGH -- Prompt Caching Should Be Leveraged for System Prompt + Brief

The plan injects the session brief as a system prompt prefix (Task 6). Anthropic's prompt caching can cache the system prompt with a 5-minute or 1-hour TTL:

- **Cache write**: 1.25x base input price (5-min) or 2x (1-hour)
- **Cache hit**: 0.1x base input price

For Sonnet 4 ($3/MTok base), cache hits cost $0.30/MTok -- a 90% reduction. Since the system prompt (base prompt + brief) stays identical across turns within a session, every turn after the first would benefit from cache hits.

The plan does not mention prompt caching at all. For a session with 20+ turns, caching the ~1,600-token system prompt saves ~$0.004 per turn (small per-turn, but compounds). More importantly, cache hits reduce latency, which matters for user-perceived responsiveness.

**Recommendation:** Add a `cache_control` breakpoint at the end of the system prompt. Since the brief updates asynchronously (one turn behind), the system prompt is stable for most consecutive turns, maximizing cache hit rate.

**Source:** [Prompt caching - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)

### Issue 5: HIGH -- Sliding Window Tool-Pair Splitting Is a Phantom Problem at the Message[] Level

The plan (Task 2) describes a complex algorithm to preserve `tool_use`/`tool_result` pairs at the sliding window boundary. The plan's self-review (Issue 3) already identifies this, but I want to verify it independently.

Examining `handler.ts`, here is how messages are stored in `session.messages`:

1. User sends a message -> pushed at line 144 as `{ role: "user", content: message }` (1 `Message` object)
2. Assistant responds with tool calls -> pushed at line 307 as a single `Message` with `tool_calls[]` where each entry has `id`, `name`, `input`, and `result` (1 `Message` object, tool results embedded at line 296)
3. Assistant responds without tool calls -> pushed at line 320 as `{ role: "assistant", content: text }` (1 `Message` object)

The `convertToAPIMessages` function (lines 57-115) then *expands* each assistant `Message` with tool calls into multiple API-level messages:
- One assistant message with `tool_use` content blocks (lines 66-92)
- One user message per `tool_result` (lines 94-109)

**Key insight:** At the `session.messages` level (where the sliding window operates), tool results are embedded within the assistant `Message` object. There are no standalone `tool_result` messages in `session.messages`. A single assistant `Message` with 3 tool calls is one entry in the array. The window selector operates on `Message[]`, then `convertToAPIMessages` runs downstream.

**Therefore:** The complex pair-integrity algorithm in Task 2 is unnecessary. A simple "take last N `Message` objects, ensure the window starts on a user message" is sufficient. The only edge case: the window starts on an assistant message whose preceding user message is outside the window, which could confuse Claude (it sees a response without the question). The fix: expand the window backward by one message to include the user message.

**Recommendation:** Simplify Task 2 significantly. Remove the tool-pair integrity logic. Replace with: "Take last N messages. If the oldest message is an assistant message, include the preceding user message."

### Issue 6: MEDIUM -- Missing GIN Index on session_events Will Cause Sequential Scans

The plan's recall tool SQL (Task 7) uses `to_tsvector('english', payload::text)` in the WHERE clause. Without a GIN index on this expression, Postgres must compute the tsvector for **every row** in `session_events` on every query. The plan correctly notes that the existing `flows` table migration (`20260127100000_create_flows_table.sql:54`) uses a GIN index:

```sql
CREATE INDEX idx_flows_search ON public.flows
  USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
```

But this is on plain text columns, not JSONB. And the plan does not specify creating an equivalent index on `session_events`.

For a session with 500+ events, each query would require a sequential scan with per-row tsvector computation. This would be slow enough to noticeably delay the agent's recall responses.

**Required action:** Add a migration or note in Task 7 to create:

```sql
CREATE INDEX idx_session_events_search ON session_events
  USING gin(jsonb_to_tsvector('english', payload, '["string"]'));
```

Using `jsonb_to_tsvector` (not `to_tsvector` with `::text` cast) for cleaner tokenization.

### Issue 7: MEDIUM -- No Recovery Mechanism When Summarization Fails Multiple Turns

The plan says (Task 5): "if it fails, log the error and continue." This is fire-and-forget with no circuit breaker. If Haiku is rate-limited or down for 5 minutes, the brief falls 5+ turns behind. When service resumes, the next summarization receives only the latest turn's messages plus the stale brief. **Five turns of context are lost from the brief permanently.**

**Scenario:** User runs 3 flows in quick succession. Haiku is rate-limited. Brief does not update for turns 10-14. Turn 15's summarization sees the brief from turn 9 and only the messages from turn 15. Turns 10-14 (which contained 3 flow results) are never captured in the brief.

**Required action:** Track a `lastSummarizedIndex` on the session. On each brief update, pass all messages from `lastSummarizedIndex` to current. If previous summaries failed, the next successful one catches up by summarizing the accumulated gap.

### Issue 8: MEDIUM -- `convertToAPIMessages` Is Not Exported

Assumption A10 correctly identifies that `convertToAPIMessages` (handler.ts:57-115) is a pure function with no side effects. However, the function is declared with `function` keyword at module scope without an `export` keyword. It is module-private.

Task 3 says `buildContextWindow` will call `convertToAPIMessages`, but the function cannot be imported from `handler.ts` without adding `export`. The plan (TD6) says "convertToAPIMessages stays as-is" but does not mention the export requirement.

**Required action:** Add `export` to the function declaration, or extract it to a shared module like `/agent-service/src/context/convert.ts`.

### Issue 9: LOW -- Fire-and-Forget After yield { type: "done" } Works But Is Subtle

The plan (Task 5) proposes launching the summarization promise after `yield { type: "done" }` at `handler.ts:363`. I traced the full code path:

1. `handler.ts:363` -- `yield { type: "done" }` is the generator's last yield
2. `chat.ts:222` -- `for await (const event of handleMessage(...))` consumes the generator
3. `chat.ts:251-253` -- `case "done"` is a no-op (just `break`). Loop continues to `.next()`.
4. On the next `.next()` call, the generator resumes from line 363, executes any code after the yield, then returns `{ done: true }`.
5. `chat.ts:258-259` -- After the loop, the route sends the SSE done event and calls `res.end()` at line 276.

**The fire-and-forget pattern does work.** The summarization promise is launched when the generator resumes after yield, before it returns. The promise runs independently on the Node.js event loop. By the time it resolves, `res.end()` has already been called, but that does not affect the summarization since it writes to `session.brief`, not to the response.

**Subtlety:** If the server receives SIGTERM while a summarization is in-flight, the promise could be orphaned. The graceful shutdown in the agent service has a 10-second timeout. Haiku typically responds in ~500ms, so this is safe for the POC. Worth noting for production hardening.

### Issue 10: LOW -- In-Memory Message Bloat From Tool Results

Assumption A12 estimates 500 messages at ~1-5KB each = ~2.5MB per session. This under-accounts for `tool_calls[].result` (handler.ts:296). A single `test_flow` result contains the full LLM flow output -- easily 50-100KB. A session that runs 10 flows stores ~500KB-1MB just in tool results.

**Revised estimate:** ~5MB per active session with moderate tool usage. With 100 max sessions: ~500MB. Still within Node.js's 1.5GB default heap, but with less margin than claimed.

This is acceptable for the POC but should be flagged for production: after tool results are sent to the API (via `convertToAPIMessages`), consider truncating large `tool_calls[].result` objects and storing a reference to the Supabase event instead.

---

## Assumptions Audit

| # | Assumption | Plan Verdict | Reviewed Verdict | Evidence |
|:-:|-----------|:------------:|:----------------:|----------|
| A1 | Claude Haiku model ID is `claude-haiku-4-20250414` and costs ~$0.25/MTok in, ~$1.25/MTok out | Plausible | **WRONG** | Model ID `claude-haiku-4-20250414` does not exist. Correct: `claude-haiku-4-5-20251001` (pinned) or `claude-haiku-4-5` (alias). Pricing: $1/MTok in, $5/MTok out -- 4x higher than assumed. The plan confused Claude 3 Haiku pricing ($0.25/$1.25) with current Haiku 4.5 pricing. Sources: [Anthropic models page](https://platform.claude.com/docs/en/about-claude/models/overview), [Anthropic pricing page](https://platform.claude.com/docs/en/about-claude/pricing). |
| A2 | SDK supports calling different models from the same process | Confirmed | **Confirmed** | Verified. `handler.ts:44` creates a stateless `Anthropic()` client. Each `messages.create()` call specifies its own `model`. SDK version `^0.50.0` in `package.json:17`. The SDK is a thin `fetch` wrapper with no persistent connections or shared state. |
| A3 | API rejects messages where `tool_result` appears without preceding `tool_use` | Confirmed | **Confirmed, but partially mitigated by new API feature** | The API does reject orphaned `tool_result` blocks with HTTP 400. However, the `context-management-2025-06-27` beta's `clear_tool_uses_20250919` strategy now handles this server-side by automatically clearing old tool results, replacing them with placeholder text. This provides a safety net that did not exist when the plan was written. Source: [Context editing docs](https://platform.claude.com/docs/en/build-with-claude/context-editing). |
| A4 | Postgres `to_tsvector`/`plainto_tsquery` works on JSONB columns cast to text | Plausible | **Confirmed with caveats** | The cast works but produces noisy tsvectors (JSON structure characters included). `jsonb_to_tsvector('english', payload, '["string"]')` (Postgres 11+, Supabase 15+) is cleaner. A GIN index is required for acceptable performance; the plan omits this. The `flows` table at migration `20260127100000_create_flows_table.sql:54` uses a GIN index but on plain text, not JSONB. |
| A5 | Wave 1 creates a `session_events` table with the expected schema | Plausible | **Plausible (unchanged)** | Wave 1 plan (`wave_1_foundation_plan.md`) exists in the directory. Still a dependency. No new evidence to change the verdict. |
| A6 | Async summarization does not block the Express response stream | Confirmed | **Confirmed** | Traced the full path. The `for await` loop in `chat.ts:222` consumes all generator yields. After the `done` event, the generator's `.next()` call resumes execution at `handler.ts:363`, where the fire-and-forget promise is launched. `chat.ts:269-277` has a `finally` block that calls `res.end()`. The async summarization runs independently on the event loop after the response is closed. |
| A7 | Supabase JS client is not a dependency of the agent service | Confirmed | **Confirmed** | `package.json` at `/agent-service/package.json` lists: `@anthropic-ai/sdk`, `express`, `uuid`, `zod`, `dotenv`. No `@supabase/supabase-js`. |
| A8 | Summarization cost is ~$0.001 per turn | Plausible | **WRONG (off by 4x, conclusion still valid)** | At correct Haiku 4.5 pricing: (1,500 * $1 + 200 * $5) / 1,000,000 = $0.0025 per summary. This is 4x the plan's $0.000625 estimate. Still negligible compared to Sonnet agent calls (~$0.15-$0.50/turn). |
| A9 | 15 messages is a sufficient window size | Plausible | **Plausible (unchanged, but reframed)** | At the `Message[]` level, 15 messages is ~7-8 full turn pairs because tool results are embedded in assistant messages. This is more generous than it appears. Cannot validate without real usage data. The value is configurable (`DEFAULT_WINDOW_SIZE`), which is correct. |
| A10 | `convertToAPIMessages` is a pure, reusable function | Confirmed | **Confirmed, but needs export** | Verified at `handler.ts:57-115`. Pure function, no side effects, no closures over module state. However, it lacks an `export` keyword -- it is module-private. Must add `export` or extract to a shared module for reuse in the context module. |
| A11 | Supabase JS client works server-side with `service_role` key | Confirmed | **Confirmed (unchanged)** | Standard pattern. No new evidence needed. |
| A12 | 500+ messages in memory is safe | Plausible | **Plausible, with higher risk than stated** | The 2.5MB estimate under-accounts for `tool_calls[].result`. A single `test_flow` result can be 50-100KB (full LLM output stored at `handler.ts:296`). Revised estimate: ~5MB per active session with moderate tool usage, ~500MB for 100 sessions. Within 1.5GB heap but with less margin. |

---

## Recommended Changes

### Must Fix Before Implementation

1. **Correct the Haiku model ID.** Change `SUMMARIZER_MODEL` from `"claude-haiku-4-20250414"` to `"claude-haiku-4-5-20251001"` in Task 4. Use the pinned ID, not the alias, for production stability.

2. **Correct the pricing figures throughout.** Update A1 and A8 to reflect Haiku 4.5 pricing: $1/MTok input, $5/MTok output. The per-summary cost is ~$0.0025, not ~$0.000625. Update the Executive Summary and Task 4 notes accordingly.

3. **Add a GIN index on `session_events` for full-text search.** Task 7 must include a migration step or explicit note to create a GIN index. Use `jsonb_to_tsvector` instead of `to_tsvector` with `::text` cast:
   ```sql
   CREATE INDEX idx_session_events_search ON session_events
     USING gin(jsonb_to_tsvector('english', payload, '["string"]'));
   ```

4. **Switch the recall tool SQL from `to_tsvector('english', payload::text)` to `jsonb_to_tsvector('english', payload, '["string"]')`** in Task 7. This reduces noise from JSON structure in search results.

5. **Export `convertToAPIMessages`.** Add `export` to the function declaration at `handler.ts:57`, or extract it to `/agent-service/src/context/convert.ts` for import by the context module (Task 3).

### Should Fix Before Implementation

6. **Add brief catch-up mechanism.** Track `lastSummarizedIndex` on the session. When `updateSessionBriefAsync` runs, pass all messages from `lastSummarizedIndex` to current, not just the latest turn. This ensures failed summarizations do not permanently lose context. (Addresses Issue 7.)

7. **Simplify Task 2 (sliding window algorithm).** The tool-pair integrity logic described in the plan is unnecessary because `session.messages` stores tool results embedded in assistant `Message` objects, not as separate messages. Rewrite the algorithm as: "Take last N `Message` objects. If the oldest is an assistant message, expand backward by one to include its preceding user message." Remove steps 2-3 from the current description. (Addresses Issue 5.)

8. **Acknowledge the Anthropic SDK compaction feature and server-side context editing in Technical Decisions.** Add a TD7 that explains:
   - SDK compaction exists but requires `tool_runner` (beta), which is Wave 3 scope
   - Server-side `clear_tool_uses_20250919` could be enabled as defense-in-depth alongside the sliding window
   - The manual brief + recall approach is preferred because it preserves conversational context, not just tool results, and provides searchable long-term memory

9. **Consider leveraging prompt caching for the system prompt + brief.** Add a `cache_control` breakpoint at the end of the system prompt in `buildContextWindow`. Since the brief updates asynchronously (one turn behind), the system prompt is stable for consecutive turns, maximizing cache hit rate. At Sonnet 4 rates, cache hits cost $0.30/MTok (vs. $3/MTok base) -- a 90% reduction on the ~1,600-token system prompt across all turns.

### Can Defer to Later Waves

10. **Tool result memory bloat mitigation.** After tool results are sent to the API via `convertToAPIMessages`, consider truncating large `tool_calls[].result` objects (>10KB) and storing a reference to the Supabase event. This reduces per-session memory from ~5MB to ~1-2MB.

11. **Brief transparency mode.** Add a way for the user (or admin) to inspect the current session brief contents for debugging summarization quality. This could be a `GET /api/session/:id/brief` endpoint or a UI toggle.

12. **Token counting vs. message counting for window size.** The plan correctly defers this to later, but should note that token counting would be more accurate since tool-heavy messages vary widely in size. The Anthropic token counting endpoint supports context management and could be used to tune the window dynamically.

---

## Sources

- [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview)
- [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Context Editing (context-management beta)](https://platform.claude.com/docs/en/build-with-claude/context-editing)
- [Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Introducing Claude Haiku 4.5](https://www.anthropic.com/news/claude-haiku-4-5)
