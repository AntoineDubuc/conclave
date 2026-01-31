# Phase 8: Architecture Review & Solutions

> Senior engineer audit of the existing codebase against Phase 8 requirements, with practical solutions from four personas.

---

## The Review Panel

| Persona | Focus | Question They Always Ask |
|---|---|---|
| **Product Architect** (PA) | User outcomes, system cohesion | "Does the user need this, or do we?" |
| **Pragmatic Engineer** (PE) | Simplest working solution | "What's the least we can build to make this work?" |
| **Frontend Engineer** (FE) | Interaction quality, perceived speed | "How does this feel at 3G? At the 50th message?" |
| **Infra Realist** (IR) | Cost, operability, failure modes | "What happens at 2am when this breaks?" |

---

## Theme 1: Context & Memory

### Problem

The plan says: "Agent service holds the active session in memory for fast context access."

Today's reality (`handler.ts:147`, `store.ts:49`):

- `convertToAPIMessages()` sends the **entire** `session.messages` array to Claude on every turn
- `MAX_MESSAGES_PER_SESSION = 100`, with naive truncation that drops the oldest messages (potentially breaking tool_use/tool_result pairs)
- Tool results are stored as full JSON blobs in session memory (a single `test_flow` result can be 50KB+)
- No Supabase dependency exists in the agent service at all -- `store.ts` is a pure in-memory `Map`
- Frontend keeps its own copy in `localStorage` with no server reconciliation

Phase 8 sessions could run for an hour with 10+ flow executions. At ~4K tokens per flow result, that's 40K+ tokens of context sent every turn. Claude's context window isn't infinite, and the cost per message scales linearly with history size.

### Do We Actually Need Everything in Memory?

**PA:** No. The user doesn't think in terms of "messages 1-100." They think in terms of: "what did we decide about the medication tracking feature?" The agent doesn't need raw message history -- it needs a **working summary** plus the ability to look up specifics on demand.

Think of it like a PM's notebook. You don't re-read every meeting transcript before speaking. You check your notes, and only pull up the transcript if someone challenges a detail.

**PE:** This maps to a known pattern: **sliding window + summarization**. Here's how it works:

1. Keep the last N messages (say, 10-15 turns) in the active context window
2. When older messages fall out of the window, summarize them into a running **session brief** (1-2 paragraphs)
3. Store all raw messages in Supabase `session_events` for replay/audit
4. Give the agent a `recall_context` tool that can search past messages by keyword

The summary happens asynchronously -- after each agent turn, a lightweight call (Haiku-class model) summarizes what just happened into 2-3 sentences and appends to the session brief. Cost: ~$0.001 per summary.

**IR:** The Supabase sync is straightforward. After each event (user message, agent response, flow result), write an event row:

```
session_events: { session_id, sequence, event_type, payload, created_at }
```

On rehydration: query events, replay into session brief + last N messages. This is a read-heavy pattern -- Supabase handles it fine with a simple index on `(session_id, sequence)`.

### Solution

| Component | What to Build | Effort |
|---|---|---|
| **Session Brief** | Running summary updated after each turn via Haiku | Small |
| **Sliding Window** | Keep last 10-15 messages in API context | Small |
| **Event Log** | Write each event to `session_events` table | Small |
| **Rehydration** | On session resume, rebuild brief + recent window from events | Medium |
| **Recall Tool** | `recall_context(query)` -- searches past events, returns relevant snippets | Medium |

**What to delete:** The `MAX_MESSAGES_PER_SESSION = 100` truncation logic. Replace with sliding window.

**What NOT to build:** A vector database for semantic search. Keyword search on `session_events.payload` with Postgres `tsvector` is sufficient for V1. We can upgrade later if users actually need fuzzy recall across hundreds of sessions.

---

## Theme 2: Agent Architecture

### Problem

The plan says: "Stateful agent loop -- the agent is the orchestrator."

Today's reality:

