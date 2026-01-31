# Wave 4: Flow Integration -- Review

**Reviewed by:** Claude Opus 4.5 (dual-persona review)
**Date:** 2026-01-31
**Plan reviewed:** `wave_4_flow_integration_plan.md`
**Architecture context:** `architecture_review_and_solutions.md`

---

## Verdict: APPROVE WITH CHANGES

The plan is well-structured, addresses the right user pain points, and its self-contained review already caught and patched the most critical issues (CF-1 through CF-6, UX-1 through UX-3). The post-review revisions are solid. However, there are residual issues that the internal review did not catch -- specifically around the executor's actual API contract, a gap in the cancellation architecture, and workspace view rendering performance. These are detailed below.

---

## PM Review (User Persona)

1. **Progress streaming solves the biggest pain point.** The current 10-120 second black screen is the single worst thing about flow execution. Even phase-level updates with an elapsed timer ("Phase 1 of 2: Exploration -- 18s elapsed") transform the experience from anxious waiting into visible work. This alone justifies the wave. The plan correctly identified that per-model progress is not available (A5) and revised Task 4 accordingly.

2. **Cancellation with immediate UI response is correct.** The revised Task 6 -- immediately transitioning to "ready" state without waiting for the executor to confirm -- is the right call. Users do not care that the executor takes 5-30 seconds to wind down. They care that the Cancel button works when they click it. The fire-and-forget pattern for the executor cancel POST is pragmatic.

3. **The persistent input bar is essential and undersold.** This is the difference between "reviewing results" and "working with results." The plan positions it as Feature 4, but from a PM perspective it is the UX glue that makes the entire session concept viable. One concern: the plan says the send button is disabled during flow execution with a tooltip. Consider instead queuing the message and sending it after the flow completes -- users often type their follow-up while waiting, and being told "wait" is frustrating.

4. **The view override dropdown (Task 14) is a necessary safety valve.** The agent will sometimes pick the wrong layout. A 5-persona result forced into comparison view, or a single document forced into card grid, would be jarring. The dropdown lets users correct this without re-running anything. Good addition.

5. **Remaining user concern: single-phase flows still feel like a spinner.** For the most common flow pattern (all models run in parallel in a single phase), the user sees "Phase 1 of 1: Running 5 models in parallel... 18s elapsed." The progress bar is full or empty -- no intermediate states. The elapsed timer and "typically completes in 20-40s" estimate help, but this is still noticeably weaker than the multi-phase experience. Consider adding a subtle animation (pulsing glow on the progress bar, or a rotating set of "thinking" messages) to maintain the feeling of activity during long single-phase executions.

---

## Senior Engineer Review

### Verified Claims vs. Source Code

I read every file referenced in the plan plus the executor internals. Here are the findings, organized by severity.

#### BLOCKER: `execution_id` is not passed from `/execute` endpoint to `run_flow_v2`

The plan added Task 0 to fix this, and the post-review revisions claim it is addressed. However, the fix described in Task 0 is necessary but the plan does not acknowledge a subtle timing issue.

**Source evidence:**

- `executor_api/api.py` lines 452-458: `run_flow_v2()` is called WITHOUT `execution_id`:
  ```python
  result = await run_flow_v2(
      validated_config,
      effective_task_prompt,
      providers,
      progress_callback=lambda phase, status: logger.info(f"Phase {phase}: {status}"),
      agent_settings=agent_settings if agent_settings else None
  )
  ```
- `executor_api/schemas.py` lines 32-55: `ExecuteRequest` has no `execution_id` field.
- `src/lib/executor_v2.py` lines 942-947: `run_flow_v2` generates its own UUID if `execution_id is None`, then calls `register_execution()`.

**The fix is straightforward** (two-line change as described), but the plan should explicitly note that `run_flow_v2` is called with `await` on line 452. This means the FastAPI endpoint handler is suspended on that `await` for the entire duration of the flow (10-120 seconds). The execution is NOT run as a background task. It runs inline in the request handler. This is important because:

- The status polling endpoint (`GET /execute/{execution_id}/status`) can be called concurrently from the agent service because FastAPI is async and handles multiple requests concurrently.
- The `execution_registry` is updated by `update_execution_phase()` and `complete_phase()` DURING the `await run_flow_v2()` call, because the internal `asyncio.gather` yields to the event loop between phases.
- This confirms polling is viable -- the event loop is not blocked.

**Verdict on Task 0:** Correct and necessary. Approve.

---

#### HIGH: The executor does NOT stream -- confirmed, and the polling approach is sound

**Source evidence:**

