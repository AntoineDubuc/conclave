# Implementation Plan: Phase 8 Wave 4 -- Flow Integration

---

## Executive Summary

Wave 4 makes Conclave Sessions powerful. Waves 1-3 built the foundation: Supabase persistence, smart context management, the two-panel session UI, session tree, and ViewHint system. Wave 4 connects that foundation to the flow execution engine so users can run multi-model flows mid-conversation and see results stream in real time. This is the wave where sessions stop being a chat interface and become a thinking workspace.

The user asks the agent to run a flow. The agent calls the executor. While the executor runs (10-120 seconds), the frontend shows live progress: "Running phase 1 of 2... Model 3/5 complete." When the executor finishes, results appear in the workspace using the appropriate view -- card grid for persona explorations, tabbed view for parallel model outputs, side-by-side comparison for debates. A persistent input bar at the bottom means the user can immediately say "now synthesize these" without clicking anything to re-open the chat. And if the user changes their mind mid-execution, they click Cancel and move on.

**Key Outcomes:**
- Users see real-time progress during flow execution instead of 45 seconds of silence
- Users can cancel a running flow without refreshing the page or losing session state
- Flow results render in the workspace using the right layout for the content (cards, tabs, comparison, document, diagram)
- The input bar remains visible and functional even when the workspace is full-width, enabling seamless iteration

---

## Product Manager Review

### Feature Overview

Wave 4 bridges the gap between "sessions as a chat UI" and "sessions as a thinking workspace." Until now, the agent could talk about flows. After Wave 4, the agent can run flows and present results in a way that invites the user to think, compare, and iterate. This is the wave that delivers the core Session promise: the user focuses on their goal, the agent handles orchestration, and the workspace adapts to show results the right way.

### Features

#### Feature 1: Progress Streaming During Flow Execution

**What it is:** While a flow executes (calling 1-5 AI models across 1-N phases), the frontend displays live progress indicators showing which phase is running, how many models have completed, and elapsed time.

**Why it matters:** Today, when the agent runs a flow via `test_flow`, the user sees nothing for 10-120 seconds. That silence is anxiety-inducing -- did it break? Is it stuck? Progress streaming transforms a black box into a transparent process. Users trust systems they can observe.

**User perspective:** The user says "Run 5 personas on this." The workspace immediately shows a progress card: "Phase: Exploration -- Model 1/5 complete (12s elapsed)." Each model completion updates the count. When the phase finishes, the progress card transitions into the results view. The user never wonders what is happening.

---

#### Feature 2: Cancellation Support

**What it is:** A Cancel button appears during flow execution. Clicking it aborts the in-flight executor HTTP request and returns the user to a ready state, preserving all session context accumulated before the cancelled flow.

**Why it matters:** Without cancellation, a user who realizes they asked the wrong question is trapped for up to 120 seconds. Cancellation respects the user's time and reduces wasted API spend. It also makes experimentation feel safe -- you can try something and bail if it is not what you wanted.

**User perspective:** The user sees "Running phase 2 of 3..." and realizes they forgot to include a key constraint. They click Cancel. The progress card disappears, the chat shows "Flow cancelled," and the input bar is ready for their corrected request. Session context is intact. Nothing is lost except the partial execution cost (typically $0.01-0.05).

---

#### Feature 3: Adaptive Workspace Views

**What it is:** A registry of React components that render flow results in layouts appropriate to the content type. The agent's `workspace_update` SSE event includes a `view_hint` field that tells the frontend which view to use. Five views ship in Wave 4: `card_grid`, `tabbed_view`, `comparison`, `document`, and `flow_diagram`.

**Why it matters:** Five persona outputs crammed into a chat bubble are unreadable. A product brief displayed as a grid of cards is confusing. The right layout for the right content is the difference between "I can work with this" and "I need to copy this into a real tool." Adaptive views keep the user inside Conclave instead of switching to Google Docs.

**User perspective:** The user runs a 5-persona exploration. Results appear as a card grid -- one card per persona, each with a title, model badge, and scrollable content area. The user runs a Claude vs. GPT debate. Results appear side-by-side in comparison view. The user asks for a product brief. It appears as a full-width document with markdown rendering. The user never picks a layout. The system just gets it right.

---

#### Feature 4: Persistent Input Bar

**What it is:** The chat input bar remains visible at the bottom of the screen at all times, even when the workspace expands to full-width for result review. An expand icon on the input bar toggles the full chat panel back into view.

**Why it matters:** The input bar is the user's connection to the agent. If it disappears when reviewing results, the user has to figure out how to get back to "talking mode." A persistent input bar means the user can review results AND direct the next step without any mode switch. This is the UX detail that makes sessions feel like a conversation, not a series of disconnected screens.

**User perspective:** The user is reading five persona outputs in the full-width workspace. They spot an insight in the Caregiver persona and want to go deeper. They type "Expand on the medication tracking insight from the Caregiver persona" directly into the input bar at the bottom. No clicking to re-open the chat. No finding a hidden button. The input bar was right there the whole time.

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
| [ ] | 0 | Executor schema change: add execution_id to ExecuteRequest | | | | | |
| [ ] | 1 | SSE event types for flow progress | | | | | |
| [ ] | 2 | Agent service progress streaming during tool execution | | | | | |
| [ ] | 3 | Frontend progress event handler in use-session-chat | | | | | |
| [ ] | 4 | Flow progress indicator component | | | | | |
| [ ] | 5 | Cancellation endpoint and AbortController wiring | | | | | |
| [ ] | 6 | Cancel button UI with session state preservation | | | | | |
| [ ] | 7 | Shared markdown content component | | | | | |
| [ ] | 8 | Card grid workspace view | | | | | |
| [ ] | 9 | Tabbed workspace view | | | | | |
| [ ] | 10 | Comparison (side-by-side) workspace view | | | | | |
| [ ] | 11 | Document workspace view (default fallback) | | | | | |
| [ ] | 12 | Flow diagram workspace view (CSS-based) | | | | | |
| [ ] | 13 | Persistent input bar (full-width, always visible) | | | | | |
| [ ] | 14 | Workspace-to-chat toggle and view override dropdown | | | | | |
| [ ] | 15 | Integration testing: flow execution through session UI | | | | | |

**Summary:**
- Total tasks: 16 (including Task 0 prerequisite)
- Completed: 0
- Total time spent: 0 minutes
- Total human estimate: 0 minutes
- Overall multiplier: N/A

---

## Task Descriptions

This section provides context for each task. Read the relevant description before starting implementation.

---

### Task 0: Executor Schema Change -- Add execution_id to ExecuteRequest

**Intent:** Add an optional `execution_id` field to the executor's `ExecuteRequest` schema and pass it through to `run_flow_v2`. This is a prerequisite for the progress polling architecture in Task 2.

**Context:** The progress streaming design (Task 2) requires the agent service to know the `execution_id` before the `/execute` response returns, so it can poll `GET /execute/{execution_id}/status` while the flow runs. Currently, the `execution_id` is generated inside `run_flow_v2` (`executor_v2.py`, line 943-944) and is only available in the response payload. The `ExecuteRequest` schema (`executor_api/schemas.py`, lines 32-55) has no `execution_id` field. Even though `run_flow_v2` accepts `execution_id: Optional[str] = None` (line 917), the `/execute` endpoint (`api.py`, lines 451-458) does not pass it through.

**Expected behavior:** After this change:
1. The agent service generates a UUID before calling `/execute`
2. It includes `execution_id: "<uuid>"` in the POST body
3. The executor uses this ID (instead of generating its own) when calling `register_execution()` at line 947
4. The agent service can immediately poll `GET /execute/<uuid>/status` while the POST is in-flight

**Key components:**
- `conclave_ui/executor_api/schemas.py` -- add `execution_id: Optional[str] = Field(default=None, description="Client-provided execution ID. If omitted, one is generated.")` to `ExecuteRequest`
- `conclave_ui/executor_api/api.py` -- in the `/execute` handler, pass `execution_id=request.execution_id` to `run_flow_v2()`

**Notes:** This is a two-line change to the executor. The architecture review says "zero executor changes" but also acknowledges that progress streaming needs the agent service to know the `execution_id` early. This is the minimal, non-breaking change that enables it. The field is optional -- existing clients (Streamlit POC, any direct API callers) are unaffected. If this change is truly out of scope, the fallback is to poll with retry-on-404 until the execution registers in the registry (50-500ms race window), but that is fragile.

---

### Task 1: SSE Event Types for Flow Progress

**Intent:** Define the typed SSE events that the agent service emits during flow execution, and the corresponding frontend types that consume them. This is the contract that everything else in Wave 4 depends on.

**Context:** The current SSE event types are defined in two places with slightly different shapes. The agent service (`conclave_ui/agent-service/src/types/index.ts`, lines 174-250) defines the `SSEEventType` union as `"connected" | "text" | "tool_use" | "tool_result" | "error" | "done"` -- note: no `flow_created` in the agent service types. The frontend (`conclave_ui/conclave-app/lib/types/agent-chat.ts`, lines 6-66) additionally includes `flow_created`. Wave 4 needs new event types for flow lifecycle: `flow_started`, `flow_progress`, `flow_completed`, `flow_cancelled`, `flow_error`, and `workspace_update`. The `workspace_update` event carries the `view_hint` field and artifact data that drives the adaptive workspace.

**Expected behavior:** After this task, both the agent service and frontend have matching typed definitions for all flow progress events. The types include:

- `flow_started` -- carries `execution_id`, `flow_name`, `total_phases`, `total_participants`
- `flow_progress` -- carries `execution_id`, `current_phase`, `phase_index`, `total_phases`, `completed_participants`, `total_participants`, `elapsed_seconds`
- `flow_completed` -- carries `execution_id`, `status`, `total_cost`, `execution_time_seconds`
- `flow_cancelled` -- carries `execution_id`, `reason`, `completed_phases`
- `flow_error` -- carries `execution_id`, `error`, `completed_phases`
- `workspace_update` -- carries `type` (artifact type), `view_hint` (ViewHint enum), `artifacts` array

**Key components:**
- `conclave_ui/agent-service/src/types/index.ts` -- add new event types to `SSEEventType` union and define interfaces
- `conclave_ui/conclave-app/lib/types/agent-chat.ts` -- mirror the same types on the frontend
- New shared type: `ViewHint = "card_grid" | "tabbed_view" | "comparison" | "document" | "flow_diagram"`

**Notes:** The `view_hint` must be optional with a fallback to `"document"`. If the agent sends an unknown view_hint, the frontend falls back to document view. This ensures the system degrades gracefully if the agent prompt evolves faster than the frontend components. Keep the event shapes flat -- avoid deeply nested objects. The frontend SSE parser (`use-agent-chat.ts`) uses `JSON.parse` on each `data:` line, so every event must be a single JSON object.

**Exact JSON shapes for each event:**