- **No Claude Agent SDK** -- `handler.ts` is a hand-rolled agentic loop using the raw Anthropic SDK. It manually manages stream parsing, tool call accumulation, JSON delta stitching, and the conversation loop. This is ~350 lines of code that the Agent SDK provides out of the box.
- **Wrong persona** -- `flow-architect.ts` says "DO NOT build immediately" and "ask 2-3 questions before proposing." For Sessions, the agent should be a collaborative executor, not a cautious interviewer.
- **Synchronous executor calls** -- `test-flow.ts` makes a blocking HTTP call (up to 120s) to the executor. During this time, the session lock is held and no other messages can be processed. The user sees nothing until the entire flow completes.
- **Lock timeout race** -- Lock timeout is 180s, executor timeout is 120s. If the executor takes 119s, the lock has 61s of headroom. If the user sends two flows in quick succession, the second one gets rejected with "session busy."
- **No cancellation** -- Once a flow starts, there's no way to stop it. The plan mentions `POST /sessions/:id/cancel` but the current executor has no cancel mechanism either.

### Is the Agent SDK Actually Necessary?

**PA:** The question isn't "do we need the SDK" -- it's "do we want to maintain 350 lines of stream parsing code when Anthropic already does it for us?" Every new Anthropic API feature (extended thinking, multi-turn tool use improvements, etc.) requires updating our hand-rolled code. The SDK gets those for free.

**PE:** Agree. The migration is clean:

1. Replace `handleMessage()` with Agent SDK's `agent.run()`
2. Register existing tools (`test_flow`, `show_flow_diagram`, etc.) as SDK tool definitions
3. The SDK handles streaming, tool call parsing, and the agentic loop natively
4. Our handler shrinks from 350 lines to ~50 lines of setup + tool registration

The one thing to watch: the Agent SDK manages its own conversation history. We need to hook into its message lifecycle to write events to Supabase. The SDK provides callbacks for this.

### The Persona Problem

**PA:** Sessions need a completely different agent personality than the flow architect. The flow architect is a consultant: "Let me understand your needs..." The session agent is a collaborator: "Got it, I'll run that now."

Two options:

| Option | Description |
|---|---|
| **A: Swap prompt** | Replace flow-architect prompt with a new session-conductor prompt when in session mode |
| **B: Two agents** | Keep flow-architect for `/flows/new`, create session-conductor for `/sessions` |

**Recommendation: Option B.** The behaviors are different enough that cramming both into one prompt creates confusion. The flow architect is methodical and cautious. The session conductor is responsive and action-oriented. Separate prompts, separate entry points, shared tools.

### Handling Long-Running Flows

**PE:** The blocking executor call is the real problem. Here's the fix:

1. Agent sends `test_flow` tool call
2. Instead of blocking for 120s, **stream progress events back to the frontend immediately**
3. The executor already returns per-phase results. We just need the agent service to forward progress as SSE events while waiting

The pattern:

```
User: "Run 5 personas on this"
Agent: "Running..." → SSE: flow_started
                    → SSE: model_progress (gemini, persona 1/5)
                    → SSE: model_progress (gemini, persona 2/5)
                    ...
                    → SSE: flow_completed (all results)
Agent: "Here's what came back. Gemini's caregiver persona had the strongest insight..."
```

**FE:** From the user's perspective, they need to see progress immediately. Even a spinner with "Running phase 1 of 2..." is dramatically better than 45 seconds of silence. The SSE event types in the plan (`flow_started`, `model_progress`, `flow_completed`) are exactly right.

### Cancellation

**PE:** Two-layer approach:

1. **Frontend** sends `POST /sessions/:id/cancel`
2. **Agent service** sets a `cancelled` flag on the session and aborts the executor HTTP request via `AbortController`
3. **Executor** -- no changes needed. When the HTTP connection drops, it stops processing (it already does this because it streams results back)

If the executor doesn't support connection-drop cancellation, we accept that the LLM calls complete in the background and we just don't store the results. The user's experience is: they clicked cancel, the UI stopped. The $0.03 of wasted API calls is not worth engineering a distributed cancellation protocol.

### Solution

| Component | What to Build | Effort |
|---|---|---|
| **Agent SDK migration** | Replace hand-rolled loop with SDK | Medium |
| **Session conductor prompt** | New system prompt for session mode | Small |
| **Progress streaming** | Forward executor progress as SSE events during tool execution | Medium |
| **Cancellation** | Cancel endpoint + AbortController on executor call | Small |

