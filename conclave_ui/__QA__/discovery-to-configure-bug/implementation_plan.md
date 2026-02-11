# Implementation Plan: Discovery → Configure Task Synthesis

---

## Executive Summary

When users chat in the Discovery step (advanced mode) and click "Continue to Configure", the Configure step shows empty fields — the conversation is not used to pre-fill anything. This fix adds LLM-based synthesis that extracts a clean, actionable task description from the discovery transcript and pre-fills the Task input, so the user sees a ready-to-edit task when they arrive at the Configure step.

**Key Outcomes:**
- Discovery conversations produce a synthesized task description that pre-fills the Configure step
- Users can review and edit the synthesized task before running the flow
- The raw transcript is still passed to the executor as `discovery_context` (existing behavior preserved)

---

## Project Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| `{EVIDENCE_ROOT}` | `./conclave_ui/__QA__/discovery-to-configure-bug/evidence` | Root directory for all evidence artifacts |
| `{STATIC_ANALYSIS_CMD}` | `cd conclave-app && npx tsc --noEmit && npx next lint` | Static analysis command(s) for changed files |
| `{DEV_SERVER_CMD}` | `cd conclave-app && npm run dev` | Command to start the development server |
| `{TEST_CMD}` | `cd conclave-app && npm test` | Command to run unit/integration tests |
| `{RUNTIME_LOGS_CMD}` | `browser console + /tmp/nextjs-dev.log` | How to capture runtime errors |
| `{BUILD_CMD}` | `cd conclave-app && npm run build` | Production build command |
| `{VERIFICATION_AGENT}` | `Playwright MCP` | Primary tool for runtime verification |
| `{SCREENSHOT_TOOL}` | `Playwright screenshot` | Tool used to capture visual evidence |
| `{MAX_RETRIES}` | `3` | Max verification failures before escalating to user |

---

## Product Manager Review

### Feature Overview

This implementation bridges the gap between the Discovery chat and the Configure step in the advanced flow wizard. Currently, the user's discovery conversation is stored but invisible in the UI — the Configure step arrives completely empty.

### Features

#### Feature 1: Transcript Synthesis API

**What it is:** A new API endpoint that accepts a discovery transcript and returns a synthesized task description.

**Why it matters:** Discovery conversations are conversational back-and-forth, not clean task descriptions. An LLM synthesis step transforms messy chat into an actionable, editable task.

**User perspective:** Invisible to the user — this is backend infrastructure that powers the pre-fill experience.

---

#### Feature 2: Discovery-to-Configure Pre-fill

**What it is:** When the user clicks "Continue to Configure", the system synthesizes their discovery conversation and pre-fills the Task Description textarea.

**Why it matters:** Without this, the user's discovery effort is wasted — they arrive at an empty form and have to re-type everything. With this, the discovery conversation directly feeds into the next step.

**User perspective:** After chatting in discovery, the user clicks "Continue to Configure" and sees a synthesized task description ready to review and edit. The "Run Flow" button is immediately enabled.

---

#### Feature 3: Synthesis Loading State

**What it is:** A loading indicator on the Configure step while synthesis is in progress.

**Why it matters:** Synthesis takes a few seconds (LLM call). The user needs visual feedback that something is happening.

**User perspective:** Brief "Synthesizing your discoveries..." overlay, then the task appears.

---

## Pre-Flight Readiness

> **Complete before starting any implementation task.** All items must be checked.

- [ ] **Dependencies installed** — `npm install` in conclave-app succeeds
- [ ] **Environment configured** — `.env.local` has ANTHROPIC_API_KEY (for synthesis test)
- [ ] **Dev server starts** — `npm run dev` in conclave-app launches on port 4100
- [ ] **Static analysis baseline** — `npx tsc --noEmit && npx next lint` passes (or known issues documented)
- [ ] **Test suite baseline** — `npm test` passes (or known failures documented)
- [ ] **Evidence directory exists** — `{EVIDENCE_ROOT}/assets/` created
- [ ] **Mock/seed data ready** — User can log in and reach the advanced flow wizard
- [ ] **Git branch created** — Working on the correct feature branch

---

## Master Checklist

### Instructions for the Implementing Agent