```json
// flow_started -- emitted immediately when test_flow begins executing
{
  "type": "flow_started",
  "execution_id": "550e8400-e29b-41d4-a716-446655440000",
  "flow_name": "5-Persona Exploration",
  "total_phases": 2,
  "total_participants": 5,
  "estimated_duration_seconds": 45
}

// flow_progress -- emitted every 2-3 seconds during execution (from polling)
{
  "type": "flow_progress",
  "execution_id": "550e8400-e29b-41d4-a716-446655440000",
  "current_phase": "Exploration",
  "phase_index": 0,
  "total_phases": 2,
  "completed_phases": [],
  "elapsed_seconds": 12.5,
  "status": "running"
}

// flow_completed -- emitted when the executor returns successfully
{
  "type": "flow_completed",
  "execution_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "complete",
  "total_cost": 0.0347,
  "execution_time_seconds": 34.2,
  "completed_phases": ["Exploration", "Synthesis"]
}

// flow_cancelled -- emitted after the user triggers cancellation
{
  "type": "flow_cancelled",
  "execution_id": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "user_requested",
  "completed_phases": ["Exploration"],
  "partial_cost": 0.0182
}

// flow_error -- emitted when the executor returns an error
{
  "type": "flow_error",
  "execution_id": "550e8400-e29b-41d4-a716-446655440000",
  "error": "Rate limited by provider: openai",
  "error_code": "RATE_LIMITED",
  "completed_phases": ["Exploration"]
}

// workspace_update -- emitted after flow_completed, carries results for rendering
{
  "type": "workspace_update",
  "execution_id": "550e8400-e29b-41d4-a716-446655440000",
  "view_hint": "card_grid",
  "artifact_type": "persona_results",
  "artifacts": [
    {
      "id": "p1",
      "label": "Caregiver Persona",
      "model": "gemini-2.0-flash",
      "provider": "google",
      "content": "## Caregiver Perspective\n\nMedication tracking is critical...",
      "metadata": { "cost": 0.0065, "duration_seconds": 8.3 }
    },
    {
      "id": "p2",
      "label": "Patient Persona",
      "model": "gemini-2.0-flash",
      "provider": "google",
      "content": "## Patient Perspective\n\nAccessibility is the primary...",
      "metadata": { "cost": 0.0071, "duration_seconds": 9.1 }
    }
  ]
}
```

**Important:** `total_phases`, `total_participants`, `flow_name`, and `estimated_duration_seconds` in `flow_started` are populated by the agent service from the flow config it already holds -- NOT from the executor status endpoint. The status endpoint only provides `current_phase`, `completed_phases`, and `elapsed_seconds`. The agent service enriches the progress data with flow config metadata.

---

### Task 2: Agent Service Progress Streaming During Tool Execution

**Intent:** Modify the agent service's tool execution path so that when `test_flow` is running, progress events are emitted to the SSE stream in real time instead of blocking silently for 10-120 seconds.

**Context:** Today, `handler.ts` (lines 246-303) calls `tool.execute(toolCall.input, session)` and awaits the result. For `test_flow`, this is a blocking HTTP call to the executor API (`test-flow.ts`, lines 446-457) that can take up to 120 seconds. During this time, no SSE events are emitted -- the user sees nothing. The executor already has a status polling endpoint (`GET /execute/{execution_id}/status` in `executor_api/api.py`, line 543) that returns `current_phase`, `completed_phases`, and `elapsed_seconds`. The agent service can poll this endpoint while waiting for the main `/execute` response to return.

The approach: when `test_flow` starts executing, emit a `flow_started` event immediately. Then, in parallel with the blocking `/execute` call, start a polling loop that hits `GET /execute/{execution_id}/status` every 2-3 seconds and emits `flow_progress` events. When the `/execute` call returns, emit `flow_completed` (or `flow_error`).

**Expected behavior:** When the agent calls `test_flow`, the SSE stream immediately shows `flow_started`. Every 2-3 seconds, a `flow_progress` event arrives with the current phase name, completed participants count, and elapsed time. When the executor finishes, `flow_completed` arrives with cost and timing data. The handler then continues its normal flow: storing the tool result and letting Claude analyze the results.

**Key components:**
- `conclave_ui/agent-service/src/tools/test-flow.ts` -- modify `testFlow()` to accept an event emitter/callback and to return the `execution_id` from the executor early
- `conclave_ui/agent-service/src/agent/handler.ts` -- modify the tool execution block (lines 246-303) to handle `test_flow` specially: emit progress events via the SSE writer while the tool executes
- New utility: a polling function that calls `GET /execute/{execution_id}/status` and yields progress events

**Notes:**

**CRITICAL ARCHITECTURE: The split-start/poll-and-yield pattern.**

The current `handler.ts` is an `AsyncGenerator<AgentEvent>`. During `await tool.execute(...)`, the generator is suspended and cannot yield events. To emit progress events during tool execution, the handler must NOT await the full tool result in one shot. Instead, use this pattern:

```typescript
// In handler.ts, when the tool is test_flow:
if (toolCall.name === "test_flow") {
  // Step 1: Start execution in background, get execution_id immediately
  const executionId = uuidv4();
  const executionPromise = startFlowExecution(toolCall.input, session, executionId);

  // Step 2: Emit flow_started
  yield { type: "flow_started", execution_id: executionId, flow_name: flowConfig.name, ... };

  // Step 3: Poll-and-yield loop
  let result = null;
  while (!result) {
    // Race between: (a) execution completing, (b) poll interval
    const raceResult = await Promise.race([
      executionPromise.then(r => ({ type: "done" as const, result: r })),
      sleep(2500).then(() => ({ type: "poll" as const, result: null })),
    ]);

    if (raceResult.type === "done") {
      result = raceResult.result;
      yield { type: "flow_completed", ... };
    } else {
      // Poll executor status and yield progress
      const status = await pollExecutionStatus(executionId);
      if (status) {
        yield { type: "flow_progress", current_phase: status.current_phase, ... };
      }
    }
  }

  // Step 4: Continue normal handler flow with the result
  yield { type: "tool_result", tool: "test_flow", result };
}
```

`startFlowExecution` fires the POST to `/execute` (with the client-generated `execution_id`) and returns a Promise that resolves when the executor responds. The Promise runs in the background while the generator polls and yields. This is approach (a) from the review: "split testFlow into start + poll loop."

The executor's `/execute` endpoint is synchronous -- it returns a complete JSON payload only after the entire flow finishes. It does NOT stream. However, the executor registers execution state in `execution_registry` and updates `current_phase` and `completed_phases` as it runs. The status endpoint reads from this registry. This means we CAN poll for progress, but we CANNOT get per-participant progress within a parallel phase -- we only get phase-level granularity. See Assumption A5 for details.

**`Promise.race` completion ordering:** When the execution completes between two poll intervals, the next `Promise.race` may resolve with either the execution result (`type: "done"`) or the poll timer (`type: "poll"`). The handler must check for completion first. After the race resolves, check if `executionPromise` has settled (e.g., via a `done` flag set by `.then()`) before issuing a poll. If the execution completed but the race resolved with `type: "poll"`, skip the poll and handle the completed result instead. This avoids a redundant poll after the execution is already finished.

**Error handling for the polling loop:** If 3 consecutive polls fail with network errors (executor crash), stop polling and emit `flow_error`. Use a `pollFailureCount` counter that resets on each successful poll.

**Port note:** The polling URL must use the existing `EXECUTOR_URL` constant from `test-flow.ts` (which defaults to `http://localhost:8000`, NOT 8553 as documented in CLAUDE.md). Do not hardcode a different port. The `start_poc.sh` script may override the port via the `EXECUTOR_URL` environment variable.

---

### Task 3: Frontend Progress Event Handler in use-agent-chat

**Intent:** Extend the `useAgentChat` hook to recognize and handle the new flow progress SSE events (`flow_started`, `flow_progress`, `flow_completed`, `flow_cancelled`, `flow_error`, `workspace_update`) and expose the current flow execution state to the UI.

**Context:** The SSE event handler is in `use-agent-chat.ts` (lines 264-367). It uses a `switch` statement on `event.type` to handle each event kind. Currently it handles: `connected`, `text`, `tool_use`, `tool_result`, `flow_created`, `error`, `done`. The new flow progress events need new cases in this switch plus new state exposed from the hook.

**Expected behavior:** The hook exposes a new `flowExecution` state object:

```typescript
interface FlowExecutionState {
  isRunning: boolean;
  executionId: string | null;
  flowName: string | null;
  currentPhase: string | null;
  phaseIndex: number;
  totalPhases: number;
  completedParticipants: number;
  totalParticipants: number;
  elapsedSeconds: number;
  status: "idle" | "running" | "completed" | "cancelled" | "error";
}
```

When `flow_started` arrives, `flowExecution` transitions to running. Each `flow_progress` event updates the phase and participant counts. `flow_completed`, `flow_cancelled`, and `flow_error` transition back to idle. The `workspace_update` event stores the artifacts and view_hint in a new `workspaceData` state that the workspace renderer consumes.

**Key components:**
- `conclave_ui/conclave-app/lib/hooks/use-agent-chat.ts` -- add new state, new switch cases, expose `flowExecution` and `workspaceData` from the hook return
- `conclave_ui/conclave-app/lib/types/agent-chat.ts` -- ensure the SSEEvent union includes the new types from Task 1

**Notes:** The `flowExecution` state must reset cleanly on session clear, new session, and error. Be careful with the `workspace_update` event -- it can arrive multiple times in a session (once per flow run). The `workspaceData` should be an array or map keyed by `execution_id`, not a single value, so previous workspace data is preserved in the session tree. However, for V1, a single "current workspace" value is acceptable -- the session tree (from Wave 3) can look up historical results from session events.

The `sendCancel` function (for Task 5) should also be exposed from this hook. It will call `POST /sessions/:id/cancel`.

---

### Task 4: Flow Progress Indicator Component

**Intent:** Build a React component that renders real-time flow execution progress, showing phase name, model completion count, elapsed time, and a visual progress bar.

**Context:** This component consumes the `flowExecution` state from the `useAgentChat` hook (Task 3). It appears in the workspace panel when a flow is running, replacing or overlaying the current workspace content. When the flow completes, this component transitions into the results view (the workspace view from Tasks 8-12).

**Expected behavior:** The progress indicator shows:
- Flow name at the top (e.g., "Running: 5-Persona Exploration")
- Current phase name with index (e.g., "Phase 1 of 2: Exploration")
- A determinate progress bar showing completed phases / total phases (NOT per-participant)
- An elapsed time counter (updates every second via `setInterval`, client-side)
- An estimated time remaining (e.g., "Typically completes in 20-40s" based on participant count and phase count)
- A Cancel button (wired in Task 6)
- Subtle animation (pulse or shimmer on the progress bar) to indicate activity

The component uses the existing glass-card design system (see `cost-estimator.tsx` for the pattern: `glass-card backdrop-blur-xl`, `border-white/10` borders, purple accents).

**Important: Do NOT show per-model indicators** (e.g., "Claude: done, GPT: running"). The executor does NOT report per-participant progress within a parallel phase (A5). Showing model-level indicators that never update would be worse than not showing them. Instead, show honest phase-level progress with an elapsed timer. For single-phase flows (common case: all models run in parallel in one phase), the indicator shows "Running 5 models in parallel... 18s elapsed (typically 20-40s)". This is transparent about what is actually happening.

**Single-phase flow visual feedback:** For the most common flow pattern (all models run in one parallel phase), the determinate progress bar shows no intermediate states -- it is either empty or full. The elapsed timer alone is insufficient visual feedback for 30-45 seconds of waiting. To maintain the feeling of activity, add a subtle shimmer or pulsing glow animation on the progress bar when the flow is running and the progress bar has not changed position for more than 3 seconds. Additionally, consider rotating through contextual "thinking" messages below the timer (e.g., "Models are analyzing your prompt...", "Generating diverse perspectives...", "Synthesizing responses...") on a 5-second cycle. These messages are cosmetic -- they do not reflect actual executor state -- but they maintain engagement during long single-phase waits.

