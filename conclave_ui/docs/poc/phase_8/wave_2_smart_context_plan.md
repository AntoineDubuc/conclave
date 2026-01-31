# Implementation Plan: Wave 2 -- Smart Context (Phase 8: Conclave Sessions)

---

## Executive Summary

Wave 2 replaces the naive message truncation system in the agent service with an intelligent context management layer that makes Conclave Sessions viable at any conversation length. Today, the agent sends the entire `session.messages` array to Claude on every turn (`handler.ts:147`) and blindly drops the oldest messages when the count exceeds 100 (`store.ts:49`). This works for short conversations but breaks fundamentally for sessions -- hour-long workspaces where a user might run 10+ flows, accumulating 40K+ tokens of context. Wave 2 introduces three interlocking components: a **sliding window** that keeps only the last 10-15 messages in the API call, a **session brief** that asynchronously summarizes older turns into a running 1-2 paragraph digest via Claude Haiku 4.5 (`claude-haiku-4-5-20251001`, ~$0.0025 per summary at $1/$5 MTok pricing), and a **recall tool** (`recall_context`) that lets the agent search past session events by keyword using Postgres full-text search. Together, these ensure the agent always knows what happened, never exceeds context limits, and can retrieve specifics on demand -- without sending the entire conversation history on every turn.

> **Note on Anthropic's native context management features:** Anthropic now offers both client-side compaction (via the SDK's `tool_runner` beta) and server-side context editing (`context-management-2025-06-27` beta, including `clear_tool_uses_20250919`). These features overlap with Wave 2's sliding window but do **not** replace it. The SDK compaction requires `tool_runner`, which is Wave 3 scope (Agent SDK migration). The server-side `clear_tool_uses` strategy only manages tool results, not conversational context -- it cannot produce a running summary or provide searchable long-term memory. Wave 2's manual brief + recall approach is preferred for V1 because it preserves full conversational context, gives the agent a searchable memory via the recall tool, and does not depend on beta features. The server-side `clear_tool_uses_20250919` strategy may be enabled as a defense-in-depth measure alongside the sliding window in a future iteration.

**Key Outcomes:**
- Sessions remain coherent and contextually aware regardless of conversation length (50+ turns, 10+ flow runs)
- Per-turn API cost becomes constant (~last 15 messages + brief) instead of growing linearly with session length
- The agent gains a `recall_context` tool to search past events, enabling "what did we decide about X?" queries
- The `MAX_MESSAGES_PER_SESSION = 100` hard cap and its unsafe truncation logic are eliminated

---

## Product Manager Review

### Feature Overview

Wave 2 solves the memory problem that makes long sessions unusable. Without it, sessions either become prohibitively expensive (sending everything to Claude every turn) or lose context (truncating old messages). Smart Context gives the agent a human-like memory: a running summary of what happened, plus the ability to look up specifics when needed.

### Features

#### Feature 1: Sliding Window

**What it is:** Instead of sending the entire conversation history to Claude on every turn, only the last 10-15 messages are included in the API context, along with the session brief as a system prompt prefix.

**Why it matters:** Without this, a 50-message session sends ~50K tokens to Claude on every turn. At $3/MTok input for Sonnet, that is $0.15 per message just for input tokens -- and it gets worse with every turn. The sliding window caps input cost at a fixed amount (~5K tokens for recent messages + ~1K for the brief), regardless of session length.

**User perspective:** Users notice nothing. The conversation feels continuous. The agent still knows what happened 30 messages ago because the brief captures it. The only visible difference: the agent responds slightly faster because it is processing less context.

---

#### Feature 2: Session Brief (Async Summarization)

**What it is:** After every agent turn, a lightweight background call to Claude Haiku summarizes what just happened (the latest exchange) and appends it to a running session brief -- a 1-2 paragraph digest of the entire session so far. This brief is injected as a system prompt prefix on every subsequent turn.

**Why it matters:** This is what makes the sliding window safe. Without the brief, dropping old messages means the agent literally forgets what happened. The brief preserves the narrative -- decisions made, flow results, user preferences -- in compressed form. It is the agent's working notes.

**User perspective:** Invisible. The user says "remember when we talked about medication tracking?" and the agent knows, because the brief captured that discussion. If the brief is insufficient, the agent can use `recall_context` to look up the exact exchange.

---

#### Feature 3: Recall Tool (`recall_context`)

**What it is:** A new agent tool that searches the `session_events` table in Supabase using Postgres full-text search. The agent can call it with a keyword query (e.g., "medication tracking") and get back the relevant session events -- messages, flow results, or agent notes that match.

**Why it matters:** The brief is a summary; it cannot preserve every detail. When the agent needs to reference a specific flow result from 30 turns ago, or quote something the user said earlier, it needs to retrieve the raw data. The recall tool bridges the gap between the compressed brief and the full event log.

**User perspective:** The user says "what exactly did Gemini say about the caregiver persona?" The agent calls `recall_context`, finds the relevant flow result, and quotes it directly. From the user's perspective, the agent has perfect memory. In reality, it is doing a database lookup -- but the user never sees the mechanism.

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
>    - Check the checkbox `[x]` → Save
>    - Write start time → Save
>    - Complete the implementation work
>    - Write end time → Save
>    - Calculate and write total time → Save
>    - Write human time estimate → Save
>    - Calculate and write multiplier → Save
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
| [ ] | 1 | Add `brief` field to Session type and context types | | | | | |
| [ ] | 2 | Build the sliding window message selector | | | | | |
| [ ] | 3 | Integrate sliding window into `convertToAPIMessages` | | | | | |
| [ ] | 4 | Build the session brief summarizer service | | | | | |
| [ ] | 5 | Integrate async brief update into the agentic loop | | | | | |
| [ ] | 6 | Inject session brief into system prompt | | | | | |
| [ ] | 7 | Build `recall_context` tool (Supabase full-text search) | | | | | |
| [ ] | 8 | Register `recall_context` in tool index | | | | | |
| [ ] | 9 | Remove `MAX_MESSAGES_PER_SESSION` truncation logic | | | | | |
| [ ] | 10 | Write unit tests for sliding window edge cases | | | | | |
| [ ] | 11 | Write unit tests for brief summarizer | | | | | |
| [ ] | 12 | Write integration test for recall tool | | | | | |
| [ ] | 13 | End-to-end validation: long session simulation | | | | | |

**Summary:**
- Total tasks: 13
- Completed: 0
- Total time spent: 0 minutes
- Total human estimate: 0 minutes
- Overall multiplier: --

---

## Task Descriptions

This section provides context for each task. Read the relevant description before starting implementation.

---

### Task 1: Add `brief` field to Session type and context types

**Intent:** Extend the Session type and introduce supporting types that Wave 2 components will depend on. This is the foundation -- every other task references these types.

**Context:** The current `Session` interface in `types/index.ts` has no concept of a brief or context window. Wave 2 needs: (a) a `brief` field on Session to store the running summary, (b) a `ContextWindow` type to represent what gets sent to the API, and (c) a `SessionEvent` type that matches what Wave 1 writes to Supabase. This task must be completed first because Tasks 2-8 all import from these types.

**Expected behavior:** After this task, the following types exist:

```typescript
// In types/index.ts

/**
 * Running summary of the session, updated after each agent turn.
 * Injected as a system prompt prefix on every API call.
 */
export interface SessionBrief {
  /** The summary text (1-2 paragraphs) */
  content: string;
  /** How many turns this brief covers */
  turnsCovered: number;
  /** When the brief was last updated */
  lastUpdatedAt: Date;
}

/**
 * Extended Session interface with Wave 2 fields
 */
export interface Session {
  // ... existing fields ...
  /** Running session summary for context management */
  brief?: SessionBrief;
  /** Index into session.messages up to which the brief has been summarized.
   *  Used for catch-up after failed summarizations (see Task 5). */
  lastSummarizedIndex?: number;
  /** Session name (auto-generated from first message) */
  name?: string;
  /** User-stated goal for the session */
  goal?: string;
}

/**
 * What gets sent to the Claude API on each turn.
 * Sliding window (recent messages) + brief (system prompt prefix).
 */
export interface ContextWindow {
  /** System prompt with brief prepended */
  systemPrompt: string;
  /** Recent messages within the sliding window */
  messages: MessageParam[];
  /** Number of messages outside the window (summarized in brief) */
  summarizedCount: number;
}

/**
 * A session event stored in Supabase (from Wave 1).
 * Used by recall_context for searching.
 */
export type SessionEventType =
  | "user_message"
  | "agent_message"
  | "flow_started"
  | "flow_completed"
  | "user_edit"
  | "artifact_created"
  | "brief_updated";

export interface SessionEvent {
  id: string;
  sessionId: string;
  eventType: SessionEventType;
  payload: Record<string, unknown>;
  sequence: number;
  createdAt: Date;
}
```