> **CRITICAL: You must follow these rules exactly.**
>
> 1. **Save at checkpoints.** Update this file at four checkpoints per task: **start time**, **end time/totals**, **verdict**, and **blocker/change** (if any). Do not batch — save immediately at each checkpoint.
>
> 2. **Check the checkbox** when you begin a task. This serves as a visual indicator of which task is currently in progress.
>
> 3. **Workflow for each IMPLEMENTATION task (numbered N):**
>    - Check the checkbox → Save (start checkpoint)
>    - Write start time → Save
>    - Complete the implementation work
>    - Run `{STATIC_ANALYSIS_CMD}` on changed files (capture output)
>    - Run `{TEST_CMD}` if applicable (capture output)
>    - Write end time, total time, human estimate, multiplier → Save (end checkpoint)
>    - **Immediately proceed to the paired verification task (Nv)**
>
> 4. **Workflow for each VERIFICATION task (numbered Nv):**
>    - Check the checkbox → Save (start checkpoint)
>    - Write start time → Save
>    - **Launch verification sub-agents in parallel** (see "Split-Agent Verification" below)
>    - Wait for all agents to complete. Collect their JSON output files from `{EVIDENCE_ROOT}/assets/`.
>    - **Merge results** into the HTML evidence report.
>    - Save report to `{EVIDENCE_ROOT}/task_NN_report.html`
>    - **Apply verdict:** ALL agents must report PASS for an overall PASS. ANY agent FAIL = overall FAIL.
>    - Update the Evidence column with `[PASS]` or `[FAIL]` link → Save (verdict checkpoint)
>    - Write end time, total time, human estimate, multiplier → Save
>    - **If FAIL:** Increment the Attempts column. Fix the issue, then re-verify with fresh agents.
>    - **If FAIL and Attempts = `{MAX_RETRIES}`:** STOP. Update Status to `BLOCKED`. Ask user for guidance.
>    - **If PASS:** Move to next implementation task.
>
> 5. **Time format:** Use `HH:MM` (24-hour format) for start/end times. Use minutes for total time and estimates.
>
> 6. **Multiplier calculation:** `Multiplier = Human Estimate ÷ Total Time`. Express as `Nx`.
>
> 7. **If blocked:** Note the blocker in the task description section below, set Status to `BLOCKED`, and move to the next unblocked task.

### Progress Dashboard

| Done | # | Task Name | Risk | Start | End | Total (min) | Human Est. (min) | Multiplier | Status | Attempts | Evidence | Blocker |
|:----:|:-:|-----------|:----:|:-----:|:---:|:-----------:|:----------------:|:----------:|:------:|:--------:|:--------:|:-------:|
| ⬜ | 1 | Implement: Synthesis API endpoint + system prompt | M | | | | 60 | | pending | — | — | |
| ⬜ | 1v | Verify: Synthesis API endpoint + system prompt | | | | | 30 | | pending | 0 | | |
| ⬜ | 2 | Implement: Update DiscoveryChat to pass model info | L | | | | 30 | | pending | — | — | |
| ⬜ | 2v | Verify: Update DiscoveryChat to pass model info | | | | | 15 | | pending | 0 | | |
| ⬜ | 3 | Implement: Synthesis call + pre-fill in page.tsx | H | | | | 90 | | pending | — | — | |
| ⬜ | 3v | Verify: Synthesis call + pre-fill in page.tsx | | | | | 45 | | pending | 0 | | |
| ⬜ | 4 | Implement: Synthesis loading state in configure step | M | | | | 45 | | pending | — | — | |
| ⬜ | 4v | Verify: Synthesis loading state in configure step | | | | | 30 | | pending | 0 | | |

> **Risk levels:** L = Low (boilerplate, config), M = Medium (feature work, standard logic), H = High (complex logic, shared state, async flow)

> **Status values:** `pending` | `in_progress` | `passed` | `failed` | `blocked`

**Summary:**
- Total tasks: 4 (implementation) + 4 (verification) = 8 total
- Completed: 0
- Passed verification: 0 / 4
- Failed then passed: 0
- Blocked: 0
- Total time spent: 0 minutes
- Total human estimate: 345 minutes
- Overall multiplier: —

---

## Evidence Generation Protocol

### Evidence Directory

```
{EVIDENCE_ROOT}/
├── assets/
│   ├── task_01_screen.png
│   ├── task_01_code_review.json
│   ├── task_01_test_results.json
│   ├── task_01_runtime.json
│   └── ...
├── task_01_report.html
├── task_02_report.html
├── task_03_report.html
├── task_04_report.html
└── summary.html
```

---

## Task Descriptions

---

### Task 1: Synthesis API Endpoint + System Prompt

**Risk:** M