**Key components:**
- New: `conclave_ui/conclave-app/components/sessions/flow-progress.tsx`
- Depends on: `FlowExecutionState` type from Task 3
- Design reference: `conclave_ui/conclave-app/components/flows/cost-estimator.tsx` (glass-card pattern)

**Notes:** The elapsed time counter must use a `useEffect` + `setInterval` that starts when `flowExecution.isRunning` becomes true and clears when it becomes false. Do not rely solely on the `elapsed_seconds` from SSE events -- those arrive every 2-3 seconds, which makes the timer look jumpy. Instead, store the `flow_started` timestamp locally and compute elapsed time client-side, using the SSE `elapsed_seconds` as a correction/sync point.

Per-participant progress is limited to counts, not per-model status (see Assumption A5). Show "3/5 models complete" not "Claude: done, GPT: running, Gemini: waiting." If the executor later adds per-participant streaming, the progress indicator can be upgraded without changing the event contract.

---

### Task 5: Cancellation Endpoint and AbortController Wiring

**Intent:** Add a `POST /sessions/:id/cancel` endpoint to the agent service that sets a cancellation flag and aborts the in-flight executor HTTP request. Wire this to the frontend via a `sendCancel` function on the `useAgentChat` hook.

**Context:** The agent service currently has no cancel mechanism. However, `test-flow.ts` (line 448) already creates an `AbortController` for timeout handling. The pattern is already there -- we just need to make the controller accessible from outside the `testFlow` function so that a cancel request can call `controller.abort()`.

On the executor side, cancellation is already implemented: `POST /cancel/{execution_id}` (defined in `api.py`, lines 718-758) sets `cancel_requested = True` in the execution registry. The executor checks this flag between phases (`executor_v2.py`, lines 971-982) and between parallel participants (line 698). However, the executor does NOT cancel in-progress LLM API calls -- it finishes the current call and then stops.

**Expected behavior (sequencing is critical):**

1. Frontend calls `POST /api/sessions/:sessionId/cancel`
2. Agent service receives the request and retrieves the active `execution_id` for the session
3. Agent service sends `POST /cancel/{execution_id}` to the executor **FIRST** (fire-and-forget, no await needed)
4. Agent service then calls `.abort()` on the `AbortController` for the session's executor fetch
5. The fetch in `test-flow.ts` throws `AbortError`, which is caught and returns a `flow_cancelled` result
6. The SSE stream emits `flow_cancelled` with the list of completed phases
7. The frontend hook updates `flowExecution.status` to `"cancelled"` and clears the progress indicator

**The cancel POST must fire BEFORE the fetch abort.** If the abort fires first, control flow jumps to the catch block and the cancel POST may never be sent. The executor cancel endpoint is fire-and-forget -- the agent service does not need to wait for its response. If the executor already finished and cleaned up the registry entry, the cancel returns 404, which is harmless.

**Key components:**
- `conclave_ui/agent-service/src/tools/test-flow.ts` -- expose the `AbortController` so it can be triggered externally
- `conclave_ui/agent-service/src/agent/handler.ts` -- store the active executor `AbortController` on the session
- New route: `POST /api/sessions/:id/cancel` in the agent service Express router
- `conclave_ui/conclave-app/lib/hooks/use-agent-chat.ts` -- add `sendCancel()` to the hook return
- Executor API: no changes needed (cancellation endpoint already exists at `POST /cancel/{execution_id}`)

**Notes:** There is a race condition: the user clicks Cancel right as the executor finishes. The `AbortController.abort()` call arrives after the fetch has already resolved. This is fine -- the abort is a no-op on a completed request. The agent service should handle this gracefully: if the tool result has already been received, ignore the cancel request and let the normal flow continue.

The `AbortController` and `executionId` for the executor fetch must be stored in a place accessible from the cancel route. Two options: (a) store them on the `Session` object (add optional `activeAbortController` and `activeExecutionId` fields), or (b) use a module-level `Map<sessionId, { abortController: AbortController, executionId: string }>`. Option (a) is cleaner because it ties the lifecycle to the session. Option (b) avoids modifying the Session type for transient concerns. Recommendation: Option (b) -- a module-level map in `test-flow.ts` that maps session IDs to `{ abortController, executionId }` tuples, cleaned up after each execution. The cancel route reads the `executionId` from this map to send `POST /cancel/{execution_id}` to the executor, and then calls `abortController.abort()` to abort the in-flight fetch.

---

### Task 6: Cancel Button UI with Session State Preservation

**Intent:** Add a Cancel button to the flow progress indicator that calls `sendCancel()` and ensures the session state (conversation history, previous results, session tree) is fully preserved after cancellation.

**Context:** The Cancel button lives inside the `FlowProgress` component (Task 4). It calls `sendCancel()` from the hook (Task 5). The key concern is that cancellation must NOT corrupt session state. The conversation history up to the cancelled flow must remain intact. The session tree should show the cancelled flow as "Cancelled" (not "Failed" -- cancellation is intentional, failure is not).

**Expected behavior:** The user clicks Cancel. The UI transitions **immediately** to ready state -- do NOT wait for the executor to confirm the stop. The executor's cooperative cancellation (between phases/participants) may take 5-30 seconds to actually halt. Let the executor wind down silently in the background. From the user's perspective:

1. User clicks Cancel.
2. Button briefly shows "Cancelling..." (200-500ms max).
3. Progress indicator disappears. The workspace shows a compact "Flow cancelled" banner with completed phases listed.
4. The cancelled flow entry appears in the session tree as a greyed-out node with a "Cancelled" label.
5. The input bar is immediately ready for the next message. `isSendingRef` is reset.
6. All prior conversation history and flow results remain accessible.

**Key components:**
- `conclave_ui/conclave-app/components/sessions/flow-progress.tsx` -- add Cancel button with loading state
- `conclave_ui/conclave-app/lib/hooks/use-agent-chat.ts` -- ensure `sendCancel()` cleans up streaming state (`isStreaming`, `isConnecting`)
- Session tree component (from Wave 3) -- render cancelled flows distinctly

**Notes:** The Cancel button should require a single click, not a confirmation dialog. Cancellation is cheap (see Assumption A8) and the user should not be punished with friction for changing their mind. If someone repeatedly starts and cancels flows, that is a sign they are iterating on their prompt -- which is exactly the behavior sessions are designed to support.

Edge case: the user clicks Cancel and immediately sends a new message. The `isSendingRef` guard in `use-agent-chat.ts` (line 150) must be reset when cancellation completes, not just on normal flow completion. Otherwise the user gets stuck in a "can't send" state after cancelling.

---

### Task 7: Shared Markdown Content Component

**Intent:** Build a shared `<MarkdownContent>` component used by all workspace views (Tasks 8-12) that renders LLM output as formatted markdown with code syntax highlighting, copy button, and consistent typography.

**Context:** Every workspace view needs to render LLM output, which is markdown. The existing codebase has `react-markdown` (v10.1.0) and `react-syntax-highlighter` (v16.1.0) installed in `conclave_ui/conclave-app/package.json`. The existing `ModelResponse` component (`conclave_ui/conclave-app/components/flows/model-response.tsx`) renders content as plain `whitespace-pre-wrap` text without markdown parsing. The workspace views need proper markdown rendering: headings, paragraphs, lists, code blocks with syntax highlighting, blockquotes, and tables.

**Expected behavior:** A `<MarkdownContent content={markdownString} />` component that:
- Renders markdown headings (h1-h6) with appropriate sizing and spacing
- Renders code blocks with syntax highlighting via `react-syntax-highlighter` (using `oneDark` or `atomOneDark` theme for dark mode)
- Renders inline code with a subtle background
- Renders tables with the glass-card border style
- Renders blockquotes with a left border accent
- Renders lists (ordered and unordered) with proper indentation
- Has a copy-to-clipboard button for code blocks
- Uses readable typography: 16px body text, 1.7 line-height, prose-invert Tailwind class

Additionally, install `remark-gfm` (GitHub Flavored Markdown) to support tables, strikethrough, and task lists. `rehype-highlight` is not needed since `react-syntax-highlighter` is already installed and provides more control over the highlight theme.

**Key components:**
- New: `conclave_ui/conclave-app/components/sessions/markdown-content.tsx`
- Uses: `react-markdown` (already installed)
- Uses: `react-syntax-highlighter` (already installed)
- Add: `remark-gfm` to `conclave_ui/conclave-app/package.json`
- Design reference: `conclave_ui/conclave-app/components/flows/model-response.tsx` for the container styling

**Notes:** This component is the foundation for all 5 workspace views. Build it first, then each view wraps it with its own layout. The component should accept optional `className` and `maxWidth` props so views can control their layout. For the document view, use `max-w-prose` (65ch) for readable line length. For the card grid, use full-width within each card. Typography classes should use Tailwind's `prose prose-invert prose-sm md:prose-base` for responsive sizing on dark backgrounds.

**Prior art -- existing provider color constants:** The codebase has two existing provider color mappings that must be consolidated rather than duplicated:
- `conclave_ui/conclave-app/components/flows/model-response.tsx` (lines 18-48): defines `PROVIDER_COLORS` with per-provider gradient and accent colors.
- `conclave_ui/conclave-app/components/flows/results-display.tsx` (lines 86-111): defines `MODEL_TAB_COLORS` with background, border, and text colors per provider.
- `conclave_ui/conclave-app/components/flows/flow-summary.tsx`: defines `PROVIDER_COLORS` with hex values: Anthropic = `#f97316` (orange), OpenAI = `#22c55e` (green), Google = `#3b82f6` (blue), xAI = `#a855f7` (purple).

These should be extracted into a shared constants file (e.g., `conclave_ui/conclave-app/lib/constants/provider-colors.ts`) rather than duplicated in the new workspace views. All workspace views should import from this shared module for provider badges, tab colors, and accent styling.

**Workspace view props interface (shared by all views):**

```typescript
// conclave_ui/conclave-app/lib/types/workspace.ts
type ViewHint = "card_grid" | "tabbed_view" | "comparison" | "document" | "flow_diagram";

interface Artifact {
  id: string;
  label: string;           // Display name (e.g., "Caregiver Persona")
  model?: string;          // Model that produced this (e.g., "gemini-2.0-flash")
  provider?: string;       // Provider name (e.g., "google")
  content: string;         // The actual output text (markdown)
  metadata?: Record<string, unknown>;  // Extensible metadata (cost, duration, etc.)
}

interface WorkspaceViewProps {
  artifacts: Artifact[];
  executionId?: string;
  className?: string;
}
```

Content is always a string (markdown). The individual view components render it through `<MarkdownContent>`. This keeps the artifact shape simple and the rendering logic centralized.

---

### Task 8: Card Grid Workspace View

**Intent:** Build the `CardGridView` component that renders multiple artifacts as a responsive grid of cards. This is the primary view for persona explorations and parallel multi-model outputs where each result is a peer.

**Context:** A card grid is the natural layout when the user runs N models or N personas in parallel and wants to scan all outputs quickly. Each card shows the artifact label, model badge, and scrollable content area. The grid is responsive: 1 column on narrow screens, 2 columns on medium, 3 columns on wide screens.

**Expected behavior:** The component renders a CSS Grid of cards. Each card is a glass-card container (consistent with the design system) with:
- Header: artifact label (bold) + model/provider badge (small, colored by provider)
- Body: markdown-rendered content with scroll if content exceeds card height
- Footer: optional metadata (cost, tokens, execution time)

Cards have equal height within each row (CSS `grid-auto-rows: 1fr` or flex). Scrolling within a card does not scroll the whole grid. Clicking a card could expand it to full-width (stretch goal, not required for V1).