**Key components:**
- `/agent-service/src/types/index.ts` -- Add `SessionBrief`, `ContextWindow`, `SessionEvent` types; extend `Session`

**Notes:** The `name` and `goal` fields were already called out in the architecture review as quick wins. Adding them here since we are touching the type anyway. The `SessionEvent` type mirrors what Wave 1 writes to the `session_events` table.

---

### Task 2: Build the sliding window message selector

**Intent:** Create a pure function that takes the full message array and returns only the messages that belong in the API context window, respecting tool_use/tool_result pair integrity.

**Context:** The sliding window operates on `session.messages`, which is a `Message[]` array. Importantly, tool results are embedded within the assistant `Message` object (at `handler.ts:291-297` -- each tool call's `result` is stored on the `Message.tool_calls[].result` field), **not** as separate messages. The expansion into separate `tool_use`/`tool_result` API-level messages happens downstream in `convertToAPIMessages`. This means a single assistant `Message` with 3 tool calls is one entry in the array, and tool-pair splitting is a non-issue at the `Message[]` level.

The only edge case to handle: the window starts on an assistant message whose preceding user message is outside the window, which would confuse Claude (it sees a response without the question). The algorithm must ensure the window always starts on a user message.

**Expected behavior:** Given `session.messages` and a `windowSize` (default 15), return the subset of messages that should be included in the next API call. The function:
1. Takes the last `windowSize` messages as the starting set
2. If the oldest message in the window is an assistant message, expands the window backward by one to include the preceding user message
3. Returns the selected messages in order

```typescript
// New file: /agent-service/src/context/sliding-window.ts

/**
 * Default number of recent messages to keep in the API context window.
 * This includes both user and assistant messages.
 * 15 messages ≈ 5-7 complete turn pairs + tool interactions.
 */
export const DEFAULT_WINDOW_SIZE = 15;

/**
 * Select messages for the API context window.
 * Ensures tool_use/tool_result pairs are never split.
 *
 * @param messages Full session message history
 * @param windowSize Max messages to include (default 15)
 * @returns Messages to include in the API call
 */
export function selectWindowMessages(
  messages: Message[],
  windowSize: number = DEFAULT_WINDOW_SIZE
): { windowed: Message[]; summarizedCount: number } {
  // Implementation: take last N, then expand to preserve tool pairs
}
```

**Key components:**
- `/agent-service/src/context/sliding-window.ts` (new file)

**Notes:** Since tool results are embedded in assistant `Message` objects at the `session.messages` level, the tool-pair splitting risk exists only at the `MessageParam[]` level (after `convertToAPIMessages` runs). The sliding window operates upstream on `Message[]`, so a simple "take last N, ensure it starts on a user message" is sufficient. The `convertToAPIMessages` function (handler.ts:94-109) handles the expansion of embedded tool results into separate API-level `tool_use`/`tool_result` pairs downstream.

---

### Task 3: Integrate sliding window into `convertToAPIMessages`

**Intent:** Replace the current behavior of `convertToAPIMessages` (which converts ALL messages) with a version that first applies the sliding window, then converts only the windowed messages to API format.

**Context:** Today, `handler.ts:147` calls `convertToAPIMessages(session.messages)` -- passing every message in the session. After this task, it should call through a new `buildContextWindow()` function that applies the sliding window first, then converts. The function also prepends the session brief to the system prompt (wired up in Task 6).

**Expected behavior:** The call site in `handleMessage` changes from:

```typescript
// Before (handler.ts:147)
let conversationHistory = convertToAPIMessages(session.messages);
```

To:

```typescript
// After
const contextWindow = buildContextWindow(session, systemPrompt);
// contextWindow.systemPrompt includes the brief prefix
// contextWindow.messages is only the windowed messages, converted to API format
```

The `buildContextWindow` function lives in a new module:

```typescript
// /agent-service/src/context/index.ts

export function buildContextWindow(
  session: Session,
  baseSystemPrompt: string,
  windowSize?: number
): ContextWindow {
  const { windowed, summarizedCount } = selectWindowMessages(
    session.messages,
    windowSize
  );
  const apiMessages = convertToAPIMessages(windowed);
  const systemPrompt = prependBrief(baseSystemPrompt, session.brief);

  return { systemPrompt, messages: apiMessages, summarizedCount };
}
```

**Key components:**
- `/agent-service/src/context/index.ts` (new file -- context module entry point)
- `/agent-service/src/agent/handler.ts` -- Update `handleMessage` to use `buildContextWindow`

**Notes:** The `convertToAPIMessages` function itself does not change. It still converts an array of `Message` objects to `MessageParam[]`. The only difference is that it now receives a smaller array. **Important:** `convertToAPIMessages` is currently module-private in `handler.ts:57` (no `export` keyword). To reuse it in the context module, add `export` to the function declaration, or extract it to a shared module such as `/agent-service/src/context/convert.ts`. Also, `conversationHistory` is reassigned at line 310 inside the agentic loop (after tool results are added). That reassignment must also use `buildContextWindow` so subsequent loop iterations respect the window.

---

### Task 4: Build the session brief summarizer service

**Intent:** Create a service that calls Claude Haiku to generate a concise summary of the latest exchange and merge it with the existing session brief.

**Context:** After every agent turn, we need to summarize what just happened (the user's message + the agent's response + any tool results) and fold it into the running brief. This is an asynchronous operation -- it should not block the user's ability to send their next message. The summarizer uses Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) -- at $1/MTok input and $5/MTok output, each summary costs ~$0.0025, which is still two orders of magnitude cheaper than a Sonnet agent call.

**Expected behavior:**

```typescript
// New file: /agent-service/src/context/brief-summarizer.ts

import Anthropic from "@anthropic-ai/sdk";

/**
 * Model used for summarization. Haiku-class: fast, cheap, sufficient for summaries.
 */
export const SUMMARIZER_MODEL = "claude-haiku-4-5-20251001";

/**
 * Max tokens for the summary response. Summaries should be 2-3 sentences.
 */
export const SUMMARIZER_MAX_TOKENS = 512;

/**
 * Summarize the latest turn and merge into the session brief.
 *
 * @param existingBrief Current session brief (empty string if first turn)
 * @param latestMessages The messages from the most recent turn (user + assistant + tools)
 * @param sessionGoal Optional session goal for better summarization
 * @returns Updated brief content
 */
export async function updateSessionBrief(
  existingBrief: string,
  latestMessages: Message[],
  sessionGoal?: string
): Promise<string> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const prompt = buildSummarizerPrompt(existingBrief, latestMessages, sessionGoal);

  const response = await client.messages.create({
    model: SUMMARIZER_MODEL,
    max_tokens: SUMMARIZER_MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  // Extract text from response
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return text;
}
```

The summarizer prompt instructs Haiku to:
1. Read the existing brief (if any)
2. Read the latest exchange
3. Produce an updated brief that integrates the new information
4. Keep the total brief under 300 words
5. Prioritize: decisions made, flow results (key findings only), user preferences, open questions

**Key components:**
- `/agent-service/src/context/brief-summarizer.ts` (new file)

**Notes:** The same `Anthropic` client constructor is used as in `handler.ts:44`. Creating a new client per call is fine -- the SDK is a thin fetch wrapper with no persistent connections. The model ID `claude-haiku-4-5-20251001` is the pinned version of Claude Haiku 4.5; use the pinned ID (not the `claude-haiku-4-5` alias) for deterministic behavior in production. The summarizer prompt must handle the first turn (no existing brief) gracefully by generating an initial brief from scratch. Tool results should be compressed in the prompt -- do not include full flow output JSON, just a summary of what tool was called and the key outcome.

---

### Task 5: Integrate async brief update into the agentic loop

**Intent:** After the agentic loop in `handleMessage` completes (agent has responded, all tool calls resolved), trigger the brief summarizer asynchronously without blocking the response stream.

**Context:** The brief update must not delay the user's next interaction. The pattern: after yielding the `done` event at `handler.ts:363`, fire the summarizer as a fire-and-forget promise. If it fails, log the error and continue -- the session is not broken, just the brief is stale (it will catch up on the next successful summarization).

**Expected behavior:**

```typescript
// In handler.ts, after the agentic loop completes:

// Emit done event
yield { type: "done" };

// Async brief update (fire-and-forget with catch-up)
// Uses lastSummarizedIndex to recover from failed summarizations
const unsummarizedMessages = session.messages.slice(session.lastSummarizedIndex ?? 0);
updateSessionBriefAsync(session, unsummarizedMessages).catch((err) => {
  console.error(`[BRIEF_UPDATE_FAILED] Session ${session.id}:`, err);
  // lastSummarizedIndex is NOT advanced on failure -- next successful
  // summarization will catch up by processing the accumulated gap
});
```

Where `updateSessionBriefAsync` is:

```typescript
async function updateSessionBriefAsync(
  session: Session,
  unsummarizedMessages: Message[]
): Promise<void> {
  const updatedContent = await updateSessionBrief(
    session.brief?.content || "",
    unsummarizedMessages,
    session.goal
  );

  session.brief = {
    content: updatedContent,
    turnsCovered: (session.brief?.turnsCovered || 0) + 1,
    lastUpdatedAt: new Date(),
  };

  // Advance the index so the next summarization only processes new messages.
  // This is only updated on success -- if this call had failed, the next
  // successful call will catch up by processing the accumulated gap.
  session.lastSummarizedIndex = session.messages.length;

  // If Wave 1 Supabase sync is available, write the brief_updated event
  // await writeSessionEvent(session.id, "brief_updated", { content: updatedContent });
}
```

**Key components:**
- `/agent-service/src/agent/handler.ts` -- Add async brief trigger after the agentic loop
- `/agent-service/src/context/brief-summarizer.ts` -- Called by the handler

**Notes:** A critical race condition to consider: the user sends a new message while the brief is still being generated. This is safe because: (a) the brief update writes to `session.brief` which is separate from `session.messages`, (b) the new message's `buildContextWindow` will use whatever brief exists at that moment (possibly one turn stale), and (c) the brief will catch up on the next turn. The brief is always best-effort, never a blocking dependency.

**Catch-up mechanism:** Instead of tracking `turnStartIndex` (which would only summarize the latest turn), we track `lastSummarizedIndex` on the session. On each brief update, we pass all messages from `lastSummarizedIndex` to the current end of the array. If previous summarizations failed, the accumulated gap is processed on the next successful call. The `lastSummarizedIndex` is only advanced on success, ensuring no turns are permanently lost from the brief. This addresses the scenario where Haiku is rate-limited or down for several turns -- when service resumes, the next summarization catches up by processing all missed turns at once.

---

### Task 6: Inject session brief into system prompt

**Intent:** When building the context window, prepend the session brief to the base system prompt so Claude always has the session summary available.

**Context:** The brief is most useful as part of the system prompt because it provides session-level context that frames every user message. Claude reads the system prompt first, so the brief acts as "here's what you need to know about this ongoing session" before processing the latest messages.

**Expected behavior:**

```typescript
// In /agent-service/src/context/index.ts

/**
 * Prepend the session brief to the base system prompt.
 * If no brief exists (first turn), return the base prompt unchanged.
 */
export function prependBrief(
  baseSystemPrompt: string,
  brief?: SessionBrief
): string {
  if (!brief || !brief.content) {
    return baseSystemPrompt;
  }

  return `## Session Context

The following is a running summary of this session so far. Use this to understand the context of the conversation without needing the full history. If you need specific details about past events, use the recall_context tool.

${brief.content}

---

${baseSystemPrompt}`;
}
```

The brief is placed before the main system prompt so it reads as context, not instructions. The separator makes it clear where the brief ends and the agent's core instructions begin. The nudge about `recall_context` teaches the agent to use the tool when the brief is insufficient.

**Key components:**
- `/agent-service/src/context/index.ts` -- `prependBrief` function

**Notes:** The system prompt with brief should not exceed ~2000 tokens. The summarizer (Task 4) is instructed to keep the brief under 300 words (~400 tokens). The base Flow Architect prompt is ~1200 tokens. Combined, this stays well within limits. If the brief grows unexpectedly large, consider adding a token count check and re-summarizing (compressing the brief itself). This is an edge case that can be deferred.

**Prompt caching recommendation:** The system prompt (base prompt + brief) should leverage Anthropic's prompt caching by adding a `cache_control` breakpoint at the end of the system prompt in `buildContextWindow`. Since the brief updates asynchronously (one turn behind per TD2), the system prompt is stable across consecutive turns, maximizing cache hit rate. At Sonnet 4 rates ($3/MTok base), cache hits cost $0.30/MTok -- a 90% reduction on the ~1,600-token system prompt. Cache write costs 1.25x base (5-minute TTL) or 2x (1-hour TTL). For sessions with 20+ turns, this compounds into meaningful savings and, more importantly, reduces latency on cache-hit turns.

---

### Task 7: Build `recall_context` tool (Supabase full-text search)

**Intent:** Create a new agent tool that searches the `session_events` table in Supabase for events matching a keyword query, and returns the relevant events formatted for Claude to reason about.

**Context:** This is the agent's "long-term memory" -- when the brief is not detailed enough and the sliding window does not contain the relevant messages, the agent can actively search the event log. The search uses Postgres full-text search (`tsvector`/`tsquery`) on the `payload` column of `session_events`, which is a JSONB column containing the event data. This requires Wave 1's `session_events` table to exist and be populated.

**Expected behavior:**

```typescript
// New file: /agent-service/src/tools/recall-context.ts

export const recallContextSchema = {
  name: "recall_context",
  description:
    "Search past session events for specific information. Use this when you need to " +
    "recall details that aren't in your current context window -- for example, a specific " +
    "flow result, something the user said earlier, or a decision that was made. " +
    "Returns matching events ordered by relevance.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description:
          "Search query. Use specific keywords related to what you're looking for. " +
          "Examples: 'medication tracking', 'gemini persona results', 'cost estimate'",
      },
      event_types: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional filter by event type. Options: user_message, agent_message, " +
          "flow_started, flow_completed, artifact_created. Omit to search all types.",
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return. Default: 5, Max: 20.",
      },
    },
    required: ["query"],
  },
};
```

The tool implementation:
1. Takes the `query` string and constructs a Postgres `tsquery`
2. Searches `session_events` where `session_id` matches the current session
3. Ranks results using `ts_rank` on the payload text
4. Returns the top N results, formatted as a readable summary for Claude

**GIN index (required for performance):** Before the recall tool can be used efficiently, a GIN index must be created on the `session_events` table. Without it, Postgres must compute the tsvector for every row on every query, causing sequential scans that are slow for sessions with 500+ events. Add this migration alongside the `session_events` table creation (Wave 1) or as a separate migration in Wave 2:

```sql
CREATE INDEX idx_session_events_search ON session_events
  USING gin(jsonb_to_tsvector('english', payload, '["string"]'));
```

**Note:** We use `jsonb_to_tsvector('english', payload, '["string"]')` instead of `to_tsvector('english', payload::text)`. The `::text` cast produces noisy tsvectors because JSON structure characters (`{`, `}`, `"`, `:`) and keys are included. `jsonb_to_tsvector` with the `'["string"]'` filter indexes only string values within the JSON, which produces cleaner search results. This is available in Postgres 11+ (Supabase uses 15+).

The search SQL looks like:

```sql
SELECT id, event_type, payload, sequence, created_at,
       ts_rank(
         jsonb_to_tsvector('english', payload, '["string"]'),
         plainto_tsquery('english', $1)
       ) as rank
FROM session_events
WHERE session_id = $2
  AND jsonb_to_tsvector('english', payload, '["string"]') @@ plainto_tsquery('english', $1)
  AND ($3::text[] IS NULL OR event_type = ANY($3))
ORDER BY rank DESC, sequence DESC
LIMIT $4;
```

**Key components:**
- `/agent-service/src/tools/recall-context.ts` (new file)
- `/agent-service/src/db/supabase.ts` -- Supabase client (should exist from Wave 1; if not, create a minimal client)

**Notes:** This task has a hard dependency on Wave 1: the `session_events` table must exist and be populated with events. If Wave 1 is not yet complete, this tool can be implemented with a stub that returns "No events found -- session event recording not yet available." and wired up later. The `jsonb_to_tsvector` function with `'["string"]'` filter indexes only string values within the JSONB payload, producing cleaner search results than the `payload::text` cast (which includes JSON syntax noise). A dedicated `search_text` column with a generated tsvector index would be a further optimization but is not necessary for V1. Also note: `plainto_tsquery` is used instead of `to_tsquery` because it handles natural language input without requiring boolean syntax from the user. The `export` keyword search fix: `plainto_tsquery` correctly handles single keywords like "export" or "medication" without requiring special syntax.

---

### Task 8: Register `recall_context` in tool index

**Intent:** Register the new `recall_context` tool in the tool index so it becomes available to the agent during conversations.

**Context:** The tool registration pattern is established in `/agent-service/src/tools/index.ts`. Each tool is imported, then added to the `tools` array. The schemas are automatically extracted and passed to the Anthropic API via `getToolSchemas()`.

**Expected behavior:**

```typescript
// In /agent-service/src/tools/index.ts

// Add import
export {
  recallContext,
  recallContextSchema,
  recallContextTool,
} from "./recall-context.js";

import { recallContextTool } from "./recall-context.js";

// Add to tools array
export const tools: Tool[] = [
  listModelsTool as unknown as Tool,
  showDiagramTool as unknown as Tool,
  estimateCostTool as unknown as Tool,
  testFlowTool as unknown as Tool,
  taskTool as unknown as Tool,
  recallContextTool as unknown as Tool,  // Wave 2: Smart Context
];
```

After registration, the agent will see `recall_context` in its available tools and can call it naturally during conversation.

**Key components:**
- `/agent-service/src/tools/index.ts` -- Add import and registration
- `/agent-service/src/tools/recall-context.ts` -- Must export `recallContextTool` in the expected format

**Notes:** The tool must follow the same interface pattern as existing tools: `{ name, schema, execute }` where `execute` takes `(input, session)`. The `session` parameter gives the tool access to `session.id` for scoping the search to the current session.

---

### Task 9: Remove `MAX_MESSAGES_PER_SESSION` truncation logic

**Intent:** Remove the naive 100-message truncation logic from `SessionStore.update()` and replace it with reliance on the sliding window.

**Context:** The current truncation in `store.ts:144-150` drops the oldest messages with `session.messages.slice(overflow)`. This is dangerous because it can split tool_use/tool_result pairs (causing API errors) and silently destroys context with no summarization. With the sliding window in place, messages can accumulate indefinitely in `session.messages` -- only the last N are sent to the API, and old ones are preserved for the recall tool.

**Expected behavior:** Remove from `store.ts`:
- The `MAX_MESSAGES_PER_SESSION = 100` constant (line 49)
- The `MESSAGE_COUNT_WARNING_THRESHOLD = 80` constant (line 54)
- The warning log in `update()` (lines 134-141)
- The truncation slice in `update()` (lines 144-150)

Replace with a much higher soft limit for memory safety (e.g., 1000 messages before a warning log, no truncation). Sessions that reach this length are effectively unbounded -- the sliding window ensures API calls remain cheap regardless.

```typescript
// After: store.ts update() method
update(id: string, messages: Message[]): void {
  const session = this.sessions.get(id);
  if (!session) return;

  session.messages.push(...messages);

  // Soft warning for extremely long sessions (memory monitoring only)
  if (session.messages.length > 1000 && session.messages.length % 100 === 0) {
    console.warn(
      `Session ${id} has ${session.messages.length} messages in memory. ` +
      `Consider session rehydration from Supabase for memory efficiency.`
    );
  }

  session.lastActivityAt = new Date();
}
```

**Key components:**
- `/agent-service/src/session/store.ts` -- Remove truncation logic, add soft warning

**Notes:** The in-memory message array is still useful even though old messages are not sent to the API. The recall tool (Task 7) primarily queries Supabase, but having messages in memory enables future optimizations (e.g., in-memory keyword search before hitting the database). For memory efficiency in production, a future wave could implement message eviction from memory with on-demand rehydration from Supabase.

---

### Task 10: Write unit tests for sliding window edge cases

**Intent:** Verify that the sliding window correctly handles all edge cases, especially tool_use/tool_result pair integrity.

**Context:** The sliding window is the most algorithmically subtle part of Wave 2. If it splits a tool pair, the Claude API returns a 400 error. If it includes too many messages, we lose the cost benefit. Tests must cover both correctness and boundary conditions.

**Expected behavior:** Test cases:

```typescript
// /agent-service/src/__tests__/context/sliding-window.test.ts

describe("selectWindowMessages", () => {
  it("returns all messages when count <= windowSize");
  it("returns last N messages for simple conversation");
  it("preserves tool_use + tool_result pair when boundary falls between them");
  it("preserves multi-tool-call assistant message with all its results");
  it("handles window of size 1 (always includes at least last user message)");
  it("handles empty message array");
  it("returns correct summarizedCount");
  it("handles conversation that starts with assistant message (edge case)");
  it("preserves consecutive tool_use/tool_result pairs from agentic loop");
});
```

The critical test: create a message array where message[N-1] is an assistant message with `tool_calls`, and messages[N] and [N+1] are user messages with `tool_result`. Set window size so the boundary would normally fall at message[N]. Verify that the window expands backward to include message[N-1].

**Key components:**
- `/agent-service/src/__tests__/context/sliding-window.test.ts` (new file)

**Notes:** Use the existing Vitest setup from `package.json`. Mock message data should mirror the structure produced by `handleMessage` -- pay attention to the `tool_calls` field format on assistant messages and the `tool_result` content block format on user messages.

---

### Task 11: Write unit tests for brief summarizer

**Intent:** Verify that the brief summarizer correctly formats prompts, handles edge cases, and gracefully degrades on API failures.

**Context:** The summarizer makes an actual API call to Haiku. Tests should mock the Anthropic client to avoid real API calls and costs. The key behaviors to verify: correct prompt construction, graceful handling of the first turn (no existing brief), and error resilience.

**Expected behavior:**

```typescript
// /agent-service/src/__tests__/context/brief-summarizer.test.ts

describe("updateSessionBrief", () => {
  it("generates an initial brief from the first turn");
  it("merges new information into an existing brief");
  it("includes session goal in the summarization prompt when available");
  it("compresses tool results instead of including raw JSON");
  it("handles API errors without throwing (returns existing brief)");
  it("keeps the summary prompt under token limits");
});

describe("prependBrief", () => {
  it("returns base prompt unchanged when no brief exists");
  it("prepends brief with section header and separator");
  it("includes recall_context hint in the prepended section");
});
```

**Key components:**
- `/agent-service/src/__tests__/context/brief-summarizer.test.ts` (new file)

**Notes:** Mock the `Anthropic` constructor using Vitest's `vi.mock`. The mock should return a predictable summary string so tests can verify prompt construction and brief merging logic. For the "handles API errors" test, make the mock throw and verify the function returns the existing brief unchanged (not the error).

---

### Task 12: Write integration test for recall tool

**Intent:** Verify that the `recall_context` tool correctly queries Supabase and returns formatted results the agent can use.

**Context:** This is an integration test that requires a Supabase connection (either local or test instance). It verifies the full path: insert test events into `session_events`, call the recall tool with a query, and verify the results match expected events.

**Expected behavior:**

```typescript
// /agent-service/src/__tests__/tools/recall-context.test.ts

describe("recall_context tool", () => {
  it("finds events matching a keyword query");
  it("filters by event_type when specified");
  it("respects the limit parameter");
  it("returns events scoped to the current session only");
  it("returns empty results for non-matching queries");
  it("formats results in a readable way for Claude");
  it("handles Supabase connection errors gracefully");
});
```

**Key components:**
- `/agent-service/src/__tests__/tools/recall-context.test.ts` (new file)

**Notes:** If a live Supabase instance is not available in the test environment, this test should use a mock Supabase client. The mock should simulate the full-text search response format. Mark the test as `.skip` or use a `SUPABASE_TEST_URL` environment variable to conditionally run it. The Supabase client initialization pattern should match what Wave 1 establishes.

---

### Task 13: End-to-end validation: long session simulation

**Intent:** Validate that the complete Wave 2 system works correctly in a realistic long-session scenario. This is not an automated test -- it is a manual validation script that exercises all three components together.

**Context:** Wave 2 has three interlocking components (sliding window, brief, recall). Each is tested individually in Tasks 10-12. This task validates they work together: a 30+ turn conversation where the agent uses the brief for context, the sliding window for cost control, and the recall tool for specific lookups.

**Expected behavior:** Create a test script or manual test plan that:

1. Starts a new session
2. Sends 20+ messages with at least 2 tool calls (e.g., `test_flow` or `show_flow_diagram`)
3. Verifies that the brief updates after each turn (check `session.brief.turnsCovered`)
4. Verifies that only ~15 messages are sent to the API (log the context window size)
5. At turn 25, asks the agent "what did we discuss in the first few messages?" -- verifying the brief contains that information or the agent calls `recall_context`
6. Verifies no API errors from split tool pairs

**Key components:**
- `/agent-service/src/__tests__/e2e/long-session.test.ts` (new file, or manual test script)

**Notes:** This test will make real API calls (to both Sonnet for the agent and Haiku 4.5 for the brief). It should be excluded from `npm test` and run manually with `npm run test:e2e` or similar. Estimated cost: ~$0.15-0.30 for a 30-turn session with brief updates (Sonnet agent calls dominate; Haiku 4.5 summaries add ~$0.075 total at $0.0025/turn). Mark as a separate test script, not part of the main test suite.

---

## Assumptions Register

> Every implementation plan rests on assumptions. Some are verified facts, others are educated guesses, and some turn out to be wrong. This register makes them explicit so they can be challenged before code is written, not after.

| # | Assumption | Category | Verdict | Evidence |
|:-:|-----------|:--------:|:-------:|----------|
| A1 | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) is available via the Anthropic SDK and costs $1/MTok input, $5/MTok output | API | Confirmed | Verified against Anthropic pricing page (2026-01-31). The original plan incorrectly used a fictional model ID (`claude-haiku-4-20250414`) and legacy Claude 3 Haiku pricing ($0.25/$1.25). Corrected to Haiku 4.5 pinned ID and current pricing. Sources: [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview), [Pricing](https://platform.claude.com/docs/en/about-claude/pricing). |
| A2 | The Anthropic SDK supports calling different models from the same process -- i.e., we can call Sonnet for the agent loop and Haiku for summarization using separate `client.messages.create()` calls with different `model` parameters | Library | Confirmed | `handler.ts:44` creates a new `Anthropic()` client per call. The SDK is stateless -- each `messages.create()` call specifies its own `model`. No shared state between calls. Source: `@anthropic-ai/sdk` v0.50.0 in `package.json`. |
| A3 | The Anthropic API will reject a message array where a `tool_result` content block appears without a preceding `tool_use` block from the assistant | API | Confirmed | Anthropic API docs state that `tool_result` blocks must reference a `tool_use_id` from the immediately preceding assistant message. Mismatched or missing pairs return HTTP 400. Note: Anthropic's `context-management-2025-06-27` beta now provides `clear_tool_uses_20250919` which can auto-clear old tool results server-side, partially mitigating this risk. However, the sliding window operates at the `Message[]` level where tool results are embedded, making pair-splitting a non-issue (see Task 2). |
| A4 | Postgres `jsonb_to_tsvector` / `plainto_tsquery` works on JSONB columns and provides adequate keyword search for session events | Infra | Confirmed | Updated from `to_tsvector('english', payload::text)` to `jsonb_to_tsvector('english', payload, '["string"]')` per review. The `jsonb_to_tsvector` function (Postgres 11+, Supabase uses 15+) indexes only string values within the JSON, avoiding noise from JSON syntax characters. A GIN index on this expression is required for performance (see Task 7). The existing `flows` table migration uses a GIN index on `to_tsvector` for plain text columns (`20260127100000_create_flows_table.sql:54`), establishing precedent. |
| A5 | Wave 1 creates a `session_events` table with columns: `id`, `session_id`, `event_type`, `payload` (JSONB), `sequence`, `created_at`, and writes events after each agent turn | Codebase | Plausible | The architecture review specifies this table and the event-sourcing pattern. Wave 1 plan is not yet written, so this is an assumed dependency. If Wave 1 changes the schema, Task 7 (recall tool) must be updated accordingly. |
| A6 | Async summarization (fire-and-forget after yielding `done`) does not block the Express response stream or prevent the user from sending the next message | Library | Confirmed | The `handleMessage` generator yields `done` first, then the caller (the Express route handler) closes the SSE stream. The fire-and-forget `updateSessionBriefAsync` runs independently on the Node.js event loop. The Express route handler returns after processing all yielded events. The async summarization is a separate promise that resolves later. |
| A7 | The Supabase JS client (`@supabase/supabase-js`) is not currently a dependency of the agent service and must be added | Library | Confirmed | `package.json` for `agent-service` lists `@anthropic-ai/sdk`, `express`, `uuid`, `zod`, `dotenv` -- no Supabase client. Wave 1 should add this dependency. If not, Task 7 must add it. |
| A8 | The session brief summarization cost is ~$0.0025 per turn, making it negligible compared to the agent's Sonnet API calls | API | Confirmed | A brief update sends ~1,500 tokens input (existing brief + latest turn summary) and receives ~200 tokens output. At Haiku 4.5 pricing ($1/MTok in, $5/MTok out): (1,500 * 1.0 + 200 * 5.0) / 1,000,000 = $0.0025 per summary. This is two orders of magnitude cheaper than a Sonnet agent call (~$0.15-$0.50 per turn). Original estimate of $0.000625 was based on legacy Claude 3 Haiku pricing and has been corrected. |
| A9 | 15 messages is a sufficient window size to maintain conversational coherence -- the agent will not frequently need information from messages 16-30 that is not captured in the brief | UX | Plausible | 15 messages represents ~5-7 full user-assistant turn pairs. Most conversational context is in the last 3-5 turns. The brief covers older content. This assumption should be validated during Task 13 (E2E test) and the window size can be tuned up if the agent frequently calls `recall_context` for recent events. |
| A10 | `convertToAPIMessages` in `handler.ts` can be extracted and reused by the context module without modification | Codebase | Confirmed | The function (`handler.ts:57-115`) is a pure function: it takes `Message[]` and returns `MessageParam[]` with no side effects or external dependencies. It can be moved or re-exported to the context module. **Note:** The function currently lacks an `export` keyword (it is module-private). An `export` must be added, or the function must be extracted to a shared module like `/agent-service/src/context/convert.ts`. |
| A11 | The `@supabase/supabase-js` client can be used server-side in the agent service (Express/Node.js) without the Supabase Auth context that the frontend uses | Library | Confirmed | The Supabase JS client supports a `service_role` key for server-side access that bypasses RLS. The agent service should use the service role key (not the anon key) to read/write `session_events` without needing user JWT auth at the database level. Auth is handled at the Express middleware layer. |
| A12 | The `session.messages` array can grow to 500+ entries in memory without causing Node.js memory issues for the agent service process | Infra | Plausible | Each `Message` object is ~1-5KB (text content + optional tool call data). However, `tool_calls[].result` fields (stored at `handler.ts:296`) can be 50-100KB per tool call (full LLM flow output). Revised estimate: ~5MB per active session with moderate tool usage (10 flow runs). With `maxSessions = 100`, worst case is ~500MB total. Node.js default heap is 1.5GB -- still safe but with less margin than the original 2.5MB/250MB estimate. Should be monitored. A future optimization: after tool results are sent to the API, truncate large `tool_calls[].result` objects (>10KB) and store a reference to the Supabase event instead. |

**Verdicts:**
- **Confirmed** -- Verified in source code, official documentation, or tested directly. Include the evidence.
- **Plausible** -- Reasonable based on available information, but not verified. Flag the risk.
- **Wrong** -- Contradicted by evidence. The plan must be updated before implementation.

**Categories:**
- **API** -- Assumptions about external APIs, SDKs, or third-party services
- **Library** -- Assumptions about library behavior, versions, or compatibility
- **Codebase** -- Assumptions about existing code structure, data flow, or behavior
- **Infra** -- Assumptions about infrastructure, hosting, database, or environment
- **UX** -- Assumptions about user behavior, expectations, or interaction patterns

---

## Appendix

### Technical Decisions

**TD1: Summarization model choice -- Haiku 4.5, not Sonnet or GPT**

Using Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) for summarization keeps costs negligible (~$0.0025/turn at $1/$5 MTok pricing) and avoids adding a second provider SDK. We already import `@anthropic-ai/sdk`; using the same SDK with a different `model` parameter is zero additional complexity. Haiku 4.5 is fast (~500ms for a summary) and more than capable of producing a 2-3 sentence digest.