- `executor_api/api.py`: Grep for `StreamingResponse`, `text/event-stream`, `EventSourceResponse` returns zero matches. The executor has no streaming capability.
- The `/execute` endpoint (line 289) returns `response_model=ExecuteResponse`, which is a Pydantic model -- a complete JSON payload, not a stream.
- FastAPI supports SSE via `StreamingResponse` with `media_type="text/event-stream"` (confirmed via web search), but the executor does not use this pattern anywhere.

**The plan's decision (TD1) to use polling instead of modifying the executor is correct.** The status endpoint is lightweight (in-memory dict read), the polling interval (2-3 seconds) is appropriate, and the architecture review explicitly defers executor changes.

**One note the plan does not mention:** FastAPI's `sse-starlette` library would make adding SSE to the executor trivial in V2 if sub-second progress is ever needed. The existing `progress_callback` parameter on `run_flow_v2` (line 916) could be wired to an SSE stream with minimal changes. This is a clean future upgrade path.

---

#### HIGH: The handler's AsyncGenerator pattern and the split-start/poll-and-yield solution

The plan (revised after CF-3) specifies the split-start/poll-and-yield pattern in Task 2. I verified this is architecturally viable by reading `handler.ts`.

**Source evidence:**

- `agent-service/src/agent/handler.ts` line 129: `handleMessage` is an `AsyncGenerator<AgentEvent>` that yields events.
- Line 266: `result = await tool.execute(toolCall.input, session)` -- during this await, the generator is suspended and CANNOT yield.
- The proposed pattern (start the fetch as a background Promise, then poll-and-yield in a loop using `Promise.race`) is the correct solution. The generator can yield between poll intervals because `Promise.race` returns control to the generator on each poll tick.

**Concern not addressed in the plan:** The `Promise.race` pattern in Task 2 races `executionPromise` (the background fetch) against `sleep(2500)` (the poll interval). If the execution completes between two polls (e.g., at 2400ms after the last poll), the next `Promise.race` resolves with `type: "done"`. This is correct. But if the execution completes AND the poll fires simultaneously, the code must handle the case where the poll returns a completed status before the execution Promise resolves. The handler should check `raceResult.type === "done"` first, and only poll if the race resolves with `type: "poll"`.

**Verdict:** The pattern is sound. Add a note about handling the race between completion and the final poll.

---

#### HIGH: Cancellation architecture -- the POST-before-abort sequencing has a gap

The plan (revised after P-2) specifies that the cancel POST to the executor fires BEFORE the AbortController abort. This is correct in principle but has an implementation subtlety.

**Source evidence:**

- `executor_api/api.py` lines 718-758: `POST /cancel/{execution_id}` calls `request_cancellation()` which sets `cancel_requested = True` on the in-memory `ExecutionState`.
- `src/lib/executor_v2.py`: Cancellation is checked at 6 different points:
  - Line 623: Before single-phase execution
  - Line 698: Before parallel-phase execution
  - Line 722: Before each parallel participant's LLM call
  - Line 817: Before sequential-phase execution
  - Line 845: Before each sequential participant's LLM call
  - Line 972: Before each phase in the main loop

**The gap:** The `POST /cancel/{execution_id}` to the executor is sent from the agent service's cancel route handler. But the `execution_id` is generated by the agent service (Task 0) and stored... where? Task 5 says "the agent service retrieves the active `execution_id` for the session." But the plan does not specify how the cancel route knows the `execution_id`. Task 5 recommends a module-level `Map<sessionId, AbortController>` (TD4), but the cancel route also needs the `execution_id` to send the cancel POST to the executor. This means the map must store `{ abortController, executionId }` per session, not just the AbortController.

**Recommended fix:** Update TD4 to specify that the module-level map stores a tuple of `{ abortController: AbortController, executionId: string }` keyed by session ID. The cancel route reads both values from this map.

---

#### MEDIUM: `ExecutionStatusResponse` lacks `total_phases` and `total_participants`

**Source evidence:**

- `executor_api/schemas.py` lines 113-128: `ExecutionStatusResponse` contains `execution_id`, `status`, `current_phase`, `completed_phases`, `elapsed_seconds`, `error`. No `total_phases`, `total_participants`, or `flow_name`.

The plan (revised after CF-4) adds a note that these values come from the flow config held by the agent service. This is correct, but the implementation must be careful: the agent service must extract `total_phases` and `total_participants` from the flow config BEFORE starting the execution, and carry these values into the poll-and-yield loop. The `flow_started` event should be populated from this local data, not from any executor response.

**Verdict:** Addressed by the revision. No further changes needed.

---

#### MEDIUM: `ModelResponse` renders content as plain text, not markdown

**Source evidence:**

- `conclave-app/components/flows/model-response.tsx` lines 132-136:
  ```tsx
  <div className="prose prose-invert prose-sm max-w-none">
    <div className="whitespace-pre-wrap text-sm text-white/80 leading-relaxed">
      {content}
    </div>
  </div>
  ```
  Despite the `prose prose-invert` classes on the outer div, the content is rendered as raw text inside a `whitespace-pre-wrap` div. There is no `react-markdown` usage. The prose classes have no effect because the content is a single text node, not parsed HTML/markdown elements.