**Key components:**
- New: `conclave_ui/conclave-app/components/sessions/views/card-grid-view.tsx`
- Depends on: `WorkspaceViewProps` from Task 7
- Depends on: a markdown renderer (check if one exists in the codebase, otherwise use `react-markdown`)

**Notes:** The card grid must handle 1 to 10+ artifacts gracefully. With 1-2 artifacts, the cards should expand to fill width (not tiny cards in a corner). With 10+, a scroll container around the grid is needed. Provider badge colors should be consistent with the existing Conclave color scheme for providers (Anthropic = purple, OpenAI = green, Google = blue, xAI = red). Check `conclave_ui/conclave-app` for existing provider color mappings.

Markdown rendering is required because LLM outputs frequently contain headers, lists, bold text, and code blocks. Use `react-markdown` with `remark-gfm` for GitHub-flavored markdown. Code blocks should use syntax highlighting (`rehype-highlight` or `react-syntax-highlighter`). This markdown rendering infrastructure will be shared across all workspace views.

---

### Task 9: Tabbed Workspace View

**Intent:** Build the `TabbedView` component that renders multiple artifacts as a tabbed interface where only one artifact is visible at a time, with tabs for switching between them.

**Context:** The tabbed view is appropriate when artifacts are long (multi-page outputs) and comparing them side-by-side would be cramped. It is the natural layout for parallel model outputs where each output is substantial -- e.g., three different models each writing a 2-page analysis.

**Expected behavior:** The component renders a horizontal tab bar at the top with one tab per artifact. Each tab shows the artifact label and model badge. The active tab's content renders below in a full-width scrollable area with markdown rendering. Switching tabs is instant (all content is pre-rendered but only one is visible). Keyboard navigation: left/right arrows switch tabs. The active tab has a visual indicator (underline or highlight) consistent with the glass-card design system.

**Key components:**
- New: `conclave_ui/conclave-app/components/sessions/views/tabbed-view.tsx`
- Depends on: `WorkspaceViewProps` from Task 7
- Depends on: shared markdown renderer from Task 8

**Notes:**

**Prior art -- `results-display.tsx`:** The existing `conclave_ui/conclave-app/components/flows/results-display.tsx` already implements a tabbed flow results interface using `@radix-ui/react-tabs`. It includes model color mapping (`MODEL_TAB_COLORS`), copy buttons, a stats footer, and handles both round-robin and hub-spoke flows. While the new `TabbedView` serves a different context (session workspace vs. standalone flow results page), there is significant overlap in tab rendering, model badges, content display, and stats. Extract shared utilities (provider color mapping, stat formatting, copy-to-clipboard logic) into shared modules rather than duplicating them. Use `results-display.tsx` as a reference implementation for tab behavior and styling patterns.

Tab overflow (more tabs than fit horizontally) should be handled with horizontal scrolling of the tab bar, not wrapping to multiple rows. Show left/right scroll indicators if tabs overflow. `@radix-ui/react-tabs` v1.1.13 is already installed (`package.json`) -- use it for the tab component.

---

### Task 10: Comparison (Side-by-Side) Workspace View

**Intent:** Build the `ComparisonView` component that renders exactly two artifacts side-by-side with synchronized scrolling, optimized for comparing two model outputs or two versions of a result.

**Context:** The comparison view is ideal for "Claude vs. GPT" debates or "before and after" comparisons. It is the view_hint the agent should use when exactly two artifacts are produced and the intent is contrastive analysis.

**Expected behavior:** Two equal-width panels, side-by-side, each rendering one artifact. Each panel has a header (label + model badge) and a scrollable markdown-rendered content area. Scroll positions are synchronized: scrolling one panel scrolls the other to the same relative position. A divider (thin vertical line) separates the panels. On narrow screens (< 768px), the panels stack vertically instead of side-by-side.

If more than two artifacts are passed, the component renders the first two and shows a "Showing 2 of N" indicator with a dropdown to swap which artifacts are being compared.

**Key components:**
- New: `conclave_ui/conclave-app/components/sessions/views/comparison-view.tsx`
- Depends on: `WorkspaceViewProps` from Task 7
- Depends on: shared markdown renderer from Task 8

**Notes:** Synchronized scrolling requires tracking the scroll percentage (not pixel offset, since content heights may differ). Use `onScroll` events with `scrollTop / (scrollHeight - clientHeight)` to compute the scroll ratio, then apply it to the other panel. Debounce or use `requestAnimationFrame` to avoid scroll feedback loops.

---

### Task 11: Document Workspace View with Markdown Rendering

**Intent:** Build the `DocumentView` component that renders a single artifact as a full-width, readable document. This is both the view for single-model outputs and the universal fallback for unknown view_hints.

**Context:** The document view is the simplest workspace view but also the most important -- it is the default. Every `workspace_update` event with an unknown or missing `view_hint` renders as a document. It is the natural layout for product briefs, synthesis outputs, and single-model responses.

**Expected behavior:** Full-width content area with rendered markdown. Clean typography: headings, paragraphs, lists, code blocks, blockquotes all render correctly. Content is scrollable. If multiple artifacts are passed (unexpected for document view), they render sequentially with dividers between them. The document respects the existing glass-card design system: semi-transparent background, subtle borders, readable text on dark background.

**Key components:**
- New: `conclave_ui/conclave-app/components/sessions/views/document-view.tsx`
- Depends on: `WorkspaceViewProps` from Task 7
- Depends on: shared markdown renderer from Task 8

**Notes:** Typography for the document view should be optimized for long-form reading. Use a larger font size than the chat panel (16-18px body text), generous line height (1.6-1.8), and max-width constraint (720-800px centered) to maintain readable line length. Code blocks should use a monospace font with syntax highlighting and a copy button. These styling choices should be encapsulated in a shared `<MarkdownContent>` component that other views also use.

---

### Task 12: Flow Diagram Workspace View

**Intent:** Build the `FlowDiagramView` component that renders a visual representation of a flow's structure: phases, participants, and connections.

**Context:** The flow diagram view shows the user what their flow looks like -- which models participate in which phases, how data flows between phases, and where they are in execution. It is useful both during execution (showing progress) and after completion (showing the execution path).

**Expected behavior:** A horizontal or vertical diagram showing:
- Phases as labeled boxes, arranged in execution order (left-to-right or top-to-bottom)
- Participants within each phase as smaller nodes inside the phase box
- Arrows showing data flow between phases (especially variable references like `{{phases.X.output}}`)
- Color coding: completed phases in green, current phase pulsing, upcoming phases in grey, failed phases in red

This view does NOT need a full graph library. A CSS-based layout with flexbox/grid and SVG arrows is sufficient for V1.

**Key components:**
- New: `conclave_ui/conclave-app/components/sessions/views/flow-diagram-view.tsx`
- Depends on: `WorkspaceViewProps` from Task 7

**Notes:** The flow diagram view has a different data shape than other views. Instead of `artifacts` (model outputs), it needs the flow configuration (phases, participants, connections). The `workspace_update` event for a flow diagram should include flow metadata in the `metadata` field of the artifact, or use a special artifact format. Define this in the type system (Task 7).

Keep V1 simple: use CSS flexbox for layout, simple div boxes for phases, and SVG `<line>` elements for arrows. Do not pull in a heavyweight graph library (e.g., ReactFlow, D3) for V1 -- that is overengineering for what is essentially a 2-5 node diagram. If the diagram becomes more complex in V2 (branching, conditionals), migrate to ReactFlow then.

---

### Task 13: Persistent Input Bar (Full-Width, Always Visible)

**Intent:** Ensure the chat input bar remains visible and functional at the bottom of the screen at all times, even when the workspace expands to full-width and the chat panel collapses.

**Context:** The high-level plan (`_high_level_planning.md`, lines 73-77) specifies two session states: "Conversing" (two-panel layout with chat on the right) and "Reviewing" (workspace full-width, chat panel collapsed). In both states, the input bar must be visible. The Wave 3 two-panel layout (not yet built) will define the basic container structure. This task ensures the input bar is architecturally independent of the chat panel -- it lives at the bottom of the session page, outside the two-panel container, spanning full width.

**Expected behavior:** The input bar is always visible at the bottom of the session page, regardless of workspace/chat panel state. When the chat panel is open (Conversing mode), the input bar spans the full width below both panels. When the workspace is full-width (Reviewing mode), the input bar spans the full width below the workspace. The input bar contains: a text input field, a send button, and an expand/collapse icon for the chat panel. The text input supports multi-line entry (shift+enter for newlines, enter to send).

**Key components:**
- New or modified: `conclave_ui/conclave-app/components/sessions/persistent-input-bar.tsx`
- Wave 3 dependency: the session page layout component must position the input bar outside/below the two-panel container
- Depends on: existing input bar styling from the chat component (check `conclave_ui/conclave-app/components/chat/` for the current input implementation)

**Notes:** The input bar must be positioned with `position: sticky; bottom: 0` or `position: fixed; bottom: 0` depending on the layout approach. Sticky is preferred because it participates in the document flow. If the Wave 3 session layout uses a flex column, the input bar can be the last child with `flex-shrink: 0` (never collapses).

The input bar must remain functional during flow execution. Users frequently compose their follow-up message while waiting for a flow to complete (30-120 seconds is a long time to sit idle). Blocking input during this wait is frustrating. The send button should remain **enabled** during flow execution. When the user types a message and hits send while a flow is running, the message is queued locally and sent automatically after the flow completes (or after cancellation). The input field shows a subtle indicator (e.g., "Message will send after flow completes") so the user knows their message was received but deferred. If queuing adds too much complexity for V1, an acceptable fallback is to keep the text input enabled for typing (so users do not lose their train of thought) but defer the actual send -- show the send button in a "queued" state with a tooltip: "Will send when the current flow finishes." The key principle: never clear or disable the text input itself during execution.

---

### Task 14: Workspace-to-Chat Toggle and View Override Dropdown

**Intent:** Add two controls to the workspace/input area: (1) an expand/collapse icon on the input bar that toggles the chat panel's visibility, and (2) a view-mode dropdown in the workspace header that lets the user override the agent's `view_hint` selection.

**Context:** When the user is reviewing flow results in the full-width workspace, the chat panel is hidden. The input bar is their only connection to the conversation. The expand icon on the input bar is the affordance for bringing the full chat history back into view. The view-mode dropdown addresses UX-GAP-2: the agent may pick the wrong layout for the content (e.g., `card_grid` when the user prefers `tabbed_view`), and there is no way for the user to override it.

**Expected behavior:**

**Chat panel toggle:**
A small icon (e.g., `PanelRightOpen` from lucide-react) sits at the right end of the input bar. Clicking it toggles the chat panel:
- If chat panel is hidden: it slides in from the right, shrinking the workspace to accommodate it. The icon changes to `PanelRightClose`.
- If chat panel is visible: it slides out to the right, expanding the workspace to full-width. The icon changes to `PanelRightOpen`.

The transition is animated (200-300ms, ease-in-out). The workspace content reflows smoothly during the transition. The input bar itself does not move or resize -- only the panels above it change.

**View override dropdown:**
A small dropdown (e.g., `Select` from shadcn/radix) in the workspace header bar, positioned next to the breadcrumb. It shows the current view mode (e.g., "Card Grid") and offers all 5 view options. When the user selects a different view, the workspace immediately re-renders using the new view component, passing the same artifacts. This is a client-side override only -- it does not change the `view_hint` stored in session events. If a new `workspace_update` arrives, the override resets to the agent's new suggestion.