**TD2: Fire-and-forget summarization, not blocking**

The brief update runs asynchronously after the response is sent. This means the brief is always one turn behind -- the current turn's summary is not available until the next turn. This is acceptable because: (a) the current turn's messages are in the sliding window, so they are available directly, and (b) the brief only needs to cover messages that have left the window, which is always older than the current turn.

**TD3: Postgres full-text search, not vector search**

The architecture review explicitly recommends against a vector database for V1. Keyword search with `tsvector`/`tsquery` is sufficient for "what did we say about X?" queries. The existing `flows` table already uses this pattern (see migration `20260127100000_create_flows_table.sql:54`), so the team has precedent. Vector search (semantic similarity) is a V2 upgrade if keyword search proves insufficient.

**TD4: Window size of 15, not 10 or 20**

15 messages provides ~5-7 complete turn pairs. At ~300 tokens per message average, that is ~4,500 tokens of recent history. Combined with the ~400-token brief, the total input is ~5,000 tokens -- well within budget. 10 messages felt too aggressive (only 3-4 turns of context); 20 felt wasteful (the brief should cover anything beyond 5 turns). The value is configurable via `DEFAULT_WINDOW_SIZE` and can be tuned based on real usage data.

**TD5: Window boundary -- always start on a user message**

Since tool results are embedded in assistant `Message` objects at the `session.messages` level (not stored as separate messages), the tool-pair splitting concern is a non-issue for the sliding window. The only boundary case to handle: if the oldest message in the window is an assistant message, expand backward by one to include the preceding user message. This ensures Claude always sees the question that prompted the response. The worst case: the window includes one extra message beyond the configured size.

