# Implementation Plan: Human-in-the-Loop Flow Execution

---

## Executive Summary

We're building an interactive, iterative flow execution experience for Conclave that puts humans in control at every step. Instead of "fire and forget" flow execution, users will be able to discover ideas through conversation, configure every aspect of their agents (system prompts, LLM versions, temperature, etc.), run flows, review and edit results, and iterate multiple times with their edits feeding into subsequent turns. This transforms Conclave from a simple orchestration tool into a collaborative human-AI workspace.

**Key Outcomes:**
- Users can explore ideas through a discovery chat before running flows
- Full control over system prompts and LLM settings for each agent
- Iterative refinement: edit results, adjust prompts, run again
- All multi-turn flows support this human-in-the-loop pattern

---

## Product Manager Review

### Feature Overview

This implementation adds a new interactive execution mode to the existing flow creation wizard. It introduces a discovery phase, exposes system prompts and LLM settings for editing, and enables iterative execution where edited results become inputs for subsequent turns.

### Features

#### Feature 1: Discovery Chat Phase

**What it is:** A conversational pre-execution step where users chat with an LLM of their choice to explore and refine their ideas before running a flow.

**Why it matters:** Users often need to think through their problem before committing to a structured flow. Discovery chat provides a low-friction way to clarify intent and context.

**User perspective:** After selecting a flow type, users pick an LLM (Claude, GPT-4, Gemini, etc.) and have a freeform conversation. The chat context helps them articulate what they want the flow to accomplish. When ready, they click "Continue to Configure" carrying forward their refined thinking.

---

#### Feature 2: System Prompt & LLM Configuration

**What it is:** An expanded configuration step where users can view and edit auto-generated system prompts for each agent, select specific LLM versions, and tune parameters like temperature, max tokens, top_p, and penalties.

**Why it matters:** Power users need fine-grained control over how each agent behaves. System prompts define agent personality and focus; LLM settings control creativity and output characteristics.

**User perspective:** Users see an accordion or tabbed interface with one section per agent. Each section shows the auto-generated system prompt (editable), a model version dropdown, and sliders/inputs for temperature (0-2), max tokens, top_p (0-1), presence penalty (-2 to 2), and frequency penalty (-2 to 2). Preset buttons ("Creative", "Balanced", "Precise") provide quick defaults.

---

#### Feature 3: Result Editing & Iteration

**What it is:** After execution, users can view each agent's output, edit it inline, and run another turn where edited results become the input context for the next iteration.

**Why it matters:** AI outputs often need refinement. Rather than copying to an external editor, users can iterate in-place, building up a multi-turn conversation with full control at each step.

**User perspective:** Results display shows each agent's response in an editable markdown editor. An "Edited" badge appears when changes are made. Users can adjust system prompts again, then click "Run Another Turn" - their edits become `{{previous_responses}}` for the next execution. A history panel shows all turns for reference and export.

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
> 5. **Multiplier calculation:** `Multiplier = Human Estimate ÷ Total Time`. Express as `Nx` (e.g., `10x` means 10 times faster than human estimate).
>
> 6. **If blocked:** Note the blocker in the task description section below and move to the next unblocked task.

### Progress Dashboard

| Done | # | Task Name | Start | End | Total (min) | Human Est. (min) | Multiplier |
|:----:|:-:|-----------|:-----:|:---:|:-----------:|:----------------:|:----------:|
| [ ] | 1 | Create LLM Settings Types & Defaults | | | | 30 | |
| [ ] | 2 | Build Discovery Chat Component | | | | 90 | |
| [ ] | 3 | Build System Prompt Editor Component | | | | 60 | |
| [ ] | 4 | Build LLM Settings Panel Component | | | | 60 | |
| [ ] | 5 | Build Result Editor Component | | | | 60 | |
| [ ] | 6 | Build Iteration Controls Component | | | | 45 | |
| [ ] | 7 | Update Flow Creation Wizard (Steps) | | | | 90 | |
| [ ] | 8 | Update Execution API Route | | | | 60 | |
| [ ] | 9 | Update Backend Executor | | | | 90 | |
| [ ] | 10 | Integration Testing & Polish | | | | 60 | |

**Summary:**
- Total tasks: 10
- Completed: 0
- Total time spent: 0 minutes
- Total human estimate: 645 minutes (~10.75 hours)
- Overall multiplier: TBD

---

## Task Descriptions