The dropdown is small and unobtrusive -- it should not dominate the workspace header. A `LayoutGrid` icon from lucide-react next to the dropdown gives it an affordance without being noisy.

**Key components:**
- `conclave_ui/conclave-app/components/sessions/persistent-input-bar.tsx` -- add the toggle icon
- `conclave_ui/conclave-app/components/sessions/workspace-renderer.tsx` -- add `viewOverride` state and the dropdown
- Wave 3 dependency: the session layout must expose a `chatPanelVisible` state and a `toggleChatPanel` callback
- Animation: CSS transitions on the panel widths

**Notes:** The toggle state should persist within the session (if the user closes the chat panel, it stays closed until they reopen it). But it should NOT persist across sessions -- each new session starts in Conversing mode. Use component state, not localStorage or Supabase, for this toggle.

The workspace must handle width changes gracefully. Card grids should reflow columns. Tabbed views and document views should expand to fill available width. Comparison view should keep its two-panel layout regardless of container width.

---

### Task 15: Integration Testing: Flow Execution Through Session UI

**Intent:** End-to-end test that validates the complete Wave 4 flow: start a session, send a message that triggers a flow, observe progress streaming, see results render in the correct workspace view, cancel a flow, and verify session state is preserved throughout.

**Context:** This is not a unit test task -- it is a manual or semi-automated integration test that exercises the entire stack: frontend -> agent service (SSE) -> executor API -> back. It validates that all Wave 4 features work together.

**Expected behavior:** The following scenario completes successfully:

1. Open a session. Send a message asking the agent to run a multi-model flow.
2. Observe: `flow_started` event appears, progress indicator shows in workspace.
3. Observe: `flow_progress` events update the progress indicator every 2-3 seconds.
4. Observe: `flow_completed` event arrives, progress indicator transitions to results view.
5. Observe: results render using the correct `view_hint` (e.g., card_grid for parallel outputs).
6. Type a follow-up message in the persistent input bar without reopening the chat panel.
7. Start another flow, then click Cancel.
8. Observe: flow stops, session state is preserved, input bar is ready.
9. Toggle the chat panel open from the input bar, verify full conversation history is visible.

**Key components:**
- All components from Tasks 1-14
- Test can use Playwright (check `conclave_ui/conclave-app` for existing Playwright config) or manual testing with the development stack running

**Notes:** If the executor API is not running during testing, the progress streaming and cancellation tests will fail. Ensure all three services are up: Next.js frontend (port 4100), Agent Service (port 8554), Executor API (port 8553). Use `npm run dev:full` from `conclave-app/` or `bash scripts/health_check.sh` to verify.

For automated testing, consider mocking the executor API response to avoid real LLM costs. A mock executor that sleeps for 5 seconds per phase and returns canned results would be sufficient to validate the streaming/cancellation flow.

**Mock executor for CI/CD:** The integration test as described requires all three services running with real LLM API keys, which is not viable for CI/CD pipelines. Add a lightweight mock executor (e.g., a small Express or FastAPI server) that: (1) accepts `/execute` requests, (2) registers the execution in a local registry, (3) sleeps for a configurable duration per phase (default 3 seconds), (4) updates the status registry between phases, (5) responds to `GET /execute/{execution_id}/status` polls, (6) responds to `POST /cancel/{execution_id}`, and (7) returns canned results with realistic structure. This enables automated testing of the full streaming/cancellation/progress flow without LLM costs. The mock should be configurable via environment variable (e.g., `EXECUTOR_MOCK=true`) so the same test script works in both local (real executor) and CI (mock executor) modes.

---

## Assumptions Register

> Every implementation plan rests on assumptions. Some are verified facts, others are educated guesses, and some turn out to be wrong. This register makes them explicit so they can be challenged before code is written, not after.
>
> **How to use:** Fill this table during planning. During review, a senior engineer or research agent validates each assumption against source code, documentation, or online research. Update the verdict accordingly.