**TD6: `convertToAPIMessages` stays as-is, window applied upstream**

Rather than modifying `convertToAPIMessages` to be aware of windowing, we apply the window before calling it. This keeps the conversion function pure and testable. The new `buildContextWindow` function composes windowing + conversion + brief injection. Note: `convertToAPIMessages` is currently module-private in `handler.ts:57`; an `export` keyword must be added or the function extracted to a shared module for the context module to import it.

**TD7: Manual summarization over Anthropic's native context management features**

Anthropic now provides two features that overlap with Wave 2's approach: (a) **client-side compaction** in the SDK, which monitors token usage and auto-summarizes when a threshold is exceeded, and (b) **server-side context editing** via the `context-management-2025-06-27` beta, including `clear_tool_uses_20250919` which auto-clears old tool results. Wave 2 uses manual summarization instead because:
1. SDK compaction requires `tool_runner` (beta), which is Wave 3 scope (Agent SDK migration). Wave 2 works with the existing hand-rolled agentic loop.
2. Server-side `clear_tool_uses` only manages tool results, not conversational context. It cannot produce a running summary or provide searchable long-term memory.
3. The manual brief + recall approach preserves full conversational context, gives the agent a searchable memory via `recall_context`, and does not depend on beta features that may change.
4. The server-side `clear_tool_uses_20250919` strategy could be enabled as a defense-in-depth measure alongside the sliding window in a future iteration, providing a safety net even if the sliding window logic has a bug.