**Intent:** Create the backend infrastructure for transcript synthesis — a new API endpoint and the system prompt that drives it.

**Context:** No existing synthesis endpoint or prompt exists. The discovery endpoint (`/api/chat/discovery`) hardcodes `DISCOVERY_CHAT_SYSTEM_PROMPT` and uses SSE streaming, so a separate non-streaming endpoint is cleaner for a one-shot synthesis call.

**Expected behavior:** `POST /api/chat/synthesize` accepts a discovery transcript, model, and provider, then returns a JSON response with a synthesized task description.

**Key components:**
- `conclave-app/app/api/chat/synthesize/route.ts` — **NEW FILE**
- `conclave-app/lib/flows/defaults.ts` — Add `SYNTHESIS_SYSTEM_PROMPT` constant

**Implementation details:**

1. **Add `SYNTHESIS_SYSTEM_PROMPT` to `lib/flows/defaults.ts`** (after `DISCOVERY_CHAT_SYSTEM_PROMPT` on line 331):

```typescript
export const SYNTHESIS_SYSTEM_PROMPT = `You are a task extraction assistant. Given a discovery conversation transcript between a user and an AI assistant, extract a clear, actionable task description.

Your output should be:
- A concise but comprehensive task description (1-3 paragraphs)
- Written as a direct instruction/request (not a conversation summary)
- Include specific details, constraints, and goals mentioned by the user
- Preserve the user's intent and any refined understanding from the conversation
- Ready to be used as the prompt for a multi-model AI collaboration flow

Output ONLY the task description. No preamble, no explanation, no markdown headers.`;
```

2. **Create `app/api/chat/synthesize/route.ts`:**

```typescript
// Non-streaming POST endpoint
// Request: { transcript: string, model: string, provider: string, apiKey?: string }
// Response: { task: string }
```

- Use the same provider client factories as the discovery endpoint (Anthropic, OpenAI, Google, xAI)
- Non-streaming: await the full response, return JSON `{ task: string }`
- Use `SYNTHESIS_SYSTEM_PROMPT` as system prompt
- Send the transcript as the user message content
- Use `temperature: 0.3` (low creativity for extraction) and `maxTokens: 1024`
- Handle errors with appropriate status codes

**Acceptance criteria:**
- [ ] `POST /api/chat/synthesize` returns a JSON response with `{ task: string }`
- [ ] Works with Anthropic provider (primary test path)
- [ ] Works with OpenAI provider
- [ ] Returns appropriate error for missing/invalid fields
- [ ] Uses `SYNTHESIS_SYSTEM_PROMPT` from defaults.ts
- [ ] `temperature: 0.3` for deterministic extraction

**Negative tests:**
- [ ] Missing `transcript` field returns 400 with error message
- [ ] Missing `provider` field returns 400 with error message
- [ ] Invalid provider returns 400 with error message
- [ ] Empty transcript returns 400 with error message

**Evidence requirements:**
- [ ] `curl` POST to `/api/chat/synthesize` with a sample transcript returns synthesized task
- [ ] Static analysis passes with 0 errors
- [ ] Error responses verified with curl

**Documentation impact:** None

**Rollback plan:** Delete `app/api/chat/synthesize/route.ts` and remove `SYNTHESIS_SYSTEM_PROMPT` from defaults.ts

**Notes:**
- Pattern follows the existing discovery endpoint structure but without SSE streaming
- Keep the same provider client factory functions (import from shared location or duplicate — prefer import)
- The synthesis prompt should produce clean output without markdown headers or preamble

---

### Task 2: Update DiscoveryChat to Pass Model Info

**Risk:** L

**Intent:** Modify the DiscoveryChat component to pass the selected model and provider along with the transcript when the user clicks "Continue to Configure".

**Context:** The parent component (page.tsx) needs to know which model was used for discovery so it can use the same model for the synthesis call. Currently, `onContinue` only passes a string transcript. The `selectedModel` state is internal to DiscoveryChat.

**Expected behavior:** When the user clicks "Continue to Configure", the DiscoveryChat passes `{ transcript, modelId, provider }` to the parent.

**Key components:**
- `conclave-app/components/flows/discovery-chat.tsx` — Modify onContinue interface

**Implementation details:**

1. **Update the `DiscoveryChatProps` interface** (line 41-47):

```typescript
interface DiscoveryContinueData {
  transcript: string;
  modelId: string;
  provider: string;
}

interface DiscoveryChatProps {
  onContinue: (data: DiscoveryContinueData) => void;  // was (transcript: string) => void
  onSkip: () => void;
  apiKeys?: Record<string, string>;
  flowType?: FlowType;
}
```