This section provides context for each task. Read the relevant description before starting implementation.

---

### Task 1: Create LLM Settings Types & Defaults

**Intent:** Define TypeScript types and default values for LLM configuration that will be used throughout the feature.

**Context:** This is a foundational task. All subsequent components will use these types. Must be done first.

**Expected behavior:** Types are importable from a central location. Default settings exist for each provider/model combination.

**Key components:**
- `lib/types/llm-settings.ts` (new) - LLMSettings interface, presets
- `lib/flows/defaults.ts` (new) - Default system prompts per flow type, default settings per model

**Notes:**
- Temperature range varies by provider (OpenAI: 0-2, Anthropic: 0-1, Google: 0-2)
- Max tokens varies by model (need model metadata)
- Consider using existing model data from `lib/flows/config.ts`

---

### Task 2: Build Discovery Chat Component

**Intent:** Create a reusable chat interface for the discovery phase where users can converse with a selected LLM.

**Context:** This is Step 2 in the new wizard flow. Depends on Task 1 for types. Can reuse patterns from existing Flow Architect chat.

**Expected behavior:** User selects an LLM from a dropdown, types messages, sees streaming responses. Chat history persists within the session. "Continue to Configure" button advances to Step 3.

**Key components:**
- `components/flows/discovery-chat.tsx` (new) - Main component
- `lib/hooks/use-discovery-chat.ts` (new) - Chat state management hook
- May reuse: `components/chat/chat-input.tsx`, `components/chat/chat-message-list.tsx`

**Notes:**
- Simpler than Flow Architect - no tool use, just conversation
- Should call a simple chat API endpoint (may need to create)
- Store chat transcript in component state (not persisted to DB)

---

### Task 3: Build System Prompt Editor Component

**Intent:** Create an interface for viewing and editing system prompts for each agent in a flow.

**Context:** Part of Step 3 (Configure). Depends on Task 1 for types. Must show auto-generated defaults but allow editing.

**Expected behavior:** Accordion/tabs showing each agent. Each section has: agent name, model badge, large textarea with system prompt, "Reset to Default" button, variable hints tooltip.

**Key components:**
- `components/flows/system-prompt-editor.tsx` (new)
- Uses: `lib/flows/defaults.ts` for default prompts

**Notes:**
- Auto-generate prompts based on flow type + agent role (leader/contributor)
- Show available variables: `{{task}}`, `{{previous_responses}}`, etc.
- Consider syntax highlighting for variables
- Must handle variable number of agents (2-6 typically)

---

### Task 4: Build LLM Settings Panel Component

**Intent:** Create controls for adjusting LLM parameters like temperature, max tokens, top_p, and penalties.

**Context:** Part of Step 3 (Configure). Depends on Task 1 for types. Sits alongside System Prompt Editor.

**Expected behavior:** Per-agent collapsible panels with: model version dropdown, temperature slider, max tokens input, top_p slider, presence/frequency penalty sliders. Preset buttons at top. "Apply to All" checkbox.

**Key components:**
- `components/flows/llm-settings-panel.tsx` (new)
- `components/ui/slider.tsx` (may exist, or use shadcn)

**Notes:**
- Validate ranges per provider (temperature max varies)
- Show current value next to each slider
- Presets: Creative (temp=1.2, topP=0.95), Balanced (temp=0.7, topP=0.9), Precise (temp=0.3, topP=0.8)
- Model dropdown should show available models for that provider

---

### Task 5: Build Result Editor Component

**Intent:** Create an editable view of agent outputs that tracks changes and can feed edits into the next iteration.

**Context:** Part of Step 5 (Review & Edit). Used after execution. Edited content becomes input for next turn.

**Expected behavior:** Each agent's result in a markdown editor. "Edited" badge when modified. Original vs edited diff toggle. Per-agent or global "Use as Input" toggle.

**Key components:**
- `components/flows/result-editor.tsx` (new)
- May use: react-markdown, monaco-editor, or simple textarea

**Notes:**
- Must preserve original for diff/reset
- Markdown rendering in read mode, raw text in edit mode
- Consider autosave or explicit save
- Large outputs need scrollable container

---

### Task 6: Build Iteration Controls Component

**Intent:** Create UI for running additional turns and viewing iteration history.

**Context:** Appears after first execution. Orchestrates the edit → run → review cycle.