Sources: [Context editing docs](https://platform.claude.com/docs/en/build-with-claude/context-editing), [Prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching).

**TD8: Prompt caching for the system prompt + brief**

The system prompt (base prompt + brief) should leverage Anthropic's prompt caching to reduce cost and latency. Since the brief updates asynchronously (one turn behind per TD2), the system prompt is stable across consecutive turns, making it an ideal caching candidate. Adding a `cache_control` breakpoint at the end of the system prompt in `buildContextWindow` enables: cache hits at $0.30/MTok vs. $3/MTok base for Sonnet 4 (90% reduction), and reduced time-to-first-token on cache-hit turns. Cache write cost is 1.25x base (5-minute TTL). For sessions with 20+ turns, the savings compound meaningfully.

### Dependencies

| Dependency | Source | Required By |
|-----------|--------|-------------|
| Wave 1: `session_events` table in Supabase | Phase 8 Wave 1 | Task 7 (recall tool) -- hard dependency |
| Wave 1: Event writing after each agent turn | Phase 8 Wave 1 | Task 7 (recall tool) -- hard dependency |
| Wave 1: `name`, `goal`, `brief` fields on Session type | Phase 8 Wave 1 | Task 1 (types) -- may overlap; coordinate |
| Wave 1: Supabase client in agent service | Phase 8 Wave 1 | Task 7 (recall tool) -- if not done, Task 7 adds it |
| Wave 1: Auth middleware (real user_id) | Phase 8 Wave 1 | Task 7 (session scoping) -- can work with demo-user for testing |
| `@anthropic-ai/sdk` ^0.50.0 | Existing in `package.json` | Tasks 4, 5 (summarizer) |
| `@supabase/supabase-js` | Wave 1 should add; else Task 7 adds | Task 7 (recall tool) |
| Postgres full-text search (built into Supabase) | Supabase infrastructure | Task 7 (recall tool) |
| GIN index on `session_events` for `jsonb_to_tsvector` | Migration (Wave 1 or Wave 2) | Task 7 (recall tool performance) |
| Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) availability | Anthropic API | Tasks 4, 5 (summarizer) |
| Vitest | Existing in `package.json` | Tasks 10, 11, 12, 13 |