This confirms the plan's A9 assumption: the existing components do NOT render markdown. The shared `<MarkdownContent>` component (Task 7) is necessary and should be prioritized early in the build order so all workspace views can use it.

**Verdict:** Plan is correct. No changes needed.

---

#### MEDIUM: Existing `ResultsDisplay` already implements a tabbed view

**Source evidence:**

- `conclave-app/components/flows/results-display.tsx`: This component already renders flow results in a tabbed interface using `@radix-ui/react-tabs`. It has model color mapping, copy buttons, stats footer, and handles both round-robin and hub-spoke flows.

The plan proposes building a new `TabbedView` (Task 9) from scratch without referencing this existing component. The new component serves a different context (session workspace vs. standalone flow results page), but there is significant overlap: tab rendering, model badges, content display, stats. The plan should note that `results-display.tsx` and `model-response.tsx` are prior art and that shared utilities (color mapping, stat formatting) should be extracted rather than duplicated.

**Recommended change:** Task 9 should reference `results-display.tsx` as prior art and extract shared constants (provider colors, formatting functions) into a shared module.

---

#### LOW: Port discrepancy (8000 vs 8553) -- already noted

**Source evidence:**

- `agent-service/src/tools/test-flow.ts` line 28: `EXECUTOR_URL` defaults to `http://localhost:8000`.
- `executor_api/api.py` line 124: `EXECUTOR_PORT = int(os.getenv("EXECUTOR_PORT", "8000"))`.
- `CLAUDE.md` documents port 8553 for the executor.
- The actual port depends on `start_poc.sh` or environment variables.

The revised plan (Task 2 port note) correctly says to reuse the `EXECUTOR_URL` constant. No further action needed.

---

## Assumptions Audit

| # | Assumption | Plan Verdict | Reviewed Verdict | Evidence |
|:-:|-----------|:------------:|:----------------:|----------|
| A1 | Executor does NOT support streaming | Confirmed | **Confirmed** | Grep for `StreamingResponse`, `text/event-stream`, `EventSourceResponse` in `executor_api/` returns zero matches. `/execute` returns `response_model=ExecuteResponse` (Pydantic JSON). |
| A2 | Executor has a working status polling endpoint | Confirmed | **Confirmed** | `api.py` lines 543-578: `GET /execute/{execution_id}/status` reads from `execution_registry`. `executor_v2.py` calls `update_execution_phase()` and `complete_phase()` during flow execution. Registry is updated between phases. |
| A3 | Executor supports cancellation via `POST /cancel/{execution_id}` | Confirmed | **Confirmed** | `api.py` lines 718-758: endpoint exists. `executor_v2.py`: `is_cancellation_requested()` is checked at 6 distinct points: before each phase (line 972), before single-phase (623), before parallel-phase (698), before each parallel participant (722), before sequential-phase (817), before each sequential participant (845). |
| A4 | Executor continues running after HTTP disconnect | Confirmed | **Confirmed** | `api.py` line 452: `result = await run_flow_v2(...)` runs inline in the async handler. FastAPI does not cancel the asyncio task on client disconnect. The flow completes in the background; results are lost if the client is gone. |
| A5 | No per-participant progress within parallel phases | Confirmed | **Confirmed** | `executor_v2.py` line 774: `asyncio.gather(*tasks)` runs all participants concurrently. Results are collected as a batch. `ExecutionStatusResponse` (schemas.py lines 113-128) has no `completed_participants` field. The `ExecutionState` dataclass (executor_v2.py lines 108-117) has no participant-level tracking. |
| A6 | execution_id can be client-generated and passed to executor | Confirmed (requires change) | **Confirmed -- requires two changes** | `run_flow_v2` (line 917) accepts `execution_id: Optional[str] = None`. Lines 942-944: generates UUID if not provided. BUT `ExecuteRequest` schema (schemas.py) has no `execution_id` field, and `api.py` line 452 does not pass `execution_id` to `run_flow_v2`. Task 0 correctly identifies the fix. |
| A7 | Persistent input bar requires Wave 3 layout changes | Plausible | **Plausible** | No `components/sessions/` directory exists (confirmed by glob). Wave 3 is not yet built. The requirement is correctly identified as a cross-wave dependency. |
| A8 | Cancellation cost waste is negligible | Plausible | **Plausible** | A 5-model parallel phase costs roughly $0.01-0.05. Even aggressive cancellation (10 per session) wastes under $0.50. The cooperative cancellation (between phases/participants) minimizes waste further -- at most one in-progress LLM call per participant continues. |
| A9 | Workspace views need markdown rendering with syntax highlighting | Confirmed | **Confirmed** | `model-response.tsx` lines 132-136: renders content as `whitespace-pre-wrap` plain text. No `react-markdown` usage in any existing flow component. LLM outputs routinely contain markdown. |
| A10 | react-markdown is installed; remark-gfm is not | Confirmed | **Confirmed** | `package.json` includes `react-markdown` v10.1.0, `react-syntax-highlighter` v16.1.0, `@types/react-syntax-highlighter` v15.5.13, `@radix-ui/react-tabs` v1.1.13. `remark-gfm` is NOT listed. |
| A11 | Wave 3 exposes chatPanelVisible state | Plausible | **Plausible** | Wave 3 not built. Must be communicated as a Wave 3 output requirement. |
| A12 | use-agent-chat.ts can be extended incrementally | Confirmed | **Confirmed** | The hook uses `useState`, `useCallback`, `useRef`. The SSE handler is a switch statement (line 265) that is straightforward to extend. Adding new state variables and switch cases is incremental. |
| A13 | SSE connection stays open during long tool execution | Confirmed | **Confirmed with caveat** | `use-agent-chat.ts` lines 211-232: `while(true)` read loop with no intermediate timeout. Connection stays open. **Caveat:** Production deployments behind reverse proxies (nginx, cloudflare) may drop idle connections after 60-90s. The plan correctly notes this as out of scope for V1, but the heartbeat event should be a Day 1 production concern. |
| A14 | Status polling at 2-3s is lightweight | Plausible | **Confirmed** | `api.py` lines 543-578: reads from in-memory `dict` (line 137: `execution_registry.get(execution_id)`). No database, no network. Response is ~200 bytes. Trivially handled even at 50+ req/s. |