**Expected behavior:** "Run Another Turn" button (disabled if no edits). Turn counter (Turn 1, Turn 2...). Collapsible history showing all previous turns. "Export All Turns" button.

**Key components:**
- `components/flows/iteration-controls.tsx` (new)
- `components/flows/turn-history.tsx` (new)

**Notes:**
- History should show: turn number, timestamp, which agents ran, summary
- Export formats: Markdown, JSON
- Consider turn comparison view

---

### Task 7: Update Flow Creation Wizard (Steps)

**Intent:** Modify the existing wizard to incorporate new steps and components.

**Context:** Main integration task. Depends on Tasks 2-6. Modifies `app/(app)/flows/new/page.tsx`.

**Expected behavior:**
- Step 0: Method selection (unchanged)
- Step 1: Pick flow type (unchanged)
- Step 2: Discovery chat (NEW)
- Step 3: Configure - system prompts + LLM settings (ENHANCED)
- Step 4: Execute (adjusted)
- Step 5: Results with editing + iteration (ENHANCED)

**Key components:**
- `app/(app)/flows/new/page.tsx` - Major modifications
- State management for flow config, prompts, settings, iteration

**Notes:**
- Large file (705 lines) - consider extraction to smaller components
- Need to pass config state through all steps
- Step 5 needs to loop back to Step 4 for iterations

---

### Task 8: Update Execution API Route

**Intent:** Extend the execution API to accept custom system prompts and LLM settings.

**Context:** Backend integration. Depends on Task 1 for types. Modified by Task 7.

**Expected behavior:** API accepts `system_prompts`, `llm_settings`, and `previous_results` in request body. Validates and passes to executor.

**Key components:**
- `app/api/flows/execute/route.ts` - Extend request schema
- Request schema validation (Zod)

**Notes:**
- Backward compatible - all new fields optional
- Validate settings are within provider limits
- previous_results used for iteration context injection

---

### Task 9: Update Backend Executor

**Intent:** Modify the Python executor to use custom system prompts and LLM settings when calling provider APIs.

**Context:** Final backend piece. Receives data from Task 8. Actually applies the customizations.

**Expected behavior:** Executor uses provided system_prompt for each participant. Applies temperature, max_tokens, top_p, penalties to API calls. Injects previous_results into context for iterations.

**Key components:**
- `executor_api/api.py` - Accept new fields
- `src/lib/executor_v2.py` - Apply settings to LLM calls
- Provider-specific adjustments (Anthropic, OpenAI, Google, xAI)

**Notes:**
- Each provider API has slightly different parameter names
- Some providers don't support all parameters (check docs)
- Anthropic: temperature (0-1), max_tokens
- OpenAI: temperature (0-2), max_tokens, top_p, presence_penalty, frequency_penalty
- Google: temperature (0-2), max_output_tokens, top_p

---

### Task 10: Integration Testing & Polish

**Intent:** End-to-end testing of the complete feature and UX polish.

**Context:** Final task. All other tasks complete.

**Expected behavior:** Complete flow works: Discovery → Configure → Execute → Edit → Iterate. No crashes, good error handling, responsive UI.

**Key components:**
- All components from Tasks 2-6
- Wizard from Task 7
- APIs from Tasks 8-9

**Notes:**
- Test with different flow types (Hub-Spoke, Round-Robin)
- Test iteration (3+ turns)
- Test error cases (API failures, invalid settings)
- Mobile responsiveness check
- Loading states and skeletons

---

## Appendix

### Technical Decisions

1. **State Management:** Use React useState/useReducer within wizard component. No global state (Zustand/Redux) needed since flow config is local to the creation session.

2. **Chat API:** Discovery chat will use a simple endpoint that proxies to the selected LLM provider. No persistent conversation - session only.

3. **System Prompt Generation:** Default prompts are generated based on flow type + agent role. Stored in `lib/flows/defaults.ts`.

4. **Iteration Storage:** Turn history stored in component state during session. Optionally saved to `runs` table on completion.

### Dependencies

- Existing: React, Next.js, Tailwind, shadcn/ui, Supabase
- May add: Monaco Editor or similar for markdown editing (optional)
- Backend: Anthropic SDK, OpenAI SDK, Google AI SDK

### Out of Scope

- Persisting discovery chat to database
- Sharing iterations with other users
- Template library for custom system prompts
- A/B testing different prompt variations
- Cost estimation for iterations (show actual cost only)
- Mobile-optimized experience (desktop-first)