### Out of Scope

The following are explicitly **not** part of Wave 2:

- **Agent SDK migration** -- Covered in Wave 3. Wave 2 works with the existing hand-rolled agentic loop in `handler.ts`.
- **Session conductor prompt** -- Covered in Wave 3. Wave 2 uses the existing Flow Architect prompt. The brief is prepended regardless of which persona is active.
- **Frontend changes** -- Wave 2 is entirely backend (agent service). No UI changes, no new components, no SSE event types.
- **Session rehydration from Supabase** -- Wave 1 scope. Wave 2 assumes events are being written but does not implement the rehydration path.
- **Vector/semantic search** -- Postgres keyword search only. No embeddings, no vector DB.
- **Brief compression/re-summarization** -- If the brief grows too long, we do not auto-compress it in Wave 2. The summarizer prompt instructs Haiku to keep it under 300 words, which is the only control. Explicit brief compression is a future optimization.
- **Token counting** -- Wave 2 uses message count (not token count) for the sliding window. True token counting (e.g., via `tiktoken` or the Anthropic token counting API) would be more precise but adds complexity. Message count is a sufficient proxy for V1.
- **Multi-session recall** -- The `recall_context` tool only searches within the current session. Cross-session search ("what did I do last week?") is not in scope.
- **Cost tracking for summarization** -- We do not track or display the cost of Haiku 4.5 summarization calls. At ~$0.0025/turn, it is negligible. Cost visibility can be added later if needed.

---

## Review: User & Senior Engineer Audit

> **Reviewer:** Claude Opus 4.5 (automated review, 2026-01-31)
>
> **Method:** Read every source file referenced in the plan, verified line numbers, searched current Anthropic documentation and pricing, traced the SSE streaming code path end-to-end, and validated each assumption in the register against evidence.

---

### Part 1: User Perspective -- "Will I notice the difference?"

**Overall assessment: The design is sound for the user, with two risks that could surface as visible failures.**

**What works well:**
- The brief-as-system-prompt approach is elegant. The user will never see the mechanism. They say something, the agent responds coherently, and the brief silently provides continuity. This is the right UX.
- The `recall_context` tool is a good safety net. When the brief does not capture a specific detail, the agent can self-serve by searching. The user just sees the agent "remembering" things.
- Removing the hard 100-message cap (`store.ts:49`) eliminates the scenario where the session silently corrupts mid-conversation. Today, truncation at line 144-146 can split tool pairs and cause 400 errors that surface to the user as "An error occurred while processing your message" (`handler.ts:349`). That is a real user-facing bug that Wave 2 fixes.

**Risk 1: Brief staleness during rapid-fire turns.** The brief is always one turn behind (acknowledged in TD2). But consider: a user sends 3 messages in quick succession. Turn 1's brief update is still running. Turn 2 starts, uses the brief from before turn 1. Turn 3 starts, still uses the pre-turn-1 brief. If the user references something from turn 1 and it has already fallen outside the 15-message window, the agent has no context. The plan says the brief is "best-effort" (Task 5 notes), but for users who work fast, this could cause a visible coherence gap of 2-3 turns. **Mitigation:** The 15-message window is generous enough that this is unlikely in practice -- 3 rapid messages are well within the window. But if the user triggers tool-heavy turns (each consuming 3-5 messages for tool_use/tool_result pairs), the window could fill faster than expected.