2. **Update `handleContinue`** (line 447-449):

```typescript
const handleContinue = useCallback(() => {
  onContinue({
    transcript: getTranscript(),
    modelId: selectedModel.id,
    provider: selectedModel.provider,
  });
}, [onContinue, getTranscript, selectedModel]);
```

3. **Export the `DiscoveryContinueData` type** so page.tsx can import it.

**Acceptance criteria:**
- [ ] `onContinue` receives an object with `transcript`, `modelId`, and `provider` fields
- [ ] The `DiscoveryContinueData` type is exported
- [ ] No functional change to the Skip button behavior
- [ ] TypeScript compiles without errors

**Negative tests:**
- [ ] Skip button still works (calls `onSkip()` without model info)

**Evidence requirements:**
- [ ] Static analysis passes with 0 errors
- [ ] TypeScript type check passes

**Documentation impact:** None

**Rollback plan:** Revert `discovery-chat.tsx` to pass `onContinue(getTranscript())` as a plain string

**Notes:** This is a minimal interface change. The component itself doesn't change behavior — it just passes more data to the parent.

---

### Task 3: Synthesis Call + Pre-fill in page.tsx

**Risk:** H

**Intent:** Wire up the synthesis call in the parent wizard page. When discovery finishes, call the synthesis endpoint and pre-fill `taskText` with the result.

**Context:** This is the core behavior change. The `handleDiscoveryContinue` callback currently just stores the transcript and navigates. After this task, it will also trigger an async synthesis call that populates the task textarea.

**Expected behavior:** After clicking "Continue to Configure" in Discovery, the user arrives at the Configure step and sees a synthesized task description appear in the Task Description textarea (possibly after a brief loading moment).

**Key components:**
- `conclave-app/app/(app)/flows/new/page.tsx` — Modify handleDiscoveryContinue, add state

**Implementation details:**

1. **Add synthesis state** (near line 206):

```typescript
const [isSynthesizing, setIsSynthesizing] = useState(false);
```

2. **Create a `synthesizeTask` helper function:**

```typescript
const synthesizeTask = useCallback(async (
  transcript: string,
  modelId: string,
  provider: string,
) => {
  setIsSynthesizing(true);
  try {
    const response = await fetch("/api/chat/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, model: modelId, provider }),
    });

    if (!response.ok) {
      console.warn("Synthesis failed:", response.status);
      return;
    }

    const data = await response.json();
    if (data.task) {
      setTaskText(data.task);
    }
  } catch (err) {
    console.warn("Synthesis error:", err);
    // Silent failure — user can type manually
  } finally {
    setIsSynthesizing(false);
  }
}, []);
```

3. **Update `handleDiscoveryContinue`** (line 356-362):

```typescript
const handleDiscoveryContinue = useCallback(
  (data: DiscoveryContinueData) => {
    setDiscoveryTranscript(data.transcript);
    goToNextStep();
    // Fire synthesis in background — result will populate taskText
    synthesizeTask(data.transcript, data.modelId, data.provider);
  },
  [goToNextStep, synthesizeTask]
);
```

4. **Import `DiscoveryContinueData`** from the discovery chat component.

5. **Pass `isSynthesizing` to configure step** (Task 4 handles the UI).

**Acceptance criteria:**
- [ ] After discovery, synthesis is triggered automatically
- [ ] On success, `taskText` is populated with the synthesized task
- [ ] On failure, `taskText` remains empty (user can type manually) — no crash
- [ ] `discoveryTranscript` is still set correctly (existing behavior preserved)
- [ ] Navigation to configure step happens immediately (synthesis runs in background)
- [ ] `isSynthesizing` state is true during the call, false after

**Negative tests:**
- [ ] Network failure during synthesis does not crash the app
- [ ] If user starts typing before synthesis completes, their input is NOT overwritten (race condition check)

**Evidence requirements:**
- [ ] Static analysis passes
- [ ] Runtime test: go through advanced flow, chat in discovery, click Continue → see synthesized task appear
- [ ] Runtime test: disconnect network before clicking Continue → no crash, empty field

**Documentation impact:** None

**Rollback plan:** Revert `handleDiscoveryContinue` to the original string-accepting version, remove `synthesizeTask` and `isSynthesizing`