**What NOT to build:** Distributed cancellation across executor workers. If a flow costs $0.05 to run, eating the cost on cancel is cheaper than engineering two-phase commit for cancellation.

---

## Theme 3: Frontend Communication

### Problem

The plan says: "SSE for streaming, POST for user messages."

Today's reality (`use-agent-chat.ts`):

- **One-shot fetch-based SSE parser** -- Uses `response.body.getReader()` to manually parse SSE. This works but has no reconnection logic, no event IDs, and no heartbeat detection.
- **No view_hint validation** -- The plan introduces `workspace_update` events with a `view_hint` field (e.g., `card_grid`, `tabbed_view`). The frontend currently has no mechanism to receive these or validate them.
- **No error recovery** -- If the SSE connection drops mid-stream, the assistant message stays in a permanent "streaming" state with no way to recover.

### Is Reconnection Actually Needed?

**FE:** For V1, probably not -- but graceful failure handling absolutely is. Here's the practical distinction:

- **Reconnection** = the stream drops, we automatically reconnect and resume. This requires server-side event IDs and replay from last-seen ID. Complex.
- **Graceful failure** = the stream drops, we show "Connection lost. Click to retry." and let the user resend. Simple and honest.

For a session that's actively being used, the user is right there. If something breaks, they'll notice. A clear error state + retry button is better UX than silent auto-reconnection that might replay events or create duplicates.

**PA:** Agreed. Auto-reconnection is a V2 concern. For V1, the requirements are:

1. **Detect connection loss** -- timeout if no event received in 30s during an active stream
2. **Show clear error state** -- "Connection interrupted" with a retry action
3. **Clean up stale state** -- if the assistant message was mid-stream, mark it as incomplete rather than leaving it in a streaming state forever

### The view_hint Contract

**FE:** The `view_hint` is how the agent tells the frontend what to render. This is a typed contract that needs to be defined upfront:

```typescript
type ViewHint =
  | "card_grid"      // Multiple cards (persona results, parallel outputs)
  | "tabbed_view"    // Tabs for switching between outputs
  | "document"       // Single full-width document
  | "comparison"     // Side-by-side comparison
  | "flow_diagram";  // Visual flow representation
```

The frontend needs a registry: `view_hint` -> React component. Unknown view_hints fall back to `document` (safe default -- just render the text).

**PA:** The key insight: the view_hint should be **optional**. If the agent doesn't specify one, the frontend defaults to `document`. This means the agent doesn't need to get it right every time -- it's an enhancement, not a requirement. The user always sees their content.

### Solution

| Component | What to Build | Effort |
|---|---|---|
| **Connection health** | 30s timeout on SSE, error state with retry | Small |
| **Stale message cleanup** | Mark incomplete messages on disconnect | Small |
| **ViewHint type system** | TypeScript enum + component registry + fallback | Small |
| **Workspace renderer** | Switch component that maps view_hint to React components | Medium |

**What NOT to build:** `EventSource` API migration or automatic reconnection with event ID tracking. The current fetch-based approach is fine -- we just need to add timeout detection and error states.

---

## Theme 4: Session Lifecycle

### Problem

The plan describes sessions as persistent, resumable workspaces. Today:

- **30-minute TTL** -- `store.ts` expires sessions after 30 minutes of inactivity. A user who takes a lunch break loses everything.
- **Hardcoded `demo-user`** -- `store.ts:95` hardcodes the userId. Sessions need real user identity for persistence and access control.
- **No session list** -- There's no API to list past sessions or resume one. The plan requires a session tree and the ability to come back to previous work.
- **No naming/goals** -- Sessions have no `name` or `goal` field. The plan's data model has both.

### How Long Should Sessions Live?

**PA:** The answer is: as long as the user finds them useful. Think email drafts -- Gmail doesn't delete your draft after 30 minutes. Sessions are the user's accumulated thinking. Deleting them on a timer is like throwing away someone's notebook.

**PE:** Practically, this means:

- **In-memory TTL stays** -- but it's the cache TTL, not the session lifetime. A session evicted from memory still exists in Supabase.
- **Supabase sessions are permanent** until the user deletes them (or we add a 90-day archive policy later).
- **Rehydration** becomes the normal path for returning to old sessions, not an edge case.