**Risk 2: Recall tool returns noise from JSONB text casting.** The plan acknowledges this (A4, Task 7 notes) but underestimates the user impact. When `payload::text` is cast, the JSON structure characters (`{`, `}`, `"`, `:`) are included in the tsvector. A query for "medication" will also match JSON keys that happen to contain "medic" in nested paths. For flow_completed events with large result payloads, the noise ratio could be high. The user asks "what did we decide about medication tracking?" and the agent gets back 5 results, 3 of which are irrelevant JSON fragments. The agent must parse through this -- it will probably still produce a good answer, but it adds latency and wasted tokens. **Mitigation:** Use `jsonb_to_tsvector('english', payload, '["string"]')` instead of `to_tsvector('english', payload::text)`. This is available in Postgres 11+ (Supabase uses 15+) and indexes only string values within the JSON, not keys or structure. See: PostgreSQL docs on `jsonb_to_tsvector`.

**Risk 3: The user loses the ability to scroll back through full message history.** The plan is entirely backend -- no frontend changes. But the frontend currently renders `session.messages` from the API response (`GET /api/chat/session/:id` at `chat.ts:285-313`). After Wave 2, messages accumulate unboundedly in memory, so the full history is still available. Good. But if a future wave adds Supabase-backed sessions and evicts old messages from memory, the frontend must be updated to paginate. This is out of scope but should be flagged.

**User verdict: PASS with caveats.** The design delivers on the promise of invisible context management. The two risks above are edge cases, not deal-breakers. The recall tool noise issue (Risk 2) should be addressed by switching to `jsonb_to_tsvector`.

---

### Part 2: Senior Engineer Perspective

#### Issue 1: CRITICAL -- Haiku model ID is wrong, pricing is 4x off -- RESOLVED

~~The plan uses `SUMMARIZER_MODEL = "claude-haiku-4-20250414"`.~~ **Fixed:** Updated to `claude-haiku-4-5-20251001` throughout. Pricing corrected from $0.25/$1.25 MTok (legacy Claude 3 Haiku) to $1/$5 MTok (Haiku 4.5). Cost estimate in A8 corrected from $0.000625 to $0.0025 per summary. The overall conclusion (summarization cost is negligible compared to Sonnet) remains valid.

#### Issue 2: CRITICAL -- Anthropic now offers native context management -- RESOLVED

~~The plan did not acknowledge Anthropic's context management features.~~ **Fixed:** Added note in Executive Summary, new TD7 in Technical Decisions, and updated A3 in the Assumptions Register. The plan now explicitly documents why manual summarization is preferred over the SDK compaction (requires `tool_runner`/Wave 3 scope) and server-side `clear_tool_uses_20250919` (only manages tool results, not conversational context). The server-side strategy is flagged as a potential defense-in-depth measure for a future iteration.

#### Issue 3: HIGH -- The sliding window algorithm in Task 2 has an under-specified edge case -- RESOLVED

~~The algorithm described complex tool-pair integrity logic.~~ **Fixed:** Task 2 has been simplified. Since `session.messages` stores tool results embedded in assistant `Message` objects (at `handler.ts:291-297`), tool-pair splitting is a non-issue at the `Message[]` level. The algorithm is now: "Take last N `Message` objects. If the oldest is an assistant message, expand backward by one to include the preceding user message." TD5 has been updated accordingly.

#### Issue 4: HIGH -- Fire-and-forget after `yield { type: "done" }` may not work as described

The plan says (Task 5): "after yielding the `done` event at `handler.ts:363`, fire the summarizer."

Looking at the actual code path:
1. `handler.ts:363` -- `yield { type: "done" };` is the last thing the generator does
2. `chat.ts:222` -- `for await (const event of handleMessage(...))` consumes the generator
3. `chat.ts:251-254` -- the `case "done"` handler is a no-op (just `break`)
4. `chat.ts:258-259` -- after the `for await` loop ends, the route sends the done SSE event and calls `res.end()` at line 276

The generator function `handleMessage` returns after yielding `done`. **There is no code executing after `yield { type: "done" }` in the current handler.** The plan proposes adding the fire-and-forget call after line 363, but anything after the final `yield` in an async generator only runs when the consumer calls `.next()` one more time (which the `for await` loop does to detect `{ done: true }`).

**However, this actually does work** -- when the `for await` loop calls `.next()` after consuming the `done` event, the generator resumes from line 363 and executes any remaining code before returning. So the fire-and-forget pattern is valid:

```typescript
yield { type: "done" };
// This code DOES execute when the consumer's for-await loop calls .next()
updateSessionBriefAsync(session, turnMessages).catch(console.error);
// Generator returns, for-await loop sees { done: true }
```

**But there is a subtlety:** `chat.ts:269-277` has a `finally` block that calls `res.end()`. The response is already closed before the async summarization completes. The summarizer's promise runs on the event loop independently. This is fine for Express (the response is done), but the session object is still in memory. **The race condition described in the plan (Task 5 notes) is real but benign** -- if the user sends a new message before the summarizer finishes, the new `handleMessage` call reads `session.brief` which might be stale. This is acceptable.

**One concern:** If the server receives a SIGTERM (`index.ts:72-88`) while a summarization is in-flight, the `server.close()` callback fires after all connections are closed, and the force-shutdown timer is 10 seconds. Haiku typically responds in ~500ms, so this is fine. But if Haiku is slow or retried, the promise could be orphaned. Not a production issue for POC, but worth noting.

#### Issue 5: MEDIUM -- Postgres full-text search on JSONB without a GIN index will be slow -- RESOLVED

~~The plan's SQL used `to_tsvector('english', payload::text)` without a GIN index.~~ **Fixed:** Task 7 now includes the GIN index creation step and uses `jsonb_to_tsvector('english', payload, '["string"]')` instead of the `::text` cast. The SQL queries have been updated accordingly.

#### Issue 6: MEDIUM -- What happens if Haiku summarization fails 5 times in a row? -- RESOLVED

~~No mechanism to recover missed turns.~~ **Fixed:** Task 5 now implements accumulated catch-up via `lastSummarizedIndex`. The `updateSessionBriefAsync` function passes all messages from `lastSummarizedIndex` to current. The index is only advanced on success, so failed summarizations do not lose context -- the next successful call catches up the entire gap. The `Session` type (Task 1) now includes `lastSummarizedIndex?: number`.

#### Issue 7: MEDIUM -- 500+ messages in memory per session

The plan (A12) says 500 messages at ~1-5KB each = ~2.5MB per session, and with 100 sessions = 250MB. But the plan under-accounts for `tool_calls[].result`:

Looking at `handler.ts:291-297`, tool results are stored as `unknown` on the `Message.tool_calls[].result` field. A `test_flow` result (which invokes the executor API and returns the full flow output including all model responses) can easily be 50-100KB. A session that runs 10 flows has 10 messages with ~50KB results each = 500KB just in tool results. With the full 500-message scenario, worst case is significantly higher than 2.5MB.

**Revised estimate:** Average session with tool usage: ~5MB. 100 sessions: ~500MB. Still within Node.js 1.5GB heap, but less comfortable. The plan acknowledges "flow results stored in `tool_calls[].result` are the biggest objects" (A12) but does not quantify the impact accurately.

**Mitigation:** When storing tool results, consider truncating large results (>10KB) and storing a reference to the Supabase event instead. Or: after tool results are sent to the API (via `convertToAPIMessages`), replace `tool_calls[].result` with a summary and a reference ID for recall. This is an optimization for a later wave but should be flagged.

#### Issue 8: LOW -- `convertToAPIMessages` is not exported (plan says it can be reused) -- RESOLVED

~~The function is module-private, missing `export` keyword.~~ **Fixed:** Task 3 notes, TD6, and A10 now explicitly state that `export` must be added to `convertToAPIMessages` at `handler.ts:57` or the function must be extracted to a shared module like `/agent-service/src/context/convert.ts`.

---

### Part 3: Updated Assumptions Register