**Notes:**
- **Critical race condition:** If the user starts typing in the TaskInput before synthesis completes, `setTaskText(data.task)` would overwrite their input. To handle this: only set taskText if it's still empty when the synthesis response arrives. Add a check: `if (!taskText.trim()) setTaskText(data.task)`. However, since synthesis should take ~3-5 seconds and the user would need to switch tabs, type, etc., this is unlikely. Still, the guard is important.
- The synthesis call fires after navigation (`goToNextStep()`) so the user sees the configure step immediately. The task text appears a few seconds later.

---

### Task 4: Synthesis Loading State in Configure Step

**Risk:** M

**Intent:** Show a loading indicator on the Configure step while synthesis is in progress, so the user understands their discoveries are being processed.

**Context:** After Task 3, synthesis runs in the background. The user arrives at Configure and sees an empty TaskInput for a few seconds until synthesis completes. Without a loading indicator, this looks like the same bug. The loading state bridges the gap.

**Expected behavior:** When the Configure step renders and `isSynthesizing` is true, show a loading overlay/indicator on the TaskInput area. When synthesis completes, the synthesized text appears and the indicator disappears.

**Key components:**
- `conclave-app/app/(app)/flows/new/page.tsx` — Configure step rendering (lines 900-1034)

**Implementation details:**

1. **Add a synthesis loading overlay** in the Configure step, both for basic and advanced mode TaskInput sections. Wrap the TaskInput in a relative container and show an overlay when `isSynthesizing`:

```tsx
<div className="relative">
  <TaskInput
    value={taskText}
    onChange={setTaskText}
    isRunning={isExecuting}
    disabled={isSynthesizing || !canProceedFromConfigure}
  />
  {isSynthesizing && (
    <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-lg">
      <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/10 border border-white/10">
        <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
        <span className="text-sm text-white/80">Synthesizing your discoveries...</span>
      </div>
    </div>
  )}
</div>
```

2. **Apply this to both basic mode** (line 906-911) **and advanced mode** (line 980-985) TaskInput sections.

3. **Disable the Run Flow button** during synthesis by updating the disabled condition (line 1206):

```typescript
disabled={!canProceedFromConfigure || isExecuting || isSynthesizing}
```

**Acceptance criteria:**
- [ ] Loading overlay appears on TaskInput when `isSynthesizing` is true
- [ ] Loading overlay disappears when synthesis completes
- [ ] Synthesized text appears in the textarea after overlay disappears
- [ ] "Run Flow" button is disabled during synthesis
- [ ] Loading overlay shows "Synthesizing your discoveries..." text with spinner
- [ ] Works in both basic mode and advanced mode configure steps

**Negative tests:**
- [ ] If synthesis fails, overlay disappears and user can type manually (no stuck state)
- [ ] Skip button path (no synthesis) shows no overlay

**Evidence requirements:**
- [ ] Screenshot of configure step with synthesis overlay visible
- [ ] Screenshot of configure step after synthesis completes (task text filled)
- [ ] Static analysis passes

**Documentation impact:** None

**Rollback plan:** Remove the overlay div wrappers around TaskInput, revert the Run Flow disabled condition

**Notes:** The overlay uses `backdrop-blur-sm` to match the app's glass-card aesthetic. The `Loader2` icon is already imported in page.tsx (used for the executing spinner).

---

## Appendix

### Technical Decisions

1. **Non-streaming synthesis endpoint** — The synthesis call returns a short task description (1-3 paragraphs). Streaming is unnecessary overhead for this use case and adds client-side complexity.

2. **Separate `/api/chat/synthesize` endpoint** — Preferred over adding an optional `systemPrompt` param to the discovery endpoint, because: (a) different response format (JSON vs SSE), (b) different temperature (0.3 vs 0.8), (c) cleaner separation of concerns.

3. **Fire-and-forget synthesis after navigation** — The user navigates to configure immediately and sees the result appear after a few seconds. This is better UX than blocking navigation for 3-5 seconds on a loading screen.

4. **Race condition guard** — Only set `taskText` if it's still empty when synthesis returns, to prevent overwriting user input.

### Dependencies

- No new npm packages needed
- Uses existing provider SDK clients (Anthropic, OpenAI, Google GenAI)
- Requires API keys for whichever provider was used in discovery

### Out of Scope

- Customizing system prompts based on discovery conversation
- Showing the raw transcript as a collapsible reference panel
- Synthesis for basic mode (basic mode skips discovery)
- Persisting synthesis results to database
- Retry logic for failed synthesis (silent failure is acceptable for MVP)