**IR:** Storage cost concern is negligible. A session with 50 events is ~50KB of JSONB in Supabase. A thousand sessions per user is 50MB. Supabase's free tier includes 500MB of database storage. This is a non-issue.

### User Identity

**PE:** The frontend already has Supabase Auth. The agent service needs to:

1. Accept the user's auth token (JWT) in the request headers
2. Validate it against Supabase
3. Use the real `user_id` for session ownership

This is standard middleware -- ~20 lines of code. The session store already has a `userId` field on every session; we just need to populate it from the JWT instead of hardcoding `demo-user`.

### Solution

| Component | What to Build | Effort |
|---|---|---|
| **Session persistence** | Supabase `sessions` table + write on create/update | Small |
| **Session listing** | `GET /sessions` endpoint, returns user's sessions sorted by last activity | Small |
| **Session resume** | `GET /sessions/:id` rehydrates from events if not in memory | Medium |
| **Auth middleware** | Validate Supabase JWT, extract user_id | Small |
| **Session naming** | Agent auto-generates a name from the first message (like ChatGPT does) | Small |

**What NOT to build:** Shared sessions or collaboration features. One user, one session, V1.

---

## Theme 5: Quick Wins & Non-Issues

### Things That Look Like Problems But Aren't

**Single Anthropic client per message** (`handler.ts:44`) -- Creating a new `Anthropic()` client per call is fine. The SDK doesn't maintain persistent connections; it's a thin wrapper around `fetch`. No connection pooling needed.

**Agent model hardcoded in config** -- This is correct for now. The session agent should use our best model. Making it configurable adds complexity without user value.

**Executor doesn't stream** -- The executor returns a complete JSON response. For Phase 8, this is acceptable because individual flow executions are 10-60 seconds. The agent service can send progress events ("Running phase 1...") based on the executor request, then send results when the response arrives. True streaming from the executor is a V2 optimization.

### Actual Quick Wins

| Fix | Where | Why |
|---|---|---|
| Add `name` and `goal` fields to Session type | `types/index.ts` | Required for session list and session tree |
| Add Supabase client to agent service | `package.json` + new `db/` module | Prerequisite for all persistence work |
| Create `sessions` and `session_events` tables | Supabase migration | Prerequisite for event logging |
| Remove `demo-user` hardcode | `store.ts:95` | Replace with auth middleware |
| Add session brief field to Session type | `types/index.ts` | Running summary for context management |

---

## Implementation Sequence

Based on dependencies and user impact:

### Wave 1: Foundation (no visible changes, enables everything else)

1. Supabase tables (`sessions`, `session_events`)
2. Auth middleware on agent service
3. Session persistence (write events to Supabase)
4. Session types update (name, goal, brief)

### Wave 2: Smart Context (makes sessions viable at any length)

5. Sliding window (last 10-15 messages in API context)
6. Session brief (async summarization after each turn)
7. Recall tool (`recall_context` for searching past events)

### Wave 3: Session UI (the user-facing feature)

8. Session conductor prompt (new agent persona)
9. Agent SDK migration (cleaner orchestration)
10. Two-panel session UI (workspace + chat)
11. Session tree component
12. ViewHint system + workspace renderer

### Wave 4: Flow Integration (sessions become powerful)

13. Progress streaming during flow execution
14. Cancellation support
15. Adaptive workspace views (card_grid, comparison, etc.)
16. Persistent input bar

---

## Open Questions for PM

1. **Session sharing** -- Should users be able to share a session (read-only link) with colleagues? This affects the data model but not the core architecture. Recommendation: defer to V2.

2. **Session branching** -- "Go back to step 3 and try a different approach." This is powerful but complex (tree-structured sessions instead of linear). Recommendation: defer to V2, but design the event log to not preclude it (append-only events make branching possible later).

3. **Cost guardrails** -- Should sessions have a spending limit? "Stop if this session exceeds $5." Recommendation: yes, add a `max_cost` field to sessions and check cumulative cost before each flow execution. Simple and prevents surprise bills.