| # | Assumption | Original Verdict | Updated Verdict | Evidence |
|:-:|-----------|:----------------:|:---------------:|----------|
| A1 | Claude Haiku model ID and pricing | Plausible | **Confirmed (corrected)** | Model ID corrected to `claude-haiku-4-5-20251001`. Pricing corrected to $1/MTok input, $5/MTok output. All references in the plan have been updated. |
| A2 | SDK supports calling different models from same process | Confirmed | **Confirmed** | Verified. `handler.ts:44` creates a stateless client. Each `messages.create()` specifies its own `model` parameter. SDK v0.50.0 in `package.json:17`. |
| A3 | API rejects messages where tool_result appears without preceding tool_use | Confirmed | **Confirmed (but partially mitigated by new beta)** | Multiple Claude Code GitHub issues confirm HTTP 400 errors for orphaned tool_results. Anthropic's `context-management-2025-06-27` beta can auto-clear old tool results. Addressed in TD7 and the plan's A3 entry. |
| A4 | Postgres full-text search works on JSONB | Plausible | **Confirmed (corrected)** | Switched from `to_tsvector('english', payload::text)` to `jsonb_to_tsvector('english', payload, '["string"]')`. GIN index added to Task 7. Both changes applied to the plan. |
| A5 | Wave 1 creates session_events table | Plausible | **Plausible (unchanged)** | Still depends on Wave 1. No new evidence. |
| A6 | Async summarization does not block Express response | Confirmed | **Confirmed with nuance** | Traced the full path: `handleMessage` yields `done` at `handler.ts:363`. The `for await` loop in `chat.ts:222` consumes it, then `chat.ts:258-276` sends the SSE done event and calls `res.end()`. Any fire-and-forget promise launched after `yield { type: "done" }` runs independently on the event loop after the generator's final `.next()` resolves. Express response is closed. The async summarization runs detached. Verified that `chat.ts:269-277` finally block does not interfere. |
| A7 | Supabase JS client is not a dependency | Confirmed | **Confirmed** | `package.json` at `/agent-service/package.json` lists no `@supabase/supabase-js`. Dependencies: `@anthropic-ai/sdk`, `express`, `uuid`, `zod`, `dotenv`. |
| A8 | Summarization cost is ~$0.0025 per turn | Plausible | **Confirmed (corrected)** | Corrected from $0.000625 to $0.0025 per summary. At Haiku 4.5 pricing ($1/MTok in, $5/MTok out): (1,500 * 1.0 + 200 * 5.0) / 1,000,000 = $0.0025. Still negligible vs. Sonnet (~$0.15-$0.50/turn). All references updated. |
| A9 | 15 messages is sufficient window size | Plausible | **Plausible (unchanged)** | Cannot validate without real usage data. Note: tool-heavy turns inflate message count in the API-level format (each tool_use/tool_result pair adds extra API messages from a single `Message` object). At the `Message[]` level, 15 messages is ~7-8 turn pairs. |
| A10 | `convertToAPIMessages` is a pure, reusable function | Confirmed | **Confirmed (needs export)** | Verified at `handler.ts:57-115`. Pure function. Lacks `export` keyword. Task 3 notes and TD6 updated to explicitly require adding `export` or extracting to a shared module. |
| A11 | Supabase JS client works server-side with service_role key | Confirmed | **Confirmed (unchanged)** | Standard pattern. No new evidence needed. |
| A12 | 500+ messages in memory is safe | Plausible | **Plausible (risk revised upward)** | Revised estimate: ~5MB per active session with moderate tool usage, ~500MB for 100 sessions. Consistent with A12 update in the plan's main Assumptions Register. |

---

### Part 4: New Issues Discovered (Not in Original Plan)

| # | Issue | Severity | Status | Description |
|:-:|-------|:--------:|:------:|-------------|
| N1 | Haiku model ID is fictional | CRITICAL | **RESOLVED** | Corrected to `claude-haiku-4-5-20251001` throughout. Pricing corrected to $1/$5 MTok. |
| N2 | Anthropic native context management beta | HIGH | **RESOLVED** | Added TD7, updated Executive Summary, and updated A3. Manual approach justified. |
| N3 | Missing GIN index on session_events | HIGH | **RESOLVED** | GIN index added to Task 7 using `jsonb_to_tsvector`. |
| N4 | Brief catch-up after failed summarizations | MEDIUM | **RESOLVED** | `lastSummarizedIndex` added to Session type (Task 1) and catch-up logic added to Task 5. |
| N5 | `jsonb_to_tsvector` is better than `payload::text` cast | MEDIUM | **RESOLVED** | Task 7 SQL and A4 updated to use `jsonb_to_tsvector`. |
| N6 | `convertToAPIMessages` needs `export` keyword | LOW | **RESOLVED** | Task 3 notes, TD6, and A10 updated to require `export` or extraction. |
| N7 | Tool result memory bloat over long sessions | LOW | **NOTED** | Flagged in A12 as future optimization. Acceptable for POC. |

---

### Part 5: Final Verdict

**APPROVE WITH REQUIRED CHANGES.**

The architecture is sound. The three-component design (sliding window + brief + recall) is well-motivated, the code references are accurate (every line number checked out), and the task decomposition is practical. The plan demonstrates genuine understanding of the codebase.

**Must fix before implementation:** All resolved in post-review revision.
1. ~~Correct the Haiku model ID to `claude-haiku-4-5-20251001` (N1)~~ -- DONE
2. ~~Correct the pricing figures in A1 and A8 ($1/MTok input, $5/MTok output) (N1)~~ -- DONE
3. ~~Add a GIN index creation step to Task 7 for `session_events` full-text search (N3)~~ -- DONE
4. ~~Switch from `to_tsvector('english', payload::text)` to `jsonb_to_tsvector('english', payload, '["string"]')` in the recall tool SQL (N5)~~ -- DONE
5. ~~Add `export` to `convertToAPIMessages` or extract it to a shared module (N6)~~ -- DONE (noted in Task 3, TD6, A10)

**Should fix before implementation:** All resolved in post-review revision.
1. ~~Add brief catch-up mechanism -- track `lastSummarizedIndex` (N4)~~ -- DONE (Task 1, Task 5)
2. ~~Acknowledge the `context-management-2025-06-27` beta (N2)~~ -- DONE (TD7, Executive Summary, A3)
3. ~~Simplify Task 2 algorithm description (Issue 3)~~ -- DONE (Task 2, TD5)

**Can defer:**
1. Tool result memory bloat mitigation (N7) -- acceptable for POC, flagged in A12
2. Token counting vs message counting for window size -- message count is a reasonable proxy for V1

---

## Post-Review Revisions

| # | Review Finding | Severity | Change Made |
|:-:|---------------|:--------:|-------------|
| 1 | Haiku model ID `claude-haiku-4-20250414` does not exist | CRITICAL | Replaced with `claude-haiku-4-5-20251001` everywhere: Task 4 code sample, TD1, Executive Summary, Task 13 notes, A1. |
| 2 | Pricing is 4x off ($0.25/$1.25 vs actual $1/$5 per MTok) | CRITICAL | Corrected all cost figures: A1 updated to $1/$5 MTok, A8 corrected from $0.000625 to $0.0025 per summary, TD1 updated, Executive Summary updated, Out of Scope cost line updated, Task 13 cost estimate updated. |
| 3 | Anthropic SDK compaction and server-side context editing overlap with manual summarization | HIGH | Added note in Executive Summary explaining why manual approach is preferred. Added TD7 documenting the tradeoff. Updated A3 to reference `clear_tool_uses_20250919` as partial mitigation. |
| 4 | Prompt caching not mentioned for system prompt + brief | HIGH | Added prompt caching recommendation to Task 6 notes. Added TD8 for prompt caching decision. |
| 5 | Sliding window tool-pair algorithm is unnecessarily complex | HIGH | Simplified Task 2: removed tool-pair integrity logic (non-issue at `Message[]` level since tool results are embedded). Algorithm is now "take last N, ensure starts on user message." Updated TD5 accordingly. |
| 6 | Missing GIN index on `session_events` for full-text search | MEDIUM | Added GIN index creation step and migration SQL to Task 7. Index uses `jsonb_to_tsvector`. Added GIN index as a dependency in Dependencies table. |
| 7 | No recovery mechanism for failed summarization | MEDIUM | Added `lastSummarizedIndex` to Session type (Task 1). Task 5 now uses accumulated catch-up: passes all messages from `lastSummarizedIndex` to current, only advances index on success. |
| 8 | `jsonb_to_tsvector` preferred over `payload::text` cast | MEDIUM | Updated Task 7 SQL from `to_tsvector('english', payload::text)` to `jsonb_to_tsvector('english', payload, '["string"]')`. Updated A4 accordingly. |
| 9 | `convertToAPIMessages` needs `export` keyword for reuse | LOW | Added explicit note in Task 3, TD6, and A10 that `export` must be added to the function declaration or it must be extracted to a shared module. |
| 10 | Tool result memory bloat (50KB+ per tool call) | LOW | Updated A12 with revised memory estimate (~5MB/session, ~500MB for 100 sessions). Flagged future optimization: truncate large `tool_calls[].result` after API call and store Supabase reference. |
| 11 | Fire-and-forget after `yield { type: "done" }` is subtle | LOW | No plan change needed; pattern is valid per code trace. Noted in inner review (Issue 4) that SIGTERM during in-flight summarization is safe for POC (Haiku responds in ~500ms vs 10s shutdown timeout). |