| # | Assumption | Category | Verdict | Evidence |
|:-:|-----------|:--------:|:-------:|----------|
| A1 | The executor API does NOT support response streaming. It returns a complete JSON payload only after the entire flow finishes. | API | Confirmed | `executor_api/api.py` line 289: `@app.post("/execute", response_model=ExecuteResponse)` returns a Pydantic model, not a streaming response. `run_flow_v2` (in `executor_v2.py`) runs all phases sequentially and returns a single `FlowResult`. There is no `StreamingResponse` or SSE endpoint on the executor. |
| A2 | The executor API has a working status polling endpoint that reports phase-level progress during execution. | API | Confirmed | `executor_api/api.py` lines 543-578: `GET /execute/{execution_id}/status` reads from `execution_registry` and returns `current_phase`, `completed_phases`, and `elapsed_seconds`. The registry is updated by `update_execution_phase()` and `complete_phase()` at lines 984-985 and 1050-1051 of `executor_v2.py`. |
| A3 | The executor already supports cancellation via `POST /cancel/{execution_id}`, and it checks for cancellation between phases. | API | Confirmed | `executor_api/api.py` lines 718-758: cancel endpoint exists. `executor_v2.py` lines 971-982: cancellation is checked before each phase. Lines 697-699: also checked before each parallel participant. Cancellation is cooperative -- it stops between phases, not mid-LLM-call. |
| A4 | When the HTTP connection from the agent service to the executor drops (e.g., via AbortController), the executor does NOT stop processing. It continues running the flow to completion in the background. | API | **Confirmed** | `api.py` line 452: `result = await run_flow_v2(...)` runs inline in the async handler (NOT as a background task). FastAPI does not cancel the asyncio task on client disconnect. The flow completes in the background; results are lost if the client is gone. The `await` suspends the endpoint handler for the entire duration (10-120s), but FastAPI's async architecture allows other requests (including status polls) to be handled concurrently because the event loop is not blocked -- internal `asyncio.gather` yields between phases. |
| A5 | The executor does NOT report per-participant progress within a parallel phase. We can only know "phase X started" and "phase X completed," not "participant 2 of 5 in phase X is done." | API | **Confirmed** | `execute_parallel_phase` (`executor_v2.py` lines 673-752) uses `asyncio.gather` to run all participants concurrently. The `progress_callback` is called at the phase level only (lines 987-988, 1053-1054). Individual participant results are collected by `asyncio.gather` and returned as a batch. The `ExecutionStatusResponse` schema (`schemas.py` lines 113-128) has `current_phase` and `completed_phases` but no `completed_participants` field. **Task 4 has been updated to show phase-level progress only, not per-model indicators.** |
| A6 | The `execution_id` can be generated by the agent service (client-side) and passed to the executor in the request. This enables status polling to begin immediately after the `/execute` call starts. | API | **Confirmed -- requires executor schema change** | `run_flow_v2` (`executor_v2.py` line 917) accepts `execution_id: Optional[str] = None` and generates one only if not provided (line 943-944). However, the `ExecuteRequest` schema (`schemas.py` lines 32-55) does NOT include an `execution_id` field, and the `/execute` endpoint does not pass `execution_id` to `run_flow_v2`. **Task 0 has been added** as a prerequisite to make this two-line executor change. Without it, polling requires retry-on-404 during the 50-500ms race window between POST start and execution registration, which is fragile. |
| A7 | The persistent input bar requires changes to the Wave 3 session layout, specifically: the input bar must be positioned OUTSIDE the two-panel container, as the last element in the session page flex column. | Codebase | Plausible | Wave 3 components do not exist yet (confirmed by glob: no `components/sessions/` directory). The layout design is specified in `_high_level_planning.md` lines 60-70. The input bar must be below both panels. If Wave 3 places the input bar inside the chat panel, Task 13 will need to move it out. This assumption should be communicated to whoever builds Wave 3 as a requirement. |
| A8 | The cost of wasted API calls on cancellation is negligible ($0.01-0.05 per cancel) and does not justify building a distributed cancellation protocol. | Infra | Plausible | A typical flow with 3 models costs $0.03-0.10 total (based on the pricing in `cost-estimator.tsx`). If cancellation happens mid-flow, the wasted portion is at most the cost of the in-progress LLM calls (one per participant in the current parallel phase). For a 5-model parallel phase, that is roughly $0.01-0.03 wasted. Even with aggressive cancellation (10 cancels per session), total waste is under $0.50. Not worth the engineering complexity of mid-LLM-call cancellation. |
| A9 | The workspace views (card_grid, tabbed_view, comparison, document) need markdown rendering with code syntax highlighting. | UX | Confirmed | LLM outputs regularly contain markdown formatting (headers, lists, bold, code blocks). The cost estimator (`cost-estimator.tsx`) does not render markdown, but it does not display LLM outputs. The existing chat component likely renders markdown for assistant messages. Workspace views displaying LLM outputs MUST render markdown. Code highlighting is essential for developer-focused use cases. |
| A10 | `react-markdown` is either already a dependency or can be added without conflicts. | Library | **Confirmed** | `react-markdown` v10.1.0 is installed (`conclave_ui/conclave-app/package.json`). `react-syntax-highlighter` v16.1.0 is also installed (with `@types/react-syntax-highlighter` v15.5.13). `remark-gfm` is NOT installed and must be added. `rehype-highlight` is NOT needed since `react-syntax-highlighter` provides more control. `@radix-ui/react-tabs` v1.1.13 is installed (relevant for Task 9's tabbed view). |
| A11 | The Wave 3 session UI exposes a `chatPanelVisible` state and `toggleChatPanel` callback that Task 14 can consume. | Codebase | Plausible | Wave 3 is not yet built. The architecture review specifies the two-panel layout with Conversing/Reviewing modes. The toggle mechanism must be designed during Wave 3. This assumption should be communicated as a Wave 3 output requirement. If Wave 3 does not provide this API, Task 14 will need to implement the toggle state at the session page level. |
| A12 | The current `use-agent-chat.ts` hook can be extended to support flow progress state without a rewrite. | Codebase | Confirmed | The hook already manages SSE parsing, message state, tool call tracking, and error handling. Adding new event types to the switch statement (line 265) and new state variables is incremental. The hook pattern (useState + useCallback + useRef) supports additional state. No structural changes needed -- just additions. |
| A13 | The SSE connection from frontend to agent service remains open for the entire message processing duration, including during long tool executions (up to 120s). | Codebase | **Confirmed with caveat** | `use-agent-chat.ts` lines 211-232: `while(true)` read loop with no intermediate timeout. Connection stays open. The `AbortController` (line 179) is only triggered by user action (new session) or component cleanup. **Caveat:** Production deployments behind reverse proxies (nginx, Cloudflare) may drop idle connections after 60-90 seconds. For V1 with local development, this is not an issue. For production, a `heartbeat` event (every 15-20 seconds during tool execution) should be a P1 item on the production deployment checklist. The agent service's `flow_progress` events (every 2-3 seconds) serve as implicit heartbeats during flow execution, but a dedicated heartbeat is needed during other long tool executions. |
| A14 | The executor's status polling endpoint is lightweight and can be called every 2-3 seconds without performance impact. | API | **Confirmed** | `api.py` lines 543-578: reads from in-memory `dict` (line 137: `execution_registry.get(execution_id)`). No database, no network. Response is ~200 bytes. Trivially handled even at 50+ req/s. At one session polling at 2-second intervals, this is 0.5 req/s. Even at 100 concurrent sessions, 50 req/s of in-memory dict lookups is negligible for FastAPI's async handler. |

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

**TD1: Status Polling vs. Executor Streaming for Progress**

Decision: Use status polling (agent service polls `GET /execute/{execution_id}/status` every 2-3 seconds) rather than modifying the executor to support streaming responses.

Rationale: The executor API is a stateless, synchronous service. Adding streaming would require a significant rewrite of `run_flow_v2` to yield results incrementally, changes to the FastAPI endpoint to use `StreamingResponse`, and changes to `test-flow.ts` to parse a stream instead of a JSON response. Status polling achieves the same user experience (progress updates every 2-3 seconds) with zero executor changes. The architecture review explicitly recommends no executor changes for Phase 8.

Trade-off: Polling adds 2-3 seconds of latency between an actual phase change and the user seeing it. This is acceptable for V1. If sub-second progress updates are needed later, the executor can be upgraded to stream without changing the frontend contract -- the agent service can simply emit events more frequently.

**TD2: Client-Generated execution_id for Early Polling**

Decision: The agent service generates the `execution_id` (UUID) and passes it to the executor in the `/execute` request, enabling status polling to begin immediately.

Rationale: If the executor generates the `execution_id`, the agent service does not know it until the entire execution completes (when the `/execute` response returns). This means no polling is possible during execution. By generating the ID client-side and including it in the request, the agent service can start polling `GET /execute/{execution_id}/status` immediately after sending the `/execute` request.

Implementation note: The `ExecuteRequest` schema in `executor_api/schemas.py` needs a new optional field: `execution_id: Optional[str] = None`. The `/execute` endpoint passes it to `run_flow_v2`. This is a one-line change to the schema and a one-line change to the endpoint. If this is considered out of scope for "no executor changes," the alternative is to poll with retry-on-404 until the execution registers.

**TD3: Phase-Level Progress Only (No Per-Participant)**

Decision: Progress events report phase-level granularity ("Phase 1 of 3 running") not per-participant granularity ("Model 2 of 5 in Phase 1 complete").

Rationale: The executor runs parallel participants via `asyncio.gather` and does not report individual completions to the execution registry. Adding per-participant progress would require modifying `execute_parallel_phase` to update the registry after each participant completes. While this is not a large change, it is an executor change, which the architecture review defers. The progress indicator design (Task 4) handles this gracefully by showing phase progress and elapsed time.

Future upgrade path: Add a `completed_participants` field to `ExecutionState` in `executor_v2.py`, update it in `call_executor` after each participant completes, and include it in `ExecutionStatusResponse`. The frontend event types (Task 1) already include `completed_participants` and `total_participants` fields -- they will just be `0` / `total` until the executor supports them.

**TD4: Module-Level AbortController Map for Cancellation**

Decision: Store active execution state in a module-level `Map<sessionId, { abortController: AbortController, executionId: string }>` in `test-flow.ts` rather than on the `Session` object.

Rationale: The cancel route (Task 5) needs both the `AbortController` (to abort the in-flight fetch) and the `executionId` (to send `POST /cancel/{execution_id}` to the executor). Storing only the `AbortController` is insufficient -- the cancel route would have no way to identify which executor execution to cancel. The `AbortController` and `executionId` are transient concerns (exist only during tool execution) and do not need to be serialized or persisted. Putting them on the `Session` type would pollute the session interface with runtime-only, non-serializable fields. A module-level map is simpler, automatically garbage-collected when the map entry is deleted, and does not affect the session type contract.

**TD5: CSS-Based Flow Diagrams (No Graph Library)**

Decision: Implement the flow diagram view using CSS flexbox/grid and SVG lines, not a graph visualization library.

Rationale: Flow diagrams in Conclave are simple: 1-5 phases in a linear sequence, each with 1-10 participants. There are no branches, loops, or complex graph structures. A CSS layout with SVG arrows handles this cleanly. Pulling in ReactFlow or D3 adds 100-300KB to the bundle for a feature that renders a handful of boxes and arrows. If flow complexity increases (branching, conditionals), migrate to ReactFlow in a future wave.

**TD6: Shared Markdown Rendering Component**

Decision: Build a shared `<MarkdownContent>` component used by all workspace views, rather than each view implementing its own markdown rendering.

Rationale: Every workspace view needs to render LLM output, which is markdown. Duplicating the markdown rendering setup (react-markdown + remark-gfm + rehype-highlight + custom styling) across 5 components is a maintenance burden. A shared component ensures consistent rendering, consistent typography, and a single place to fix rendering bugs.

**V2 Upgrade Path: Executor SSE Streaming**

The current architecture uses polling because the executor has no streaming capability. However, `run_flow_v2` already accepts a `progress_callback: Optional[Callable[[str, str], None]]` parameter (line 916 of `executor_v2.py`) that is currently wired to a logger. In V2, this callback could feed a FastAPI `StreamingResponse` with `media_type="text/event-stream"` (using the `sse-starlette` library), giving sub-second progress updates without polling. The existing callback is called at the phase level, but it could be extended to fire after each participant completes within a parallel phase, enabling the per-participant progress that A5 currently rules out. This upgrade would be transparent to the frontend -- the agent service would switch from polling to consuming an SSE stream, but the events emitted to the frontend would have the same shape. Note this as a future optimization, not a V1 concern.

### Dependencies

**Wave 1-3 Dependencies (must be complete before Wave 4 implementation):**
- Supabase `sessions` and `session_events` tables (Wave 1)
- Session persistence and rehydration (Wave 1)
- Sliding window context management (Wave 2)
- Session brief summarization (Wave 2)
- Two-panel session layout (Wave 3)
- Session tree component (Wave 3)
- ViewHint type definition (Wave 3 partial -- the type is defined in Wave 3, components are built in Wave 4)
- Session conductor prompt (Wave 3)
- Agent SDK migration (Wave 3)

**External Libraries (verified in conclave_ui/conclave-app/package.json):**
- `react-markdown` v10.1.0 -- Already installed. Markdown rendering in workspace views.
- `react-syntax-highlighter` v16.1.0 -- Already installed. Code block syntax highlighting.
- `@types/react-syntax-highlighter` v15.5.13 -- Already installed. TypeScript types.
- `@radix-ui/react-tabs` v1.1.13 -- Already installed. Used by Task 9 (tabbed view).
- `remark-gfm` -- **Must be added.** GitHub-flavored markdown support (tables, strikethrough, task lists).
- `uuid` -- Already used in agent service (`handler.ts` imports `v4 as uuidv4`). Frontend uses `Date.now()` + `Math.random()` for IDs, which is sufficient.

**API Dependencies:**
- Executor API `GET /execute/{execution_id}/status` -- Used for progress polling (already exists)
- Executor API `POST /cancel/{execution_id}` -- Used for cancellation (already exists)
- **Required executor change (Task 0):** Add `execution_id` field to `ExecuteRequest` schema and pass through to `run_flow_v2`. Two-line change. Without this, progress polling is fragile due to the race window between POST start and execution registration.

**Infrastructure Dependencies:**
- All three services running: Next.js (4100), Agent Service (8554), Executor API (8553)
- No new infrastructure required for Wave 4

### Out of Scope

The following are explicitly NOT being built in Wave 4:

1. **Executor streaming** -- The executor remains synchronous. Progress is achieved via polling, not streaming.
2. **Per-participant progress within a parallel phase** -- Only phase-level progress is reported. The executor would need changes to support per-model updates.
3. **Automatic SSE reconnection** -- If the SSE connection drops, the user sees an error and retries manually. Auto-reconnection with event ID replay is V2.
4. **Result editing in workspace views** -- Workspace views are read-only in Wave 4. Inline editing (edit a persona output, then re-run synthesis) is a future wave.
5. **Drag-and-drop workspace layout** -- Users cannot rearrange cards or resize panels. The layout is determined by the view_hint.
6. **Export/download from workspace** -- No "Export to PDF" or "Copy all to clipboard" on workspace views. This is a future enhancement.
7. **Shared sessions or collaboration** -- Sessions are single-user. Multi-user sessions are V2.
8. **Cost guardrails during execution** -- No "stop if cost exceeds $X" logic during flow execution. Cost estimation happens before execution (existing `cost-estimator.tsx`). Runtime cost guardrails are a future feature.
9. **Heartbeat events for SSE keepalive** -- Not needed for V1 local development. However, this should be a **P1 item on the production deployment checklist**. A13 confirms that production proxies (nginx, Cloudflare) may drop idle SSE connections after 60-90 seconds. A `heartbeat` event (every 15-20 seconds during tool execution) is trivial to implement and prevents silent disconnections. The `flow_progress` events serve as implicit heartbeats during flow execution, but a dedicated heartbeat is needed during other long operations.
10. **ReactFlow or D3 for flow diagrams** -- CSS-based diagrams only. Graph libraries are deferred until flow complexity warrants them.

---

## Review: User & Senior Engineer Audit

**Reviewed by:** Claude Opus 4.5 (automated review)
**Date:** 2026-01-31
**Files inspected:**
- `/Users/cg-adubuc/Desktop/Antoine/Conclave/conclave_ui/executor_api/api.py`
- `/Users/cg-adubuc/Desktop/Antoine/Conclave/conclave_ui/executor_api/schemas.py`
- `/Users/cg-adubuc/Desktop/Antoine/Conclave/conclave_ui/src/lib/executor_v2.py`
- `/Users/cg-adubuc/Desktop/Antoine/Conclave/conclave_ui/agent-service/src/tools/test-flow.ts`
- `/Users/cg-adubuc/Desktop/Antoine/Conclave/conclave_ui/agent-service/src/agent/handler.ts`
- `/Users/cg-adubuc/Desktop/Antoine/Conclave/conclave_ui/agent-service/src/types/index.ts`
- `/Users/cg-adubuc/Desktop/Antoine/Conclave/conclave_ui/conclave-app/lib/hooks/use-agent-chat.ts`
- `/Users/cg-adubuc/Desktop/Antoine/Conclave/conclave_ui/conclave-app/lib/types/agent-chat.ts`
- `/Users/cg-adubuc/Desktop/Antoine/Conclave/conclave_ui/conclave-app/package.json`

---

### Part 1: User Experience Review

**Overall verdict: The plan addresses the right pain points, but three gaps would make the experience feel unfinished.**

**What works well from the user's perspective:**

1. **Progress during execution is the right priority.** A 10-120 second black screen is the single worst UX failure in the current system. Even phase-level updates ("Phase 1 of 2: Exploration -- 12s elapsed") transform the experience from anxious waiting into observable work. This alone justifies the wave.

2. **Cancel without losing context is essential.** The plan correctly identifies that session state must survive cancellation. The detail about `isSendingRef` being reset on cancel (Task 6) shows awareness of the subtle state bugs that would lock users out.

3. **Persistent input bar is the glue.** Without it, the transition from "reading results" to "giving the next instruction" requires a mode switch. The plan's insistence on the input bar living outside the two-panel container is architecturally correct and worth the Wave 3 coordination cost.

**Gaps that would make flows feel "bolted on":**

**UX-GAP-1: Phase-only progress may feel broken for multi-model parallel phases.**
The plan acknowledges phase-only granularity (A5, TD3) but underestimates how this feels to the user. Consider: a 5-persona exploration with 1 phase. The user sees "Phase 1 of 1: Exploration" for 30-45 seconds, with only the elapsed timer changing. This is barely better than a spinner. The executive summary promises "Model 3/5 complete" but A5 confirms the executor cannot provide this. The progress indicator description in Task 4 lists "Individual model indicators (small dots or icons, filled when complete)" -- this is **not implementable** with the current executor contract. Recommendation: Rewrite Task 4 to remove per-model indicators and instead emphasize the elapsed timer with a "typically completes in X-Y seconds" estimate based on participant count. Honest indeterminacy ("Running 5 models in parallel... 18s elapsed") is better than a frozen progress bar.

**UX-GAP-2: No user feedback on what the agent chose for view_hint.**
The user runs a flow. Results appear in card_grid. But why? What if the agent picked the wrong layout? There is no "switch view" affordance. The user is stuck with whatever the agent decided. The plan defers view selection entirely to the agent prompt, with only a fallback-to-document safety net. For V1, add a simple view-mode dropdown in the workspace header that lets the user override the view_hint manually. This is cheap to build (it is just changing a prop on WorkspaceRenderer) and makes the system feel responsive to the user instead of dictatorial.

**UX-GAP-3: The "Cancelling..." to "Ready" transition needs more thought.**
Task 6 says the Cancel button shows "Cancelling..." with a spinner, then "after 1-2 seconds" the cancelled flow appears in the session tree. But the executor does not stop on HTTP disconnect (A4). The cancel endpoint at `POST /cancel/{execution_id}` is cooperative -- it only stops between phases or between participants. If the user cancels mid-LLM-call, the actual stop may take 5-30 seconds while the current API call completes. During this time the user sees "Cancelling..." with no feedback on why it is taking so long. Recommendation: After the cancel request is sent, immediately transition the UI to "ready" state (input bar enabled, "Cancelled" label on the flow). Do not wait for the executor to confirm the stop. The AbortController on the fetch already handles the agent service side. Let the executor wind down in the background silently.

---

### Part 2: Senior Software Engineer Review

**Overall verdict: The executor integration design is sound in architecture but contains three confirmed-wrong assumptions and two high-risk gaps that will cause implementation failures if not addressed pre-build.**

---

#### Critical Finding 1: execution_id is NOT passed through /execute to run_flow_v2

**Severity: BLOCKER**
**Plan references: A6, TD2, Task 2**

The plan says (A6): "the executor already accepts execution_id as an optional parameter (line 917)." This is true -- `run_flow_v2` at line 917 of `executor_v2.py` accepts `execution_id: Optional[str] = None`. However, inspecting the `/execute` endpoint in `api.py` (lines 451-458):

```python
result = await run_flow_v2(
    validated_config,
    effective_task_prompt,
    providers,
    progress_callback=lambda phase, status: logger.info(f"Phase {phase}: {status}"),
    agent_settings=agent_settings if agent_settings else None
)
```

The `execution_id` parameter is **not passed through**. Even if the agent service generates a UUID and includes it in the request body, the `ExecuteRequest` schema in `schemas.py` (lines 32-55) has **no `execution_id` field**. The request would silently ignore any `execution_id` in the JSON body.

This means:
- The agent service cannot know the `execution_id` until the `/execute` call returns (too late for polling).
- The "poll immediately after POST" strategy described in Task 2 will not work.

**Required fix (two changes to the executor, both one-liners):**
1. Add `execution_id: Optional[str] = Field(default=None, description="Client-provided execution ID")` to `ExecuteRequest` in `schemas.py`.
2. Pass `execution_id=request.execution_id` to `run_flow_v2()` in the `/execute` endpoint handler.

The plan correctly identifies this gap in A6's evidence text but marks the verdict as "Confirmed" when it should be "Confirmed with required executor change." The alternative "poll with retry-on-404" is fragile -- there is a race window between the POST starting and `register_execution()` being called at line 947 of `executor_v2.py`, during which every poll returns 404. This window could be 50-500ms depending on validation time, making the first poll unreliable.

**Recommendation: Update A6 verdict to "Confirmed -- requires executor schema change." Treat this as a prerequisite task (Task 0) before Task 2 can start.**

---

#### Critical Finding 2: EXECUTOR_URL defaults to port 8000, not 8553

**Severity: HIGH -- will cause Task 2 and Task 5 to fail in development**
**Plan references: Task 2, Task 5, Infrastructure Dependencies**

`test-flow.ts` line 28:
```typescript
const EXECUTOR_URL = process.env.EXECUTOR_URL || "http://localhost:8000";
```

The plan's Infrastructure Dependencies section says: "Executor API (8553)." CLAUDE.md also documents port 8553 for the executor. But `test-flow.ts` defaults to port 8000, which is the default FastAPI/uvicorn port. The `api.py` `EXECUTOR_PORT` also defaults to 8000 (line 124).

This means either: (a) the environment variable `EXECUTOR_URL` is set to `http://localhost:8553` somewhere in the dev startup scripts, or (b) the executor actually runs on 8000 and the plan's reference to 8553 is from `start_poc.sh` which may override the port. Either way, the plan cites port 8553 without acknowledging that the code defaults to 8000. Any new polling or cancel code in `test-flow.ts` that hardcodes or assumes 8553 will break if the env var is not set.

**Recommendation: When implementing the polling utility in Task 2, reuse the existing `EXECUTOR_URL` constant from `test-flow.ts` rather than constructing a new URL. Document the port discrepancy in the plan.**

---

#### Critical Finding 3: The agent service handler has no mechanism to emit SSE events during tool execution

**Severity: HIGH -- Task 2's core architecture needs rethinking**
**Plan references: Task 2**

The plan says (Task 2): "modify the tool execution block (lines 246-303) to handle test_flow specially: emit progress events via the SSE writer while the tool executes."

Inspecting `handler.ts`, the tool execution flow is:

```typescript
// Line 266 (simplified)
result = await tool.execute(toolCall.input, session);
```

The `handleMessage` function is an `AsyncGenerator<AgentEvent>`. It `yield`s events to the caller. But during `await tool.execute(...)`, the generator is suspended -- it cannot yield anything. The plan assumes we can "emit progress events via the SSE writer" during tool execution, but the current architecture does not provide a callback or event channel from inside `tool.execute()` back to the generator.

There are three viable approaches, none of which the plan describes concretely:

**(a) Split testFlow into start + poll loop.** Instead of `await tool.execute(...)`, the handler calls a non-blocking `startExecution()` that fires the POST and returns immediately with the `execution_id`. Then the handler enters a poll-and-yield loop:
```typescript
const { executionId } = await startFlowExecution(toolCall.input, session);
yield { type: "flow_started", executionId, ... };
while (true) {
  const status = await pollExecutionStatus(executionId);
  yield { type: "flow_progress", ... };
  if (status.done) break;
  await sleep(2500);
}
const result = await getFlowResult(); // or capture from the POST response
yield { type: "tool_result", ... };
```

**(b) Pass a callback/emitter to testFlow.** Modify `testFlow` to accept an `onProgress` callback. Inside `testFlow`, run the fetch and the poll loop concurrently (Promise.all), calling `onProgress` from the poll loop. The handler would need to convert callbacks into yields, which is awkward but doable with an async queue.

**(c) Run polling in a separate async context.** The streaming route handler (not `handleMessage`) starts polling directly, writing SSE events to the response stream in parallel with the generator consumption loop.

Approach (a) is the cleanest because it keeps the generator pattern intact. The plan should specify this pattern explicitly. Approach (c) requires modifying the Express route handler that consumes the generator, which couples SSE logic to the HTTP layer.

**Recommendation: Task 2 needs a concrete implementation pattern, not just "modify the tool execution block." The plan should specify approach (a) and detail how the blocking fetch becomes a background task while the generator polls and yields.**

---

#### Critical Finding 4: The ExecutionStatusResponse has no total_phases or total_participants fields

**Severity: MEDIUM -- progress indicator will lack key information**
**Plan references: Task 1, Task 4, A5**

The `ExecutionStatusResponse` schema (`schemas.py` lines 113-128) contains:
- `execution_id`
- `status` (running/complete/partial/failed/cancelled)
- `current_phase` (name of the active phase, or null)
- `completed_phases` (list of completed phase names)
- `elapsed_seconds`
- `error`

It does **not** contain:
- `total_phases` -- needed to show "Phase 1 of 3"
- `total_participants` -- needed to show "5 models"
- `flow_name` -- needed for the progress header

The `flow_started` event type in Task 1 specifies `total_phases`, `total_participants`, and `flow_name`. These values are available in the flow config that the agent service already has (it constructs the request). So the agent service can populate `flow_started` from its own data. But the polling loop for `flow_progress` cannot enrich the status response with this information unless it also carries forward the flow config metadata.

This is solvable: the agent service generates `flow_started` from the flow config it already holds, and subsequent `flow_progress` events carry forward the totals from that initial state. The plan implicitly assumes this but does not say it explicitly. The risk is that an implementer looks at the status endpoint and expects it to return everything needed for the progress UI.

**Recommendation: Add a note to Task 2 stating that `total_phases`, `total_participants`, and `flow_name` come from the flow config held by the agent service, NOT from the status polling endpoint. The polling endpoint only provides `current_phase`, `completed_phases`, and `elapsed_seconds`.**

---

#### Critical Finding 5: The agent-service SSE types do NOT include flow_created

**Severity: LOW -- but the plan's line references are partially wrong**
**Plan references: Task 1**

The plan says (Task 1): "The existing types cover connected, text, tool_use, tool_result, flow_created, done, and error."

Checking the agent service types (`agent-service/src/types/index.ts` lines 174-250), the `SSEEventType` union is:
```typescript
export type SSEEventType = "connected" | "text" | "tool_use" | "tool_result" | "error" | "done";
```

There is no `flow_created` in the agent service types. It exists only in the frontend types (`conclave-app/lib/types/agent-chat.ts` line 11). The frontend has it because the `use-agent-chat.ts` hook detects flow creation from `tool_result` events where `event.tool === "task"` and the result contains `flow_created: true` (see `use-agent-chat.ts` lines 315-348).

This is a minor factual error in the plan. The types are not "in two places" as described -- they are in two places but with different shapes. This does not affect the plan's approach (Task 1 adds new types to both locations) but the implementer should be aware that the agent service and frontend type files are not exact mirrors today.

---

#### Critical Finding 6: react-markdown is already installed; remark-gfm and rehype-highlight are NOT

**Severity: LOW -- dependency management note**
**Plan references: A10, Task 8**

`package.json` confirms:
- `"react-markdown": "^10.1.0"` -- **present**
- `"react-syntax-highlighter": "^16.1.0"` -- **present**
- `"@types/react-syntax-highlighter": "^15.5.13"` -- **present** (types)
- `remark-gfm` -- **NOT present**
- `rehype-highlight` -- **NOT present**

A10 says "Plausible" but should be updated: `react-markdown` is confirmed present, `react-syntax-highlighter` is present (so `rehype-highlight` may not be needed). `remark-gfm` must be added. Also, `@radix-ui/react-tabs` is already installed (`"^1.1.13"` in package.json), which is relevant to Task 9's note about checking for an existing tab component.

**Recommendation: Update A10 to "Confirmed -- react-markdown and react-syntax-highlighter already installed. Add remark-gfm. @radix-ui/react-tabs is available for Task 9."**

---

#### Polling at 2-3 seconds: viable?

**Plan references: TD1, Task 2, A14**

The plan asks whether polling every 2-3 seconds is viable. Answer: **yes, for V1.** The status endpoint (`api.py` lines 543-578) reads from an in-memory dict -- no database, no network. Response is approximately 200 bytes JSON. At one session polling at 2-second intervals, this is 0.5 requests/second. Even at 100 concurrent sessions, this is 50 req/s of in-memory dict lookups -- trivially handled by FastAPI's async handler.

The real question is whether 2-3 seconds is responsive **enough**. For a single-phase flow, progress updates only arrive when phases change. A 5-model parallel phase that takes 30 seconds will show zero phase transitions during those 30 seconds -- the user just sees the elapsed timer climbing. The poll frequency matters only for multi-phase flows where phase transitions happen every 5-15 seconds. For single-phase flows, the timer is the only moving element regardless of poll frequency.

**Verdict: 2-3 second polling is fine. The bottleneck is executor granularity, not poll frequency.**

---

#### What happens if the executor crashes mid-flow?

**Plan references: Not explicitly addressed**

If the executor process dies mid-execution:
1. The `/execute` fetch in `test-flow.ts` will receive a TCP connection reset or timeout.
2. The AbortController timeout (currently `timeoutSeconds * 1000`) will eventually fire, returning `EXECUTION_TIMEOUT`.
3. The status polling loop (if implemented per Task 2) will get connection refused errors on the next poll.

The plan does not describe how the polling loop handles poll failures. If the executor crashes, every poll returns a network error. The polling loop must distinguish between "executor temporarily unreachable" (retry) and "executor is down" (give up and report error). A simple approach: if 3 consecutive polls fail with network errors, stop polling and emit `flow_error`.

The session itself survives because session state is in the agent service's memory (and, after Wave 1, in Supabase). The conversation history up to the failed flow is intact. The user sees a flow error and can type a new message.

**Recommendation: Add error handling to the polling loop specification in Task 2. Define a max consecutive poll failure count (e.g., 3) before emitting flow_error.**

---

#### AbortController cancellation: reliable?

**Plan references: Task 5, A4**

The plan's cancellation design is a two-step process:
1. `AbortController.abort()` on the agent service's fetch to the executor (stops waiting for the response).
2. `POST /cancel/{execution_id}` to the executor (tells it to stop after the current step).

Step 1 is reliable -- `AbortController` is well-supported and the fetch will throw `AbortError`. Step 2 is also reliable -- the cancel endpoint sets a flag that the executor checks between phases (`executor_v2.py` lines 971-982) and between parallel participants (line 697-699).

The gap is between step 1 and step 2. After the fetch aborts, the agent service must still send the cancel request to the executor. If the abort happens in the catch block of the fetch, the cancel POST must be fire-and-forget (no await needed, just send it). The plan describes both steps but does not sequence them clearly. The order should be: (1) send cancel POST to executor, (2) abort the fetch. This ensures the cancel request is sent even if the abort causes the control flow to jump to the catch block.

Also worth noting: the cancel endpoint returns 404 if the execution_id is not found. If the executor already finished and cleaned up the registry entry, the cancel is a no-op 404. This is fine -- the plan acknowledges the race condition.

**Verdict: The cancellation approach is reliable for V1. Sequence the cancel POST before the abort to avoid lost cancel requests.**

---

#### Workspace view scoping

**Plan references: Tasks 7-12**

The workspace view components are well-scoped. Each view accepts `WorkspaceViewProps` (artifacts + metadata) and handles its own rendering. The registry pattern is clean and extensible. The shared `MarkdownContent` component (TD6) avoids duplication.

One concern: the `FlowDiagramView` (Task 12) needs a fundamentally different data shape than the other views. The other four views consume `Artifact[]` (model outputs). The diagram view needs flow structure (phases, participants, connections). The plan acknowledges this ("The flow diagram view has a different data shape") but handles it with "include flow metadata in the metadata field of the artifact." This is a hack -- an artifact with no `content` and all data in `metadata` is not really an artifact. It would be cleaner to define a `WorkspaceContent = ArtifactContent | DiagramContent` union type, but for V1, the metadata approach works.

**Verdict: View scoping is acceptable for V1. Consider a union content type in V2 if more non-artifact views are added.**

---

#### What happens when the agent gets view_hint wrong?

**Plan references: Task 7, Task 1**

The plan handles unknown view_hints by falling back to document view. But the more common failure is a **valid but wrong** view_hint -- e.g., the agent sends `comparison` for a 5-model output, or `card_grid` for a single document. The plan leaves view_hint selection entirely to the agent prompt, with no validation.

For V1, this is acceptable because:
- The ComparisonView handles >2 artifacts (shows first 2 with a "Showing 2 of N" selector).
- The CardGridView handles 1 artifact (card expands to fill width).
- The DocumentView handles multiple artifacts (renders sequentially with dividers).

No view will crash on unexpected artifact counts. The result may look suboptimal, but it will not break.

**Verdict: The fallback and defensive coding in each view make this low-risk. The UX-GAP-2 recommendation (user-facing view override dropdown) addresses the remaining concern.**

---

### Summary of Findings

| # | Finding | Severity | Type | Action Required |
|:-:|---------|:--------:|:----:|----------------|
| CF-1 | execution_id not passed through /execute to run_flow_v2; ExecuteRequest schema lacks the field | BLOCKER | Engineer | Add execution_id to ExecuteRequest schema + pass-through in api.py; update A6 verdict |
| CF-2 | EXECUTOR_URL defaults to port 8000, plan references port 8553 | HIGH | Engineer | Use existing EXECUTOR_URL constant; document the discrepancy |
| CF-3 | handler.ts cannot yield SSE events during synchronous tool execution; no concrete pattern specified | HIGH | Engineer | Specify split-start/poll-and-yield pattern for Task 2 |
| CF-4 | ExecutionStatusResponse lacks total_phases, total_participants, flow_name | MEDIUM | Engineer | Note in Task 2 that these come from flow config, not the poll endpoint |
| CF-5 | Agent service types do not include flow_created; plan's description is inaccurate | LOW | Engineer | Correct Task 1 description |
| CF-6 | react-markdown already installed; remark-gfm missing; radix tabs available | LOW | Engineer | Update A10 verdict; note remark-gfm must be added |
| UX-1 | Phase-only progress feels broken for single-phase multi-model flows | MEDIUM | User | Rewrite Task 4 to remove per-model indicators; add time estimate |
| UX-2 | No user override for agent-selected view_hint | MEDIUM | User | Add view-mode dropdown to workspace header |
| UX-3 | "Cancelling..." state may hang 5-30s while executor finishes current LLM call | MEDIUM | User | Immediately transition to "ready" after cancel; let executor wind down silently |
| P-1 | No error handling specified for poll failures (executor crash) | MEDIUM | Engineer | Add max consecutive poll failure count to Task 2 |
| P-2 | Cancel POST should fire before fetch abort to avoid lost requests | LOW | Engineer | Specify sequencing in Task 5 |

**Bottom line:** The plan is well-structured and addresses the right problems. CF-1 is a true blocker -- without the execution_id pass-through, the entire progress polling architecture does not work. CF-3 is the second-highest risk because Task 2's architecture needs a concrete pattern that the current plan does not provide. Everything else is fixable during implementation.

---

### Post-Review Revisions (Applied)

All critical findings and UX gaps identified above have been addressed in the main plan body:

| Finding | Resolution |
|---------|-----------|
| CF-1 (execution_id blocker) | **Task 0 added** as a prerequisite. A6 verdict updated to "Confirmed -- requires executor schema change." |
| CF-2 (port 8000 vs 8553) | **Port note added to Task 2 Notes.** Specifies to reuse `EXECUTOR_URL` constant. |
| CF-3 (handler cannot yield during tool execution) | **Split-start/poll-and-yield pattern specified in Task 2** with full code example. |
| CF-4 (ExecutionStatusResponse lacks totals) | **Note added to Task 1** explaining that `total_phases`, `total_participants`, and `flow_name` come from flow config held by the agent service, NOT from the status endpoint. |
| CF-5 (agent service types missing flow_created) | **Task 1 Context corrected** to accurately describe the type differences between backend and frontend. |
| CF-6 (react-markdown installed, remark-gfm missing) | **A10 verdict updated to Confirmed.** Task 7 specifies adding `remark-gfm`. Dependencies section updated. |
| UX-1 (per-model indicators not implementable) | **Task 4 rewritten** to remove per-model indicators. Shows phase-level progress with elapsed timer and time estimate. |
| UX-2 (no user view override) | **Task 14 expanded** to include a view-mode dropdown in the workspace header. |
| UX-3 (cancel hang) | **Task 6 rewritten** to immediately transition to ready state after cancel, not waiting for executor confirmation. |
| P-1 (no poll failure handling) | **Error handling added to Task 2 Notes.** Max 3 consecutive poll failures before emitting flow_error. |
| P-2 (cancel POST sequencing) | **Task 5 Expected Behavior rewritten** with explicit sequencing: cancel POST fires BEFORE fetch abort. |

---

## Post-Review Revisions

Revisions applied based on the external review (`wave_4_flow_integration_review.md`, dated 2026-01-31).

| # | Review Finding | Severity | Change Made |
|:-:|---------------|:--------:|-------------|
| 1 | Cancellation map (TD4) stores only `AbortController` but the cancel route also needs `executionId` to call `POST /cancel/{execution_id}` on the executor | HIGH | Updated TD4 to specify `Map<sessionId, { abortController: AbortController, executionId: string }>`. Updated Task 5 notes to reference the tuple map and describe how the cancel route reads both values. |
| 2 | `Promise.race` completion ordering: when execution completes between poll intervals, the next race may resolve ambiguously | HIGH | Added a `Promise.race` completion ordering note to Task 2 specifying that the handler must check if `executionPromise` has settled before issuing a redundant poll. |
| 3 | Single-phase flows lack sufficient visual feedback beyond an elapsed timer | MEDIUM | Added "Single-phase flow visual feedback" section to Task 4 specifying shimmer/pulse animation on the progress bar and rotating contextual "thinking" messages during long single-phase waits. |
| 4 | Send button should not be disabled during execution -- users type ahead while waiting | MEDIUM | Rewrote Task 13 input bar behavior: send button remains enabled during execution, messages are queued and sent after flow completes. Fallback: keep text input enabled, defer send with a "queued" indicator. |
| 5 | Existing `results-display.tsx` and `model-response.tsx` should be referenced as prior art for workspace views | MEDIUM | Added prior art references to Task 7 (provider color constants from `model-response.tsx`, `results-display.tsx`, `flow-summary.tsx` -- extract into shared module). Added prior art section to Task 9 referencing `results-display.tsx` tabbed interface, `MODEL_TAB_COLORS`, copy buttons, and stats footer. |
| 6 | Integration test (Task 15) requires all services with real API keys -- not viable for CI/CD | MEDIUM | Added mock executor specification to Task 15: lightweight server with configurable sleep-per-phase, status polling, cancellation support, and canned results. Configurable via `EXECUTOR_MOCK=true` environment variable. |
| 7 | A13 SSE keepalive: production proxies will drop idle connections; heartbeat should be P1 for production | MEDIUM | Updated A13 verdict to "Confirmed with caveat." Enhanced Out of Scope item 9 to flag heartbeat as a P1 production deployment checklist item. |
| 8 | A14 polling viability upgraded from Plausible to Confirmed | LOW | Updated A14 verdict to "Confirmed" with specific evidence (in-memory dict read, ~200 bytes, trivial at 50+ req/s). |
| 9 | A4 evidence strengthened: `run_flow_v2` runs inline via `await`, not as a background task; event loop not blocked due to `asyncio.gather` | LOW | Updated A4 evidence to note the `await run_flow_v2()` runs inline in the endpoint handler, and that concurrent status polls work because `asyncio.gather` yields to the event loop between phases. |
| 10 | Executor's `progress_callback` parameter is a clean V2 SSE upgrade path | LOW | Added "V2 Upgrade Path: Executor SSE Streaming" section to the Appendix documenting how `progress_callback` (line 916) could feed a FastAPI `StreamingResponse` via `sse-starlette` for sub-second progress updates. |