---

## Recommended Changes

1. **Task 0 (BLOCKER fix) -- approve as-is.** The two-line executor change (add `execution_id` to `ExecuteRequest`, pass it through to `run_flow_v2`) is necessary and minimal. Without it, the entire progress polling architecture fails. The plan correctly added this as a prerequisite.

2. **Task 2 -- add a note about the module-level cancellation map needing `executionId`.** TD4 specifies a `Map<sessionId, AbortController>`, but the cancel route (Task 5) also needs the `execution_id` to send `POST /cancel/{execution_id}` to the executor. Change the map type to `Map<sessionId, { abortController: AbortController, executionId: string }>`.

3. **Task 2 -- add a note about `Promise.race` completion ordering.** When the execution completes between two poll intervals, the next `Promise.race` may resolve with either the execution result or the poll timer. The handler must check for completion first. Add a flag or check `executionPromise` settlement state before polling.

4. **Task 4 -- add subtle animation for single-phase flows.** For the common case (all models in one parallel phase), the progress bar shows no intermediate states. Add a pulsing or shimmer animation on the progress bar to maintain the feeling of activity. The elapsed timer alone is not enough visual feedback for 30-45 seconds of waiting.

5. **Task 7 -- note the existing provider color constants.** `model-response.tsx` (line 18-48) defines `PROVIDER_COLORS` and `results-display.tsx` (line 86-111) defines `MODEL_TAB_COLORS`. These should be extracted into a shared constants file rather than duplicated in the new workspace views.

6. **Task 9 -- reference `results-display.tsx` as prior art.** The existing tabbed results display has significant overlap with the proposed `TabbedView`. Extract shared utilities (provider color mapping, stat formatting, copy button) into a shared module to avoid duplication.

7. **Task 13 -- reconsider disabling the send button during execution.** Instead of disabling with a tooltip ("Wait for the current flow to finish, or cancel it"), consider queuing the typed message and sending it after completion. Users frequently compose their follow-up while waiting. Blocking input during a 30-120 second wait is frustrating. If queuing is too complex for V1, at minimum allow typing (just defer sending) so users do not lose their train of thought.

8. **Task 15 -- add a mock executor option for CI testing.** The integration test requires all three services running with real LLM API keys. For CI/CD, add a mock executor that sleeps for a configurable duration per phase and returns canned results. This enables automated testing of the streaming/cancellation flow without LLM costs.

9. **General -- add a heartbeat to the priority list for production.** A13 confirms the SSE connection stays open in development, but production proxies will drop idle connections. Add a `heartbeat` event (every 15-20 seconds during tool execution) as a P1 item for the production deployment checklist, even if it is out of scope for V1 local development.

10. **General -- document the executor's existing `progress_callback` as a V2 SSE upgrade path.** `run_flow_v2` accepts a `progress_callback: Optional[Callable[[str, str], None]]` parameter (line 916) that is currently wired to a logger. In V2, this callback could feed a FastAPI `StreamingResponse` with SSE events, giving sub-second progress updates without polling. Note this in the Appendix as a future optimization.
