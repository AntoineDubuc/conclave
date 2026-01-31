# Implementation Plan: Wave 3 -- Session UI (Phase 8: Conclave Sessions)

> **Revision 3** -- Incorporates all findings from the Revision 2 review. Critical changes: Option B (refactored raw Anthropic API) is now the RECOMMENDED path for Wave 3; Agent SDK (Option A) is repositioned as aspirational upgrade pending resolution of the subprocess-per-query concurrency model. SDK spike (Task 2) updated to test `test_flow` adapter (complex nested schema) instead of `list_available_models` (trivial), and to explicitly validate subprocess concurrency. `query()` prompt parameter corrected to `AsyncIterable<SDKUserMessage>` (required when MCP servers are provided). `container-app` max-width escape addressed in Task 6. `flow_started`/`flow_completed` rendered as visible chat messages (Task 8). Zod v3/v4 mismatch across services documented. Empty-artifacts guard added to workspace renderer. Session list Wave 1 fallback specified.
>
> **Revision 2** -- Incorporates all findings from the User & Senior Engineer audit of the original plan. Critical changes: Agent SDK migration tasks rewritten to account for MCP-based tool registration pattern, time-boxed spike added, fallback path defined. AppShell layout override specified with negative-margin approach. Unit tests added to Tasks 5, 7, and 9. Empty workspace onboarding state designed. SuggestedPrompt interactivity addressed. Mobile input bar / MobileNav overlap resolved. Card grid uses in-place expansion instead of modal.

---

## Executive Summary

Wave 3 delivers the user-facing experience of Conclave Sessions: a persistent, two-panel workspace where users collaborate with an intelligent agent that assembles and runs multi-model flows on the fly. This is the wave where Sessions become real for users -- the backend persistence (Wave 1) and smart context (Wave 2) become invisible plumbing behind a new kind of AI interaction surface. The core deliverable is a `/sessions` route in the Next.js app with an adaptive workspace on the left, a chat panel on the right, a persistent input bar at the bottom, and a session tree for navigation. On the backend, this wave introduces a new session conductor prompt and a session-specific handler that replaces the cautious interviewer persona with a collaborative executor. The handler is built using a refactored raw Anthropic API handler (Option B, recommended) that achieves a clean SSE event contract -- or, if the SDK spike demonstrates that the Agent SDK's subprocess-per-query model is viable for concurrent server use, using the Claude Agent SDK with MCP-based custom tool registration (Option A, aspirational upgrade).

**Key Outcomes:**
- Users can start a session, direct the agent to run flows, and see results rendered in an adaptive workspace -- all without leaving the conversation
- The agent becomes a responsive collaborator ("Got it, I'll run that now") instead of a methodical consultant ("Let me understand your needs...")
- A ViewHint type system lets the agent tell the frontend what to render, with safe fallbacks for unknown or missing hints
- The session tree provides structured navigation through long, multi-flow sessions

---

## Product Manager Review

### Feature Overview

Wave 3 is the largest wave in Phase 8 and the one that puts Sessions in front of users. Where Waves 1 and 2 built the foundation (persistence, auth, smart context), Wave 3 builds the house. After this wave, a user can navigate to `/sessions`, start a conversation, ask the agent to run a multi-model brainstorm, see the results appear in an adaptive workspace, and immediately follow up with "now have Claude synthesize these" -- all without re-explaining context, copy-pasting outputs, or leaving the page.

### Features

#### Feature 1: Two-Panel Session Workspace

**What it is:** A new `/sessions` route with an IDE-style layout -- workspace on the left, chat on the right, persistent input bar at the bottom.

**Why it matters:** Today, flow results appear inside chat bubbles. Five persona outputs crammed into a message thread are unreadable. The two-panel layout gives results the space they need (full-width workspace for reviewing) while keeping the chat always accessible for directing the next step.

**User perspective:** Users land on a familiar split-pane interface. On the left they see their session tree and any artifacts the agent has produced. On the right they converse with the agent. When flow results arrive, the workspace fills with a tabbed view, card grid, or document view appropriate to the content. The user reads, compares, and then types "now have Claude write a brief from all of this" in the input bar -- which is always visible, even when the workspace is expanded full-width. No mode switches, no hidden panels, no lost context.

---

#### Feature 2: Session Conductor Agent

**What it is:** A new agent prompt and persona optimized for session-mode collaboration -- action-oriented, context-aware, and ready to run flows immediately.

**Why it matters:** The current Flow Architect prompt says "DO NOT build immediately" and "ask 2-3 questions before proposing." That is the right behavior for designing a new flow from scratch. It is the wrong behavior for a session where the user says "run 5 personas on this" and expects the agent to start running. Sessions need a collaborator, not a consultant.

**User perspective:** The user types "I want to ideate on a mobile app for elderly care" and the agent responds with a concrete suggestion and offers to run it -- not with three clarifying questions. The agent remembers prior flow results, references them naturally ("Gemini's point about medication tracking was strong -- want me to go deeper?"), and proactively suggests next steps. The conversation feels like working with a sharp colleague, not filling out a form.

---

#### Feature 3: Session Tree Navigation

**What it is:** A tree-structured sidebar within the workspace that shows everything that has happened in a session -- flow runs as expandable nodes, individual outputs as child nodes, accumulated artifacts.

**Why it matters:** Sessions can run for an hour with 10+ flow executions. Without structured navigation, the user gets lost. "What did Gemini say in that second run?" should be answerable with a single click, not by scrolling through a wall of chat history.

**User perspective:** The session tree shows the session name and goal at the top, followed by each flow run as a collapsible node (e.g., "Hub-and-Spoke: Elderly Care Ideation" with timestamp and model icons). Clicking a child node ("Gemini -- Caregiver Persona") loads that artifact in the workspace. A breadcrumb trail ("Session > Flow 2 > Gemini Persona Output") always tells the user where they are.

---

#### Feature 4: ViewHint System and Adaptive Workspace

**What it is:** A typed contract between the agent and the frontend that determines how flow results are rendered. The agent emits a `view_hint` field (`card_grid`, `tabbed_view`, `document`, `comparison`, `flow_diagram`), and the workspace renders the appropriate React component.

**Why it matters:** A Hub-and-Spoke with 3 models needs a different layout than 5 Gemini personas, which is different from a single Claude synthesis brief. The user should not have to configure layouts. The system should adapt.

**User perspective:** Results just look right. Multi-model parallel outputs appear in tabs. Persona explorations appear as a card grid with persona labels. A single synthesis brief fills the full width as an editable document. The user never thinks about layout -- they think about content.

---

#### Feature 5: Session Handler (with Agent SDK or Refactored Raw API)

**What it is:** A new session-specific handler that creates the agentic loop for session mode. The recommended approach (Option B) is a refactored handler using the raw Anthropic API with a clean SSE event contract, which avoids the concurrency risks of the Agent SDK's subprocess-per-query model. If the time-boxed spike (2-4 hours) demonstrates that the Agent SDK's subprocess model is viable for concurrent server use, the handler can be upgraded to use the Claude Agent SDK with MCP-based custom tool registration (Option A, aspirational).

**Why it matters:** The current handler is a 365-line hand-rolled agentic loop that manually manages stream parsing, tool-call accumulation, and JSON delta stitching. A session handler with better separation of concerns -- whether achieved via the Agent SDK or a clean refactor -- reduces maintenance burden and enables the workspace_update events that the frontend needs.

**User perspective:** Invisible. The user sees the same streaming responses regardless of the backend implementation. What matters is that the handler emits `workspace_update` events with `view_hint` values, and that the session conductor prompt drives the experience.

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
| [ ] | 1 | Session conductor prompt | | | | | |
| [ ] | 2 | Agent SDK spike (time-boxed 2-4 hours) | | | | | |
| [ ] | 3 | Session handler -- Option B refactored raw API (recommended) or Option A MCP adapter (if spike validates) | | | | | |
| [ ] | 4 | Session handler -- SSE event bridging + workspace_update emission | | | | | |
| [ ] | 5 | ViewHint type system and shared types (with unit tests) | | | | | |
| [ ] | 6 | Session page route and two-panel layout shell | | | | | |
| [ ] | 7 | SSE parsing utility extraction + session chat hook (with unit tests) | | | | | |
| [ ] | 8 | Chat panel (reuse + adapt existing components) | | | | | |
| [ ] | 9 | Workspace renderer and view registry (with unit tests) | | | | | |
| [ ] | 10 | `document` workspace view | | | | | |
| [ ] | 11 | `tabbed_view` workspace view | | | | | |
| [ ] | 12 | `card_grid` workspace view (in-place expansion) | | | | | |
| [ ] | 13 | Session tree component (with bidirectional chat navigation) | | | | | |
| [ ] | 14 | Persistent input bar (with mobile/MobileNav z-index resolution) | | | | | |
| [ ] | 15 | Session list page and sidebar navigation | | | | | |
| [ ] | 16 | Responsive layout and mobile collapse | | | | | |
| [ ] | 17 | Integration test -- full session round-trip | | | | | |

**Summary:**
- Total tasks: 17
- Completed: 0
- Total time spent: 0 minutes
- Total human estimate: 0 minutes
- Overall multiplier: --

---

## Task Descriptions

This section provides context for each task. Read the relevant description before starting implementation.

---

### Task 1: Session Conductor Prompt

**Intent:** Create the new system prompt that defines the session agent's personality, capabilities, and behavior. This is the "brain" of the session experience -- it determines whether the agent feels like a responsive collaborator or a cautious form-filler.

**Context:** The current agent uses the Flow Architect prompt (`conclave_ui/agent-service/src/prompts/flow-architect.ts`), which instructs the agent to "DO NOT build immediately" and "ask 2-3 questions before proposing." This is correct for the `/flows/new/chat` route. For `/sessions`, we need the opposite: an agent that acts on requests immediately, references prior context naturally, and suggests next steps proactively. Per the architecture review (Theme 2, "The Persona Problem"), we are using Option B: two separate agents with separate prompts and separate entry points, sharing the same tool definitions.

**Expected behavior:** The session conductor prompt should:
- Instruct the agent to act on requests immediately -- when the user says "run X", the agent runs X
- Reference prior session context naturally (e.g., "Building on Gemini's medication tracking insight from the earlier brainstorm...")
- Suggest next steps after flow results return (e.g., "Gemini had the strongest take -- want me to go deeper?")
- Emit `view_hint` values in `workspace_update` events to tell the frontend how to render results
- Know about all available tools (`test_flow`, `list_available_models`, `show_flow_diagram`, `estimate_cost`, `recall_context`) and use them fluently
- Know about the session brief (from Wave 2) and how to use it for context
- Stay concise -- session agents should not write essays when a sentence suffices

**Key components:**
- New file: `conclave_ui/agent-service/src/prompts/session-conductor.ts`
- Pattern to follow: `conclave_ui/agent-service/src/prompts/flow-architect.ts` (function signature, export pattern)
- Must export `buildSessionConductorPrompt(userId: string, sessionBrief?: string): string`

**Full prompt text to implement:**

```typescript
export function buildSessionConductorPrompt(userId: string, sessionBrief?: string): string {
  const briefSection = sessionBrief
    ? `\n\n## Session Context (Brief)\n\nThe following is a summary of what has happened in this session so far:\n\n${sessionBrief}\n\nUse this context to inform your responses. Reference prior results naturally. Do not repeat information the user already knows.`
    : "";

  return `You are the Session Conductor, a collaborative AI partner in Conclave Sessions. You help users think through complex problems by assembling and running multi-model AI collaborations on the fly.

## Your Personality

You are a sharp, action-oriented colleague. When the user has a clear request, you execute it. When they are exploring, you suggest concrete next steps. You are not an interviewer -- you do not ask 3 questions before doing anything. You bias toward action.

- If the user says "run X", you run X. Do not ask "are you sure?" or "what specifically about X?"
- If the user is vague, make a reasonable assumption and offer to adjust: "I'll set up a 3-model brainstorm on that. Want me to tweak the models or approach?"
- After flow results return, analyze them briefly and suggest a next step: "Claude's analysis was the most detailed. Want me to have GPT challenge it, or should we go deeper on Claude's points?"
- Reference prior session context naturally. Say "building on what Gemini found earlier" not "as shown in the previous flow execution results."
- Keep responses concise. One paragraph, not three. The user is here to work, not to read.

## Tools Available

You have these tools:

1. **test_flow** -- Execute a multi-model flow. This is your primary tool. Use it when the user wants to run models on a task.
   - Supports parallel execution (multiple models at once), sequential (chain of models), and single-model tasks
   - You decide the flow pattern, models, and prompts based on the user's request
   - Always include relevant session context in prompts you build for the flow

2. **list_available_models** -- Get info about available AI models, their capabilities, and pricing.
   - Use when the user asks "what models can I use?" or when you need to recommend models

3. **show_flow_diagram** -- Display an ASCII diagram of a flow design.
   - Use to show the user what you are about to run before executing

4. **estimate_cost** -- Calculate expected cost for a flow.
   - Use before expensive runs (3+ models, multiple phases) so the user can approve

5. **recall_context** -- Search past session events by keyword.
   - Use when the user references something from earlier that is not in your recent context
   - Use when you need to quote a specific prior result

## How to Run Flows

When the user asks you to run something:

1. Decide on the flow pattern based on the request:
   - "Get multiple perspectives" -> Parallel execution with 2-4 models
   - "Have X challenge Y's output" -> Sequential execution
   - "Write a brief / synthesize" -> Single model with accumulated context
   - "Run 5 personas on this" -> Single model, parallel prompts with different persona framing

2. Build the flow configuration with appropriate prompts. Inject relevant session context into the prompts.

3. Call test_flow to execute. The user will see progress as the flow runs.

4. When results return, provide a brief analysis (2-3 sentences) highlighting:
   - Which output was strongest and why
   - Key differences between outputs
   - A concrete suggested next step

## Workspace Updates

When a flow completes, its results appear in the user's workspace. You influence how they are displayed by recommending a view_hint:

| Scenario | view_hint | When to use |
|---|---|---|
| Multiple models ran in parallel | "tabbed_view" | 2-4 model outputs, each deserves focused reading |
| Persona exploration (N perspectives) | "card_grid" | 3+ outputs that benefit from side-by-side scanning |
| Single model output (brief, synthesis) | "document" | One output that needs full-width reading space |
| Two outputs to compare directly | "comparison" | User explicitly wants to compare two specific results |
| Flow structure visualization | "flow_diagram" | User asks to see how the flow is structured |

When in doubt, omit the view_hint and let the frontend choose the default. If you must pick one, use "document" -- it always works.

## What You Do NOT Do

- Do not ask multiple clarifying questions before acting. One question maximum, and only if the request is genuinely ambiguous.
- Do not explain how flows work unless asked. The user knows.
- Do not apologize for limitations. If you cannot do something, say what you can do instead.
- Do not reference internal system details (session IDs, event types, API calls). The user sees a thinking partner, not a system.
- Do not say "I've completed the flow" -- the user can see the results in their workspace. Instead, analyze the results.
${briefSection}`;
}
```

**Notes:** The prompt is ~800 tokens, well under the 2000-token budget. The session brief section is injected dynamically and may add 200-500 tokens depending on session length. The prompt explicitly mentions ViewHint values and gives the agent a decision table. The prompt must NOT reference the Flow Architect persona. If the `recall_context` tool from Wave 2 is not ready, remove it from the tool list and add a TODO comment.

---

### Task 2: Agent SDK Spike (Time-Boxed 2-4 Hours)

**Intent:** Determine whether the Claude Agent SDK can be used for the session handler in a server-side Express context, or whether Option B (refactored raw Anthropic API) should be used. Option B is the recommended path based on the review's analysis that the SDK spawns a subprocess per `query()` call, which is a poor fit for concurrent server use. This spike validates that hypothesis. This is a decision gate, not a deliverable.

**Context:** The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) is a programmatic interface to Claude Code, NOT a higher-level wrapper around the Anthropic Messages API. Custom tools must be registered via MCP servers using `createSdkMcpServer()` with Zod schemas and `CallToolResult` return types -- not via the `allowedTools` array with Anthropic-style `input_schema` objects. The SDK also requires Claude Code to be installed and authenticated on the host machine. Critically, the SDK spawns a Claude Code child process for every `query()` call. For a server handling N concurrent sessions, this means N child processes -- a fundamentally different concurrency model than a direct API client. These are fundamentally different from what a naive reading of the SDK name suggests.

**Important: `query()` prompt parameter with MCP servers.** When `mcpServers` is provided, `query()` requires an `AsyncIterable<SDKUserMessage>` for the `prompt` parameter -- a plain string will NOT work. The correct pattern:

```typescript
async function* generateMessages(userMessage: string) {
  yield {
    type: "user" as const,
    message: {
      role: "user" as const,
      content: userMessage
    }
  };
}

for await (const message of query({
  prompt: generateMessages("Run a brainstorm on elderly care"),
  options: {
    mcpServers: { "conclave-tools": conclaveServer }
  }
})) { /* ... */ }
```

**The spike must answer these questions:**

1. **Can we install and run the SDK?** Install `@anthropic-ai/claude-agent-sdk`. Verify Claude Code is available on the development machine. Run a minimal `query()` with an async generator prompt (NOT a plain string -- see above) and confirm it yields messages.

2. **Can we register custom tools via MCP?** Create a minimal in-process MCP server with one test tool using `createSdkMcpServer()` and the `tool()` helper with a Zod schema. Verify the agent can call it. Specifically, verify:
   - The `tool()` helper accepts a Zod schema for input
   - The handler receives typed args and returns `CallToolResult`
   - The tool is callable by Claude via the `mcp__<server>__<tool>` naming convention
   - Session context can be passed via closure (the tool handler needs access to the `Session` object)

3. **Can we get streaming deltas?** Set `includePartialMessages: true`. Verify `SDKPartialAssistantMessage` events contain `RawMessageStreamEvent` objects with `text_delta` and `input_json_delta` types. Note: the message type is `type: 'stream_event'` with an `event: RawMessageStreamEvent` field -- not a direct `text_delta`. The existing delta parsing logic must unwrap the `event` field first. Verify these can be mapped to our existing SSE event format.

4. **What is the adapter cost for a complex tool?** Write a prototype adapter that converts `test_flow` (NOT `list_available_models`) from the current `Tool` interface to an `SdkMcpToolDefinition`. `test_flow` has a complex nested schema with `flow_config: { type: "object" }` (no further definition) and optional nested `api_keys`. If this converts cleanly, everything else will too. If only `list_available_models` converts cleanly, that proves nothing about the hard cases. Measure: How many lines? Does `flow_config` require `z.record(z.unknown())` or a manually-written detailed schema?

5. **Is the subprocess model viable for concurrent server use?** The SDK spawns a Claude Code child process per `query()` call. Test specifically:
   - Can two `query()` calls run concurrently without interference?
   - What is the cold start time for `query()`?
   - Does the subprocess survive if the parent Express request is aborted?
   - If any of these fail, Option B (raw API) is confirmed as the correct choice, not a fallback.

**Decision criteria:**
- **Proceed with SDK (Option A)** if: all five questions are answered positively, the adapter for `test_flow` is under 50 lines, concurrent `query()` calls work without interference, and the streaming deltas are compatible with the existing SSE pipeline.
- **Confirm Option B (recommended path)** if: Claude Code runtime is not installable in the deployment environment, the MCP adapter is over 50 lines per tool, the subprocess model does not support concurrent sessions, streaming requires significant post-processing, or any of the five questions fails. This is the expected outcome based on review analysis.

**Key components:**
- Spike code (temporary): `conclave_ui/agent-service/src/agent/sdk-spike.ts`
- Decision record: add to the top of Task 3 description ("SDK spike outcome: [proceed/fallback]")
- `conclave_ui/agent-service/package.json` -- add `@anthropic-ai/claude-agent-sdk` dependency (conditional on spike outcome)
- Bump `zod` from `^3.22.4` to `^3.24.1` in agent-service if proceeding with SDK (required for SDK compatibility)

**Notes:** The spike is time-boxed. If any question takes more than 1 hour to answer, that itself is an answer (the integration is too complex for the value it provides). Delete the spike code after the decision is made -- it is throwaway, not production code. Document the decision and rationale in a comment at the top of the session handler file (Task 3). Based on review analysis, the expected outcome is that the subprocess model will be unsuitable for concurrent server use, confirming Option B as the right choice. This is not a "failure" of the spike -- it is the spike doing its job by correctly identifying a deployment constraint.

**Zod version note:** The agent-service uses `zod: ^3.22.4` while `conclave-app` uses `zod: ^4.3.5`. The Agent SDK's `tool()` helper requires Zod v3 APIs. Zod v4 has breaking API changes. This means: (a) the two services cannot share a single Zod version; (b) shared types (Task 5) cannot use Zod for runtime validation on both sides; (c) if proceeding with the SDK, stay on Zod v3 in agent-service. The frontend `isValidViewHint()` wisely avoids Zod and uses a plain `includes()` check. Do not attempt to share Zod schemas across the monorepo boundary.

---

### Task 3: Session Handler -- MCP Tool Adapter + Query Loop (or Option B Fallback)

**Intent:** Create the session-specific handler that drives the agentic loop for session mode, using either the Agent SDK (if the spike succeeded) or a refactored raw Anthropic API handler.

**Context:** This is the riskiest task in Wave 3. The handler must:
1. Accept a user message and session context
2. Run the agentic loop (LLM call -> tool calls -> LLM call -> ... -> final response)
3. Yield events compatible with the existing SSE streaming protocol
4. Use the session conductor prompt (Task 1)
5. Register all existing tools (`test_flow`, `show_flow_diagram`, `estimate_cost`, `list_available_models`, and `recall_context` from Wave 2 if available)

**Option B (refactored raw Anthropic API) is the RECOMMENDED path** based on the review's assessment that the Agent SDK's subprocess-per-query model is a poor fit for server-side Express handlers serving concurrent users. Option A is documented below for completeness and in case the spike (Task 2) disproves the subprocess concern.

**If proceeding with Agent SDK (Option A -- aspirational, pending spike outcome):**

The handler must:
- Create an in-process MCP server via `createSdkMcpServer({ name: "conclave-tools", tools: [...] })`
- Adapt each existing tool using `tool()` helper with Zod schemas. The adapter pattern:

```typescript
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Session } from "../types/index.js";

// Adapter: wrap an existing tool for the Agent SDK
function adaptTool(
  existingTool: Tool,
  sessionRef: { current: Session | null }
) {
  // Convert JSON Schema properties to Zod schema
  const zodSchema = jsonSchemaToZod(existingTool.schema.input_schema.properties);

  return tool(
    existingTool.name,
    existingTool.schema.description,
    zodSchema,
    async (args): Promise<CallToolResult> => {
      const session = sessionRef.current;
      if (!session) {
        return { content: [{ type: "text", text: "No active session" }], isError: true };
      }
      try {
        const result = await existingTool.execute(args as Record<string, unknown>, session);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : "Unknown"}` }],
          isError: true,
        };
      }
    }
  );
}
```

- Pass the MCP server to `query()` via `mcpServers`
- **Important:** When `mcpServers` is provided, `query()` requires `AsyncIterable<SDKUserMessage>` for the `prompt` parameter -- a plain string will NOT work. Wrap the user message in an async generator:
```typescript
async function* wrapUserMessage(message: string) {
  yield {
    type: "user" as const,
    message: { role: "user" as const, content: message }
  };
}
// Usage: query({ prompt: wrapUserMessage(userMessage), options: { ... } })
```
- Set `includePartialMessages: true` for streaming deltas
- Set `systemPrompt` to the session conductor prompt
- Set `model` to `AGENT_MODEL`
- Set `permissionMode: "bypassPermissions"` (server-side, no interactive permissions)
- Iterate over messages from `query()` and yield `AgentEvent` types:
  - `SDKPartialAssistantMessage` (type `'stream_event'`) -- unwrap the `event: RawMessageStreamEvent` field first, then map `text_delta` -> yield `{ type: "text", content: delta }`. Note: the delta is inside `event.delta.text`, not at the top level.
  - `SDKAssistantMessage` with `tool_use` blocks -> yield `{ type: "tool_use", tool, input, tool_use_id }`
  - Tool results (inferred from subsequent messages after tool_use) -> yield `{ type: "tool_result", tool, result }`
  - `SDKResultMessage` -> yield `{ type: "done" }`
  - Errors -> yield `{ type: "error", error: message }`
  - **Note:** These event mappings are pseudo-code illustrating the concept. The actual field names will depend on the SDK version validated in the spike. Do not treat these as copy-pasteable implementations.

**If proceeding with Option B (RECOMMENDED):**

The handler must:
- Use the raw `@anthropic-ai/sdk` (already installed at `^0.50.0`)
- Extract the stream parsing logic from the current `handler.ts` (lines 182-211) into a reusable utility: `parseAnthropicStream(stream): AsyncGenerator<StreamEvent>`
- Build a cleaner agentic loop that separates concerns:
  1. Message preparation (inject session brief into system prompt, apply sliding window)
  2. API call with streaming
  3. Stream event parsing (via extracted utility)
  4. Tool execution
  5. Event yielding to caller
- The handler should be ~150 lines (down from 365 in the current handler) because the stream parsing is extracted

**Either way, the public contract is identical:**
```typescript
export async function* handleSessionMessage(
  message: string,
  session: Session
): AsyncGenerator<AgentEvent>
```

**Expected behavior:**
- `handleSessionMessage()` returns `AsyncGenerator<AgentEvent>` (same contract as existing `handleMessage()`)
- The function uses the session conductor prompt instead of the Flow Architect prompt
- Tools execute via the existing `tool.execute()` implementations (adapted for MCP or called directly)
- Error handling covers auth, rate limit, and timeout errors
- A new Express route `/api/sessions/:id/message` wires to this handler

**Key components:**
- `conclave_ui/agent-service/src/agent/session-handler.ts` -- NEW
- `conclave_ui/agent-service/src/agent/stream-parser.ts` -- NEW (extracted stream parsing utility, used by both handlers if Option B)
- `conclave_ui/agent-service/src/agent/tool-adapter.ts` -- NEW (MCP adapter, only if Option A/C)
- `conclave_ui/agent-service/src/agent/config.ts` -- may need new exports for SDK config
- Express route: new route handler in routes file for `POST /api/sessions/:id/message`

**Notes:** Create a NEW `session-handler.ts` rather than modifying the existing `handler.ts`. The existing handler serves `/flows/new/chat` and must continue working unchanged. Per TD-2, both handlers share tool definitions from `config.ts` but use different prompts and potentially different agentic loop implementations. Add a decision comment at the top of `session-handler.ts`:
```typescript
// SDK DECISION: [Option B: Refactored raw API (recommended)] or [Option A: Agent SDK with MCP (if spike validates subprocess model)]
// Spike outcome: [describe what was found -- subprocess concurrency, adapter complexity, cold start time]
// Date: YYYY-MM-DD
```

---

### Task 4: Session Handler -- SSE Event Bridging + workspace_update Emission

**Intent:** Bridge the session handler's output to the SSE streaming protocol and add the `workspace_update` event type that the workspace renderer needs.

**Context:** The frontend's `use-session-chat.ts` hook (Task 7) expects SSE events in the format: `data: {"type": "text", "delta": "..."}`. The session handler (Task 3) yields `AgentEvent` types. This task creates the Express route that wires the session handler to an SSE response, and adds logic to emit `workspace_update` events when flow results contain renderable artifacts.

**Expected behavior:**
- Express route `POST /api/sessions/:id/message` accepts the user's message
- Validates the session exists and is not locked
- Calls `handleSessionMessage(message, session)` and iterates the async generator
- Maps each `AgentEvent` to an SSE event and writes it to the response
- After a `tool_result` event from `test_flow`, analyzes the result to construct a `workspace_update` event:
  - If the result has multiple model outputs -> `view_hint: "tabbed_view"`
  - If the result has 3+ parallel outputs with persona/label data -> `view_hint: "card_grid"`
  - If the result has a single output -> `view_hint: "document"`
  - Transforms the flow result into `SessionArtifact[]` format
- Emits the `workspace_update` event after the `tool_result` event
- Sends heartbeat (`:` comment line) every 30 seconds to keep the connection alive

**Key components:**
- `conclave_ui/agent-service/src/routes/session-routes.ts` -- NEW (Express routes for session endpoints)
- `conclave_ui/agent-service/src/agent/workspace-update-builder.ts` -- NEW (transforms tool results into workspace update events)
- `conclave_ui/agent-service/src/types/index.ts` -- add `workspace_update`, `flow_started`, and `flow_completed` to BOTH `SSEEventType` and `AgentEventType` unions (the plan's `SSEEventType` extension is specified below; remember to also extend `AgentEventType` in the same file)

**New SSE event types added to the type system:**

```typescript
// Add to SSEEventType union
export type SSEEventType =
  | "connected"
  | "text"
  | "tool_use"
  | "tool_result"
  | "workspace_update"  // NEW
  | "flow_started"      // NEW
  | "flow_completed"    // NEW
  | "error"
  | "done";

// New event interfaces
export interface WorkspaceUpdateSSEEvent extends BaseSSEEvent {
  type: "workspace_update";
  data: {
    type: string;        // e.g., "parallel_results", "persona_results", "synthesis"
    view_hint: ViewHint;
    artifacts: SessionArtifact[];
  };
}

export interface FlowStartedSSEEvent extends BaseSSEEvent {
  type: "flow_started";
  flow_name: string;
  models: string[];
}

export interface FlowCompletedSSEEvent extends BaseSSEEvent {
  type: "flow_completed";
  flow_name: string;
  duration_seconds: number;
}
```

**Important: `flow_started` and `flow_completed` must be rendered as visible chat messages, not just internal state updates.** During `test_flow` execution (which can take 30-120 seconds), the user sees silence. The chat panel (Task 8) must render `flow_started` as a visible status message (e.g., "Running [flow_name] with [models]...") and `flow_completed` as a completion message (e.g., "Flow completed in [N] seconds."). This is the difference between "broken" and "working but waiting." See Task 8 for the rendering implementation.

**Notes:** The `workspace_update` event is emitted by the route handler (not the session handler directly). The session handler yields raw `tool_result` events; the route handler inspects them and, if the tool was `test_flow`, constructs the workspace update. This keeps the session handler generic and the workspace-specific logic in one place (`workspace-update-builder.ts`). The builder must handle partial/failed flow results gracefully -- if only 2 of 3 models returned results, still emit a workspace update with the available artifacts.

---

### Task 5: ViewHint Type System and Shared Types (with Unit Tests)

**Intent:** Define the `ViewHint` type, the `WorkspaceUpdateEvent` shape, `SessionArtifact`, and `SessionTreeNode` as a shared contract between backend and frontend.

**Context:** The ViewHint is how the agent tells the frontend what to render. Per the architecture review (Theme 3), the view_hint should be optional with a `document` fallback. The type system needs to be defined in both the agent service types and the frontend types.

**Expected behavior:**

Backend types (`conclave_ui/agent-service/src/types/index.ts`):
```typescript
// ViewHint determines which workspace component renders the artifacts
export type ViewHint =
  | "card_grid"      // Multiple cards (persona results, parallel outputs)
  | "tabbed_view"    // Tabs for switching between outputs
  | "document"       // Single full-width document (DEFAULT FALLBACK)
  | "comparison"     // Side-by-side comparison (Wave 4)
  | "flow_diagram";  // Visual flow representation (Wave 4)

// An artifact produced by a flow run, displayable in the workspace
export interface SessionArtifact {
  id: string;
  label: string;             // Display name (e.g., "Claude Analysis", "Caregiver Persona")
  model?: string;            // Model that produced this (e.g., "claude-sonnet-4-20250514")
  provider?: string;         // Provider name (e.g., "anthropic", "openai", "google")
  content: string;           // The actual content (markdown)
  metadata?: Record<string, unknown>;  // Extra data (duration, token count, cost)
}

// A node in the session tree hierarchy
export interface SessionTreeNode {
  id: string;
  type: "session" | "flow_run" | "output" | "artifact";
  label: string;
  timestamp?: string;        // ISO timestamp
  children?: SessionTreeNode[];
  metadata?: Record<string, unknown>;  // Models used, pattern type, etc.
  viewHint?: ViewHint;
  // For linking tree nodes to chat messages (bidirectional navigation)
  linkedMessageId?: string;
}
```

Frontend types (`conclave_ui/conclave-app/lib/types/session.ts` -- NEW):
```typescript
// Mirror of backend types for frontend use
// Source of truth: conclave_ui/agent-service/src/types/index.ts
// Keep in sync manually. TODO: shared package or codegen.

export type ViewHint = "card_grid" | "tabbed_view" | "document" | "comparison" | "flow_diagram";

export const VIEW_HINT_DEFAULT: ViewHint = "document";

export function isValidViewHint(value: string): value is ViewHint {
  return ["card_grid", "tabbed_view", "document", "comparison", "flow_diagram"].includes(value);
}

export interface SessionArtifact {
  id: string;
  label: string;
  model?: string;
  provider?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SessionTreeNode {
  id: string;
  type: "session" | "flow_run" | "output" | "artifact";
  label: string;
  timestamp?: string;
  children?: SessionTreeNode[];
  metadata?: Record<string, unknown>;
  viewHint?: ViewHint;
  linkedMessageId?: string;
}

export interface WorkspaceView {
  type: string;
  viewHint: ViewHint;
  artifacts: SessionArtifact[];
}

// Session summary for the list page
export interface SessionSummary {
  id: string;
  name: string;
  goal?: string;
  status: "active" | "completed" | "archived";
  lastActivityAt: string;
  flowRunCount: number;
  createdAt: string;
}
```

Also extend `conclave_ui/conclave-app/lib/types/agent-chat.ts`:
```typescript
// Add to SSEEvent union
export interface SSEWorkspaceUpdateEvent {
  type: "workspace_update";
  data: {
    type: string;
    view_hint: string;    // Validated at runtime via isValidViewHint()
    artifacts: Array<{
      id: string;
      label: string;
      model?: string;
      provider?: string;
      content: string;
      metadata?: Record<string, unknown>;
    }>;
  };
}
```

**Unit tests to write:**
- `isValidViewHint()` correctly identifies valid and invalid hints
- `VIEW_HINT_DEFAULT` is `"document"`
- `SessionTreeNode` can represent a two-level tree (session -> flow_run -> output)
- `WorkspaceView` with missing `viewHint` defaults to `"document"` via the validation function

**Key components:**
- `conclave_ui/agent-service/src/types/index.ts` -- extend
- `conclave_ui/conclave-app/lib/types/session.ts` -- NEW
- `conclave_ui/conclave-app/lib/types/agent-chat.ts` -- extend SSEEvent union
- `conclave_ui/conclave-app/lib/__tests__/session-types.test.ts` -- NEW (unit tests)

**Notes:** Types are kept in sync manually. A shared package is out of scope. Add a `// SYNC: also defined in agent-service/src/types/index.ts` comment in the frontend file and vice versa.

---

### Task 6: Session Page Route and Two-Panel Layout Shell

**Intent:** Create the Next.js app router route for `/sessions` (list) and `/sessions/[id]` (active session) with the two-panel layout structure.

**Context:** The existing app uses a `(app)` route group with an `AppShell` layout. The `AppShell` renders `<main className="flex-1 p-4 md:p-6 pb-20 md:pb-6"><div className="container-app relative z-10">{children}</div></main>`. The session page needs full-bleed layout (no padding, no container wrapper).

**AppShell padding override approach (addresses Senior Engineer review item #3):**

Next.js app router layouts are additive -- we cannot remove the parent `AppShell` padding from a child layout. The recommended approach is a negative-margin wrapper in the session page:

```tsx
// app/(app)/sessions/[id]/page.tsx
export default function SessionPage({ params }: { params: { id: string } }) {
  return (
    // COUPLING: These negative margins cancel AppShell's p-4 md:p-6 pb-20 md:pb-6.
    // max-w-none overrides the container-app max-width constraint (AppShell line 69).
    // If AppShell padding or container-app changes, update these values too.
    <div className="-m-4 md:-m-6 -mb-20 md:-mb-6 max-w-none w-full h-[calc(100vh-4rem)]">
      <SessionLayout sessionId={params.id} />
    </div>
  );
}
```

The negative margins (`-m-4 md:-m-6`) cancel the parent `p-4 md:p-6` padding. The negative bottom margin (`-mb-20 md:-mb-6`) cancels the `pb-20 md:pb-6` bottom padding. The `max-w-none w-full` overrides the `container-app` max-width constraint from AppShell line 69 (`<div className="container-app relative z-10">`), which would otherwise prevent the session layout from using the full viewport width. The height is set to `calc(100vh - 4rem)` to account for the header (h-16 = 4rem).

**Expected behavior:**
- `app/(app)/sessions/page.tsx` -- session list page (placeholder for now; fully built in Task 15)
- `app/(app)/sessions/[id]/page.tsx` -- active session page with two-panel layout
- The two-panel layout uses Flexbox with a fixed 60/40 split (workspace left, chat right)
- Workspace panel (left) renders `<WorkspaceRenderer />` (Task 9)
- Chat panel (right) renders the session chat (Task 8)
- Input bar is fixed at the bottom, spanning full width (Task 14)
- Both panels use `min-w-0` to prevent overflow
- Layout class: `flex flex-col lg:flex-row h-full`

**Key components:**
- `conclave_ui/conclave-app/app/(app)/sessions/[id]/page.tsx` -- NEW
- `conclave_ui/conclave-app/app/(app)/sessions/page.tsx` -- NEW (placeholder)
- `conclave_ui/conclave-app/components/sessions/session-layout.tsx` -- NEW: the two-panel container
- Follow patterns from: `conclave_ui/conclave-app/app/(app)/flows/new/chat/page.tsx`

**Session resume note:** The plan does not implement session rehydration from Supabase (that is a Wave 1 responsibility). If a user navigates to `/sessions/[id]` for a previously created session and Wave 1 is not complete, the page should show a loading state that gracefully degrades to "Session not found" rather than an empty page or a crash. Add a simple fetch to `GET /api/sessions/:id` with error handling: if 404, show "This session could not be loaded" with a "Back to Sessions" link.

**Notes:** The session layout manages the state for chat panel visibility (expanded/collapsed). The `isChatExpanded` state starts as `true`. When the user clicks the collapse toggle (Task 14), it sets to `false`, and the workspace expands to full width. Layout transitions use `transition-all duration-300` for smooth animation. Per TD-4, no draggable resizer for V1.

---

### Task 7: SSE Parsing Utility Extraction + Session Chat Hook (with Unit Tests)

**Intent:** Extract the SSE parsing logic into a shared utility and create the session-specific chat hook.

**Context:** The existing `use-agent-chat.ts` hook (lines 205-232) contains ~30 lines of SSE parsing: `while(true) { reader.read() }` with `TextDecoder`, line splitting, and JSON parsing. Per TD-6, this is extracted into a shared utility to avoid duplication.

**Part 1: SSE Parsing Utility**

```typescript
// conclave_ui/conclave-app/lib/utils/sse-parser.ts -- NEW

/**
 * Parse an SSE stream from a ReadableStreamDefaultReader.
 * Handles partial lines across chunks, [DONE] sentinel, and JSON parse errors.
 */
export async function parseSSEStream<T>(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: T) => void,
  options?: { signal?: AbortSignal }
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    if (options?.signal?.aborted) break;

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete last line in buffer

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const jsonStr = line.slice(6);
        if (jsonStr === "[DONE]") continue;

        try {
          const event = JSON.parse(jsonStr) as T;
          onEvent(event);
        } catch {
          // Ignore malformed JSON
        }
      }
    }
  }
}
```

**Unit tests for SSE parser:**
- Parses a complete SSE event correctly
- Handles multiple events in a single chunk
- Handles an event split across two chunks (partial line in buffer)
- Ignores `[DONE]` sentinel
- Ignores malformed JSON without throwing
- Stops when abort signal fires
- Handles empty chunks gracefully

**Part 2: Session Chat Hook**

```typescript
// conclave_ui/conclave-app/lib/hooks/use-session-chat.ts -- NEW

export interface UseSessionChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  isConnecting: boolean;
  error: string | null;
  currentWorkspaceView: WorkspaceView | null;
  sessionTree: SessionTreeNode[];
  sendMessage: (message: string) => Promise<void>;
  cancelExecution: () => void;  // Stub for Wave 4
  clearError: () => void;
}
```

The hook:
- Takes `sessionId: string` from URL params (not auto-generated)
- Sends messages to `${AGENT_SERVICE_URL}/api/sessions/${sessionId}/message`
- Uses `parseSSEStream()` for event parsing (shared utility)
- Handles all existing SSE event types (`connected`, `text`, `tool_use`, `tool_result`, `done`, `error`)
- NEW: handles `workspace_update` events and updates `currentWorkspaceView` state
- NEW: maintains `sessionTree` state that updates when flows complete
- Does NOT use `localStorage` (Wave 1 Supabase handles persistence)
- `cancelExecution()` is a stub that logs a warning ("Cancellation not implemented -- Wave 4")

**Key components:**
- `conclave_ui/conclave-app/lib/utils/sse-parser.ts` -- NEW
- `conclave_ui/conclave-app/lib/utils/__tests__/sse-parser.test.ts` -- NEW (unit tests)
- `conclave_ui/conclave-app/lib/hooks/use-session-chat.ts` -- NEW
- Pattern reference: `conclave_ui/conclave-app/lib/hooks/use-agent-chat.ts`

**Notes:** After extracting the utility, refactor `use-agent-chat.ts` to use it too. This reduces the existing hook by ~30 lines and ensures both hooks share the same parsing behavior. The refactor is a bonus, not a blocker -- if it risks breaking the existing flow architect chat, skip it and just use the utility in the new hook.

---

### Task 8: Chat Panel (Reuse + Adapt Existing Components)

**Intent:** Assemble the chat panel for the session UI by reusing existing chat components with session-specific adaptations.

**Context:** The existing chat components at `conclave_ui/conclave-app/components/chat/` are well-built and reusable (confirmed in review: A4). The main customization needed is the empty state and suggested prompt interactivity.

**Required changes to existing components:**

1. **`ChatMessageList`** (`conclave_ui/conclave-app/components/chat/chat-message-list.tsx`):
   - Add `emptyState?: React.ReactNode` prop
   - Add `onSuggestedPromptClick?: (text: string) => void` prop
   - Thread `onSuggestedPromptClick` to `SuggestedPrompt` components
   - Make `SuggestedPrompt` call `onSuggestedPromptClick(text)` on click (currently the button has no onClick handler)

2. **Session-specific empty state:**
```tsx
function SessionEmptyState({ onPromptClick }: { onPromptClick: (text: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-purple-500/30 flex items-center justify-center mb-6">
        <Layers className="w-8 h-8 text-purple-400" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">
        Your Session Workspace
      </h3>
      <p className="text-white/60 max-w-md mb-6">
        Tell me what you want to explore. I will assemble the right AI models and run them for you.
        Results will appear in the workspace on the left.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        <SuggestedPrompt text="Brainstorm a mobile app for elderly care" onClick={onPromptClick} />
        <SuggestedPrompt text="Run a multi-model analysis of our pricing strategy" onClick={onPromptClick} />
        <SuggestedPrompt text="Compare perspectives on remote work policies" onClick={onPromptClick} />
      </div>
    </div>
  );
}
```

**Key components:**
- `conclave_ui/conclave-app/components/chat/chat-message-list.tsx` -- MODIFY (add `emptyState` + `onSuggestedPromptClick` props)
- `conclave_ui/conclave-app/components/sessions/session-chat-panel.tsx` -- NEW (thin wrapper)
- Reuses: `ChatInput`, `ChatMessage`, `TypingIndicator` unchanged

3. **`flow_started` / `flow_completed` rendering:**
   - The chat panel must render `flow_started` SSE events as visible status messages in the chat stream, not just internal state updates. During `test_flow` execution (30-120 seconds), the user sees silence without these.
   - `flow_started` renders as a system message: a subtle, non-bubble status line like "Running [flow_name] with [model icons]..." with a pulsing indicator.
   - `flow_completed` renders as a system message: "Flow completed in [N] seconds" with a checkmark icon.
   - These system messages use a distinct visual style (e.g., centered, smaller text, `text-white/50`, no chat bubble) to differentiate them from agent messages.
   - Implementation: the `useSessionChat` hook appends these as `ChatMessage` entries with `role: "system"` (or a new `type: "status"` discriminant). The `ChatMessageList` renders them with the status style.

**Notes:** Do NOT fork the chat components. The session chat panel is a composition. `SessionChatPanel` receives `messages`, `isStreaming`, `isConnecting`, `onSendMessage` from the parent page via `useSessionChat` and passes them to the existing components.

---

### Task 9: Workspace Renderer and View Registry (with Unit Tests)

**Intent:** Build the workspace renderer -- a component that maps a `ViewHint` to the appropriate React component and renders it with the provided artifacts.

**Context:** The workspace is the left panel of the session layout. When no workspace update has been emitted, the workspace shows either the session tree (if the session has history) or an onboarding card (if the session is new).

**Onboarding card for empty workspace (addresses UX review Concern 1):**

```tsx
function WorkspaceOnboarding() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="glass-card rounded-2xl p-8 max-w-lg border border-white/10">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center mx-auto mb-4">
          <LayoutDashboard className="w-6 h-6 text-cyan-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Your Workspace</h3>
        <p className="text-sm text-white/60 mb-4">
          When you ask me to run a flow, the results will appear here.
          You will be able to view, compare, and navigate through all outputs.
        </p>
        <p className="text-xs text-white/40">
          Try asking: "Run a brainstorm on [topic] with Claude, GPT, and Gemini"
        </p>
      </div>
    </div>
  );
}
```

**View registry (switch-based, per TD-3):**

```tsx
function WorkspaceRenderer({ currentView, sessionTree, onNodeSelect }: WorkspaceRendererProps) {
  // No workspace update yet
  if (!currentView) {
    if (sessionTree.length === 0) {
      return <WorkspaceOnboarding />;
    }
    return <SessionTree nodes={sessionTree} onNodeSelect={onNodeSelect} />;
  }

  // Guard: empty artifacts (e.g., partial flow failure where no models returned results)
  if (!currentView.artifacts || currentView.artifacts.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <p className="text-white/60">No results available. The flow may have partially failed.</p>
        <p className="text-sm text-white/40 mt-2">Try running the flow again, or check the chat for error details.</p>
      </div>
    );
  }

  // Validate view_hint with fallback
  const viewHint = isValidViewHint(currentView.viewHint)
    ? currentView.viewHint
    : VIEW_HINT_DEFAULT;

  switch (viewHint) {
    case "document":
      return <DocumentView artifacts={currentView.artifacts} />;
    case "tabbed_view":
      return <TabbedView artifacts={currentView.artifacts} />;
    case "card_grid":
      return <CardGridView artifacts={currentView.artifacts} />;
    case "comparison":
      // Wave 4 -- fall back to tabbed view
      return <TabbedView artifacts={currentView.artifacts} />;
    case "flow_diagram":
      // Wave 4 -- fall back to document view
      return <DocumentView artifacts={currentView.artifacts} />;
    default:
      return <DocumentView artifacts={currentView.artifacts} />;
  }
}
```

**Breadcrumb bar:**
- Shows at the top of the workspace: "Session > Flow 2 > Persona Results"
- "Back to session tree" button always available
- Session goal displayed as a subtle banner (addresses UX review Suggestion 2)

**Unit tests:**
- `WorkspaceRenderer` renders `WorkspaceOnboarding` when `currentView` is null and tree is empty
- `WorkspaceRenderer` renders `SessionTree` when `currentView` is null and tree has nodes
- `WorkspaceRenderer` renders `DocumentView` for `view_hint: "document"`
- `WorkspaceRenderer` renders `TabbedView` for `view_hint: "tabbed_view"`
- `WorkspaceRenderer` renders `CardGridView` for `view_hint: "card_grid"`
- `WorkspaceRenderer` falls back to `DocumentView` for unknown view_hint values
- `WorkspaceRenderer` falls back to `DocumentView` for missing view_hint
- `WorkspaceRenderer` renders "No results" state when `currentView.artifacts` is an empty array

**Key components:**
- `conclave_ui/conclave-app/components/sessions/workspace-renderer.tsx` -- NEW
- `conclave_ui/conclave-app/components/sessions/workspace-onboarding.tsx` -- NEW
- `conclave_ui/conclave-app/components/sessions/workspace-breadcrumb.tsx` -- NEW
- `conclave_ui/conclave-app/components/sessions/__tests__/workspace-renderer.test.tsx` -- NEW
- Pattern reference: `conclave_ui/conclave-app/components/chat/tool-results/index.tsx`

---

### Task 10: `document` Workspace View

**Intent:** Build the full-width document view for single outputs (synthesis briefs, single-model responses). This is the default fallback view.

**Expected behavior:**
- Full-width content area with markdown rendering via `react-markdown`
- Title bar showing artifact label and model used (with provider badge)
- Copy-to-clipboard button
- Word count in the footer
- Clean typography optimized for reading

**Key components:**
- `conclave_ui/conclave-app/components/sessions/workspace-views/document-view.tsx` -- NEW
- Reuses markdown rendering patterns from: `conclave_ui/conclave-app/components/flows/model-response.tsx`
- Uses: `react-markdown` (already in dependencies), `react-syntax-highlighter` (already in dependencies)

**Notes:** Use `prose` classes from Tailwind typography or custom markdown styles matching the existing design system. The copy button should copy raw markdown, not rendered HTML.

---

### Task 11: `tabbed_view` Workspace View

**Intent:** Build the tabbed view for multi-model parallel outputs.

**Context:** Build a new component that shares styling constants with the existing `ResultsDisplay` but accepts the simpler `SessionArtifact[]` shape. Per the Senior Engineer review (item #5), the existing `ResultsDisplay` is too coupled to flow-specific types to be reused directly.

**Expected behavior:**
- Tab bar at the top with one tab per artifact (model name + provider icon)
- Content area shows the selected tab's content with markdown rendering
- Tab colors follow model color scheme (extract `MODEL_TAB_COLORS` or equivalent from existing components)
- Copy button per tab
- Smooth tab switching via Radix Tabs

**Key components:**
- `conclave_ui/conclave-app/components/sessions/workspace-views/tabbed-view.tsx` -- NEW
- Uses: `conclave_ui/conclave-app/components/ui/tabs.tsx` (shadcn Tabs / `@radix-ui/react-tabs`)
- Reuses styling constants from: `conclave_ui/conclave-app/components/flows/results-display.tsx`

---

### Task 12: `card_grid` Workspace View (In-Place Expansion)

**Intent:** Build the card grid view for persona explorations and N-output results.

**Context:** Per the UX review (Concern 3), use in-place expansion instead of a modal. Clicking a card expands it to full width, pushing other cards down. This maintains spatial context when comparing multiple outputs. If in-place expansion proves too complex within the time budget, fall back to a slide-over panel (card opens its full content in a right-side panel overlaying part of the grid), NOT a centered modal.

**Expected behavior:**
- Responsive grid: 2 columns on medium screens, 3 columns on large screens
- Each card shows: persona/artifact label, model icon, content preview (truncated to ~200 chars with `line-clamp-4`)
- Click a card to expand it in-place (full width, other cards push down)
- Click again or press Escape to collapse back to grid
- Cards use glass morphism styling (`glass-card`, `border-white/10`)
- Expanded card shows full markdown-rendered content with copy button

**Key components:**
- `conclave_ui/conclave-app/components/sessions/workspace-views/card-grid-view.tsx` -- NEW
- Uses: `conclave_ui/conclave-app/components/ui/card.tsx` (shadcn Card)
- Styling pattern: `conclave_ui/conclave-app/components/ui/action-card.tsx`

**Notes:** The in-place expansion can be implemented with CSS Grid + `col-span-full` on the expanded card, combined with a height transition. Use React state to track which card (if any) is expanded. Ensure the grid re-flows smoothly.

---

### Task 13: Session Tree Component (with Bidirectional Chat Navigation)

**Intent:** Build the session tree and implement bidirectional navigation between tree nodes and chat messages.

**Context:** The session tree is the "table of contents" for a session. Per the UX review (Concern 2), clicking a tree node should auto-scroll the chat panel to the corresponding agent message, creating bidirectional navigation. The `SessionTreeNode.linkedMessageId` field (Task 5) enables this.

**Expected behavior:**
- Session name and goal at the top (editable name via click-to-rename)
- Flow runs as expandable/collapsible nodes: pattern type icon, model badges, timestamp
- Child nodes under each flow run: individual model outputs (clickable to open in workspace)
- Clicking a child node:
  1. Switches the workspace to render that artifact
  2. Auto-scrolls the chat panel to the linked message (via `linkedMessageId`)
- Visual indicator (highlighted background) for the currently-viewed artifact
- Collapse/expand all toggle
- Max-height with `overflow-y-auto` for long sessions

**Key components:**
- `conclave_ui/conclave-app/components/sessions/session-tree.tsx` -- NEW
- Uses: `conclave_ui/conclave-app/components/ui/accordion.tsx` (shadcn Accordion)
- Uses: `conclave_ui/conclave-app/components/ui/badge.tsx` (model badges)
- Icons from `lucide-react`: `Network` for flow runs, `FileText` for outputs, `Star` for artifacts

**Notes:** The tree is purpose-built for 2-level nesting (session -> flow_run -> output), NOT a generic recursive tree. The auto-scroll to linked chat message requires the chat panel to expose a `scrollToMessage(messageId: string)` function. This can be implemented via a ref + `scrollIntoView()` on the message DOM element. Pass the scroll function from the session layout to both the tree and the chat panel.

**UX note:** For short sessions (fewer than 3 flow runs), the tree adds more overhead than value. Consider auto-minimizing the tree to a compact breadcrumb-only view when there are fewer than 3 flow runs, and expanding it to the full tree when the session grows beyond that threshold. This is a polish item, not a blocker.

---

### Task 14: Persistent Input Bar (with Mobile/MobileNav z-index Resolution)

**Intent:** Build the persistent input bar and resolve the mobile layout conflict with `MobileNav`.

**Context:** The input bar is always visible at the bottom. Per the Senior Engineer review (item #6), on mobile the input bar would overlap with `MobileNav` (the existing bottom navigation). Resolution: hide `MobileNav` on session pages.

**Expected behavior:**
- Input bar fixed at the bottom of the session layout container
- In conversing mode: visually part of the chat panel
- In reviewing mode (chat collapsed): spans full width below the workspace
- `PanelRightOpen` / `PanelRightClose` toggle from `lucide-react` controls chat panel visibility
- Typing and pressing Enter sends a message regardless of mode
- Auto-expand: if the user sends a message while chat is collapsed, the chat panel expands to show the response
- Reuses `ChatInput` component internally

**Mobile/MobileNav resolution:**
- On session pages (`/sessions/[id]`), `MobileNav` is hidden
- The persistent input bar serves as the primary mobile interaction point
- Input bar z-index: `z-50` (above everything except modals)
- Apply `pb-safe` (safe area inset) for iOS bottom bar

**Key components:**
- `conclave_ui/conclave-app/components/sessions/persistent-input-bar.tsx` -- NEW
- Reuses: `conclave_ui/conclave-app/components/chat/chat-input.tsx`
- Integrates with: `conclave_ui/conclave-app/components/sessions/session-layout.tsx`
- May need to modify: `conclave_ui/conclave-app/components/layout/mobile-nav.tsx` (add pathname check to hide on session pages)

---

### Task 15: Session List Page and Sidebar Navigation

**Intent:** Add "Sessions" to the app sidebar and build the session list page.

**Context:** The current sidebar (`conclave_ui/conclave-app/components/layout/sidebar.tsx`) has: Dashboard, New Flow, History. Sessions needs to be a top-level navigation item.

**Expected behavior:**

Sidebar change:
```typescript
const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sessions", label: "Sessions", icon: Layers },   // NEW -- added before New Flow
  { href: "/flows/new", label: "New Flow", icon: Play },
  { href: "/runs", label: "History", icon: History },
];
```

Session list page:
- "New Session" button (gradient styling, prominent placement)
- List of past sessions sorted by last activity (most recent first)
- Each row: session name, goal snippet (truncated), last activity relative timestamp, flow run count badge
- Click a session row -> navigate to `/sessions/[id]`
- Empty state for users with no sessions
- Sessions loaded via `GET /api/sessions` (agent service endpoint, proxied or direct Supabase query)

**Key components:**
- `conclave_ui/conclave-app/components/layout/sidebar.tsx` -- MODIFY (add "Sessions" nav item)
- `conclave_ui/conclave-app/app/(app)/sessions/page.tsx` -- FILL IN (from Task 6 placeholder)
- `conclave_ui/conclave-app/components/sessions/session-list-item.tsx` -- NEW
- Pattern reference: `conclave_ui/conclave-app/components/runs/run-list-item.tsx`

**Wave 1 not-ready fallback:** If Wave 1 (Supabase persistence) is not complete, the `GET /api/sessions` endpoint will not exist. The session list must handle this gracefully:
- If the fetch returns a network error or 404, show a friendly empty state: "No sessions yet. Start a new session to get started." with the "New Session" button prominently displayed.
- Do NOT show a raw network error or a blank page.
- The "New Session" button should still work (creating an in-memory session via the agent service).
- Past sessions will not survive server restarts without Wave 1 -- this is acceptable for Wave 3.

**Notes:** Use `useEffect` + `fetch` for data loading. Server-side rendering with Supabase SSR is a Wave 1 dependency that may not be wired yet. The "New Session" button POSTs to create a session and navigates to `/sessions/[id]`. Add `Layers` icon import from `lucide-react` to the sidebar.

---

### Task 16: Responsive Layout and Mobile Collapse

**Intent:** Ensure the two-panel session layout works on all screen sizes.

**Expected behavior:**
- Desktop (>1024px): Two-panel layout (workspace 60%, chat 40%)
- Tablet (768-1024px): Full-width with tab toggle between workspace and chat
- Mobile (<768px): Full-width, chat-first view. Workspace accessible via a swipe gesture or tab.
- Persistent input bar works on all breakpoints
- Session tree accessible via slide-out `Sheet` on mobile
- `MobileNav` hidden on session pages (handled in Task 14)

**Key components:**
- `conclave_ui/conclave-app/components/sessions/session-layout.tsx` -- MODIFY
- Uses: `conclave_ui/conclave-app/components/ui/sheet.tsx` (mobile session tree drawer)

**Notes:** Use Tailwind responsive classes: `flex-col lg:flex-row`. Both panels use `min-w-0`. On mobile, the layout stacks vertically with the chat panel visible by default. The workspace is behind a tab or drawer. Do NOT use JavaScript media queries. Mobile is secondary for Wave 3 -- ensure it does not break, but defer polish.

---

### Task 17: Integration Test -- Full Session Round-Trip

**Intent:** Verify the end-to-end flow works: session creation, agent conversation, flow execution, workspace rendering, session tree updates.

**Test steps:**
1. Start the full stack (`npm run dev:full`)
2. Navigate to `/sessions`
3. Click "New Session"
4. Type: "I want to brainstorm on a mobile app for elderly care. Run a Hub-and-Spoke with Claude, GPT, and Gemini."
5. Verify: agent responds with action (not clarifying questions)
6. Verify: tool call display shows `test_flow` execution
7. Verify: `workspace_update` event renders results in workspace (tabbed or card grid view)
8. Verify: session tree shows the flow run as a node with child outputs
9. Type: "Now have Claude synthesize these into a product brief."
10. Verify: agent references prior results in the new flow's prompt
11. Verify: workspace updates with the synthesis (document view)
12. Verify: session tree adds the new flow run

**Key components:**
- All components from Tasks 1-16
- Optional: `conclave_ui/conclave-app/tests/session-round-trip.spec.ts` (Playwright)
- Manual test with screenshots for evidence

**Notes:** If API keys are not available, verify the chain with mocked executor responses. The key verification is that the SSE event chain works end-to-end and workspace updates render correctly. Take screenshots at each step.

---

## Assumptions Register

> Every implementation plan rests on assumptions. The review identified several assumptions that were wrong or partially wrong. This register reflects the corrected verdicts.

| # | Assumption | Category | Verdict | Evidence |
|:-:|-----------|:--------:|:-------:|----------|
| A1 | The Claude Agent SDK supports registering custom tools, but via MCP servers (`createSdkMcpServer()` + `tool()` with Zod schemas), NOT via `allowedTools` with Anthropic-style schemas. An adapter layer is required to convert existing tool definitions. | Library | **Corrected in plan; CONFIRMED by review** | Official docs at `platform.claude.com/docs/en/agent-sdk/custom-tools` show exactly this API: `createSdkMcpServer({ name, tools: [tool(name, desc, zodSchema, handler)] })`. Tool names follow `mcp__<server>__<tool>` pattern. Review confirmed. |
| A2 | The Agent SDK yields messages that can map to SSE events, but does NOT stream text deltas by default. Requires `includePartialMessages: true` to get `SDKPartialAssistantMessage` with `RawMessageStreamEvent`. | Library | **Corrected in plan; CONFIRMED WITH CAVEAT by review** | `SDKPartialAssistantMessage` is type `'stream_event'` with `event: RawMessageStreamEvent` from the Anthropic SDK. Compatible with existing delta parsing, but requires unwrapping the `event` field first. Plan's event mapping pseudocode is directionally correct but not copy-pasteable. |
| A3 | The Agent SDK's `query()` accepts `options.model` (string) and `options.systemPrompt` (string or preset). The session conductor prompt can be passed as the system prompt. | Library | **CONFIRMED WITH CAVEAT** | `Options.model` is `string`, `Options.systemPrompt` is `string \| { type: 'preset'; preset: 'claude_code'; append?: string }`. However, `query()` requires `AsyncIterable<SDKUserMessage>` for `prompt` when `mcpServers` is provided -- a simple string will not work with MCP tools. Code examples updated in Tasks 2 and 3. |
| A4 | Existing chat components (`ChatMessageList`, `ChatMessage`, `ChatInput`, `TypingIndicator`) can be reused without forking. `ChatMessageList` needs an `emptyState` prop and `onSuggestedPromptClick` callback. | Codebase | **Confirmed** | Reviewed components. Generic props, no route coupling. `SuggestedPrompt` has no `onClick` -- needs adding. |
| A5 | The existing `ToolResultRenderer` works for session mode because sessions use the same tools. | Codebase | **Confirmed** | Tools in `config.ts` are shared. `ToolResultRenderer` handles all current tools. |
| A6 | Radix Tabs supports dynamic tab creation at runtime. | Library | **Confirmed** | Radix Tabs is controlled. Dynamic `TabsTrigger`/`TabsContent` elements are standard React rendering. |
| A7 | Next.js 16 supports `app/(app)/sessions/[id]/page.tsx` route pattern. | Codebase | **Confirmed** | Existing `app/(app)/flows/[id]/page.tsx` uses same pattern. Next.js 16.1.1 confirmed in `package.json`. |
| A8 | Agent service can support `/api/sessions/*` routes alongside existing `/api/chat/*` routes. | Codebase | **Confirmed** | Express supports multiple route handlers on different paths without conflict. |
| A9 | No existing tree component. Session tree is purpose-built using shadcn Accordion. | Codebase | **Confirmed** | Searched components directory. No tree component. `Accordion` available. |
| A10 | Two-panel layout works within AppShell by canceling main padding with negative margins (`-m-4 md:-m-6 -mb-20 md:-mb-6`). | Codebase | **CONFIRMED WITH CAVEAT (container-app escape added)** | AppShell renders `<main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">`. Negative margins cancel padding. HOWEVER, `<div className="container-app relative z-10">` on line 69 adds a max-width container that the session page also needs to escape. Fixed by adding `max-w-none w-full` to the negative-margin wrapper (Task 6 updated). Coupling comment added. |
| A11 | `test_flow` tool returns structured data transformable into `SessionArtifact[]`. | Codebase | **CONFIRMED by review** | Reviewed `test-flow.ts`. `TestFlowOutput` has `phases` (array with `name`, `outputs: Record<string, string>`), `full_outputs` (Record<string, Record<string, string>>), per-model results keyed by participant ID. Transformation to `SessionArtifact[]` is straightforward: iterate `full_outputs`, create one artifact per participant. |
| A12 | SSE via `response.body.getReader()` works for session endpoints without `EventSource` migration. | Codebase | **Confirmed** | `use-agent-chat.ts` uses this approach. Same pattern works for any SSE-over-POST. |
| A13 | The Agent SDK is published as `@anthropic-ai/claude-agent-sdk` and requires Claude Code runtime installed on the host. Node.js >= 20 compatible. | Library | **CONFIRMED -- RUNTIME AND SUBPROCESS CONCERNS ARE REAL** | NPM package exists. Quickstart doc confirms: "The Agent SDK uses Claude Code as its runtime." The SDK spawns a Claude Code subprocess per `query()` call -- a poor fit for server-side Express handlers serving concurrent users. This is the primary reason Option B is now recommended. Task 2 spike validates whether the subprocess model is viable. |
| A14 | Wave 1 and Wave 2 are complete or have stub interfaces available before Wave 3 begins. | Infra | **Plausible -- BUT SESSION LIST WILL BE EMPTY** | If Wave 1 (Supabase persistence) is not done, sessions are in-memory only. The session list page (Task 15) will show no past sessions after a server restart. Fallback behavior added to Task 15: graceful empty state on fetch error, "New Session" button still works. Session resume fallback added to Task 6. |
| A15 | Mobile responsiveness is secondary for Wave 3. MobileNav hidden on session pages to avoid overlap with persistent input bar. | UX | **Plausible (validated with review)** | Senior Engineer review confirmed. Mobile polish deferred. MobileNav z-index overlap resolved by hiding on session pages. |

---

## Appendix

### Technical Decisions

**TD-1: Two agents, not one.** The session conductor and the flow architect are separate agents with separate prompts, separate entry points, and separate handlers. They share tool definitions. Rationale: their behaviors are fundamentally different (act now vs. ask first), and combining them in a single prompt creates confusion. See architecture review, Theme 2.

**TD-2: New handler, not modified handler.** The session handler (`session-handler.ts`) is a new file, not a modification of `handler.ts`. The existing handler continues serving `/flows/new/chat`. Rationale: the flow architect chat is a working, shipped feature. We do not want to risk breaking it during the SDK migration. If the SDK migration works well, we can migrate the flow architect handler later.

**TD-3: Switch-based view registry, not dynamic.** The workspace renderer uses a `switch(viewHint)` statement, not a `Map<string, ComponentType>` or plugin system. There are 5 view hints. Rationale: simplicity, type safety, debuggability. A dynamic registry is over-engineering for 5 cases.

**TD-4: Fixed panel ratio for V1.** The two-panel layout uses a fixed 60/40 split, not a draggable resizer. Rationale: a resizer library adds complexity and edge cases (minimum widths, drag handles, mobile behavior) for minimal user value in V1. The fixed ratio works for the primary use case (reading results while chatting). Revisit after user feedback.

**TD-5: `view_hint` is optional with `document` fallback.** If the agent does not emit a `view_hint`, or emits an unrecognized value, the workspace renders `DocumentView`. Rationale: the user always sees their content, even if the agent's hint is wrong. This makes the contract forgiving and reduces the risk of blank workspaces.

**TD-6: Shared SSE parsing utility.** The SSE parsing logic (reader loop, line splitting, JSON parsing) is extracted into a shared utility used by both `use-agent-chat` and `use-session-chat`. Rationale: the existing hook has ~30 lines of SSE parsing that would be duplicated verbatim. Extract once, use twice.

**TD-7: Session-specific layout override via negative margins.** The session page cancels the AppShell's `p-4 md:p-6 pb-20 md:pb-6` padding using `-m-4 md:-m-6 -mb-20 md:-mb-6` on a full-bleed wrapper, and breaks out of the `container-app` max-width using `max-w-none w-full`. Rationale: Next.js app router layouts are additive; child layouts cannot remove parent styles. Negative margins are a known pattern for full-bleed pages within padded shells. **Coupling note:** These values are tightly coupled to AppShell's exact padding and container classes. A `// COUPLING:` comment in the code marks the dependency. If anyone changes the AppShell padding, the session page will break silently -- the comment prevents this. A `fullBleed` prop on AppShell would be more robust but is not worth the abstraction cost for one page. **Alternative considered:** The existing `/flows/new/chat` page bypasses AppShell entirely with a standalone full-screen layout. We chose to stay within AppShell for sessions because it preserves sidebar navigation, which is important for context switching between sessions.

**TD-8: Time-boxed SDK spike before commitment.** Tasks 2-4 begin with a 2-4 hour spike to validate the Agent SDK's MCP tool registration pattern, streaming behavior, subprocess concurrency model, and runtime dependency. Option B (refactored raw API handler) is the recommended path based on review analysis that the SDK's subprocess-per-query model is a poor fit for concurrent server use. The spike validates this hypothesis. If the spike disproves the concern (subprocess model works for concurrent sessions), Option A becomes viable as an upgrade. Either way, there is no impact on frontend work. Rationale: the SDK integration is the highest-risk item in this wave. De-risking it early prevents cascading delays.

**TD-9: In-place card expansion over modal.** The card grid view uses in-place expansion (clicked card goes full-width, others push down) instead of a modal overlay. Rationale: modals break comparison flow. In-place expansion maintains spatial context. If too complex, fall back to a slide-over panel, not a centered modal.

**TD-10: MobileNav hidden on session pages.** On `/sessions/[id]` routes, the `MobileNav` bottom navigation is hidden to avoid overlapping with the persistent input bar. The input bar serves as the primary mobile interaction point. Rationale: two competing bottom bars create confusion. The session input bar is more important than general navigation during an active session.

### Dependencies

| Dependency | Version | Purpose | Source |
|---|---|---|---|
| `@anthropic-ai/claude-agent-sdk` | latest | Agent SDK for agentic loop (conditional on spike) | npm (to be installed in agent-service) |
| `@anthropic-ai/sdk` | ^0.50.0 | Raw Anthropic API (existing, used if Option B) | Already in agent-service/package.json |
| `zod` | ^3.24.1 (agent-service) / ^4.3.5 (conclave-app) | Schema validation for SDK tools (bump from ^3.22.4 if using SDK). **Version mismatch:** agent-service uses Zod v3, conclave-app uses Zod v4 (breaking API changes). Do NOT share Zod schemas across the monorepo boundary. | Already in both package.json files (independent versions) |
| `react-markdown` | ^10.1.0 | Markdown rendering in workspace views | Already in conclave-app/package.json |
| `react-syntax-highlighter` | ^16.1.0 | Code block highlighting in workspace views | Already in conclave-app/package.json |
| `@radix-ui/react-tabs` | ^1.1.13 | Tabbed workspace view | Already in conclave-app/package.json |
| `@radix-ui/react-accordion` | ^1.2.12 | Session tree expand/collapse | Already in conclave-app/package.json |
| `@radix-ui/react-dialog` | ^1.1.15 | Slide-over panel fallback for card grid | Already in conclave-app/package.json |
| `lucide-react` | ^0.562.0 | Icons for session tree, nav, workspace | Already in conclave-app/package.json |
| **Wave 1: Session Foundation** | -- | Supabase tables (`sessions`, `session_events`), auth middleware (JWT validation), extended session types (`name`, `goal`, `brief`, `status` fields) | Internal dependency. If not complete, Wave 3 uses in-memory store + `demo-user`. |
| **Wave 2: Smart Context** | -- | Sliding window (last 10-15 messages), session brief (async summarization), `recall_context` tool | Internal dependency. If not complete, Wave 3 omits `recall_context` from conductor prompt and sends full message history. |
| Executor API | -- | Flow execution (called by `test_flow` tool) | Existing service at port 8553 |

### Out of Scope

The following are explicitly NOT part of Wave 3:

- **Progress streaming during flow execution** -- Wave 4. The agent blocks during `test_flow`. Progress events require executor-agent protocol changes.
- **Cancellation support** -- Wave 4. The `POST /sessions/:id/cancel` endpoint is deferred. The hook has a `cancelExecution()` stub.
- **`comparison` workspace view** -- Wave 4. Falls back to `tabbed_view` in Wave 3.
- **`flow_diagram` workspace view** -- Wave 4. Falls back to `document` in Wave 3.
- **Editable results** -- Editing flow outputs inline. Wave 3 views are read-only.
- **Session sharing** -- V2 feature.
- **Session branching** -- V2 feature.
- **Cost guardrails** -- Deferred.
- **Auto-reconnection** -- V2. Error state + retry button for now.
- **Draggable panel resizer** -- Fixed 60/40 ratio for V1.
- **Mobile polish** -- Layout will not break on mobile, but desktop-optimized.

---

## Post-Review Revisions

| # | Review Finding | Severity | Change Made |
|:-:|---------------|:--------:|-------------|
| 1 | Agent SDK spawns a subprocess per `query()` call -- poor fit for server-side Express serving concurrent users. Option B should be the recommended path, not the fallback. | HIGH | Reframed throughout: Executive Summary, Feature 5, Task 2 (spike intent), Task 3 (Option B labeled RECOMMENDED, Option A labeled aspirational), TD-8, Progress Dashboard Task 3 name. Option B is now the default expectation; spike validates whether Option A is viable as an upgrade. |
| 2 | SDK's `query()` requires `AsyncIterable<SDKUserMessage>` with MCP servers, not a plain string. Code examples would not work as written. | HIGH | Added correct async generator pattern to Task 2 (with full code example) and Task 3 (inline pattern in Option A section). A3 assumption updated with caveat. |
| 3 | Spike should test `test_flow` adapter (complex nested schema), not `list_available_models` (trivial). | HIGH | Task 2 question 4 rewritten: now tests `test_flow` with `flow_config` nested schema. Rationale: if the complex tool converts cleanly, everything else will too. Decision criterion updated to 50-line threshold for `test_flow`. |
| 4 | Spike should explicitly test subprocess concurrency model. | HIGH | Task 2 gains question 5: concurrent `query()` calls, cold start time, subprocess survival on parent abort. Decision criteria updated to include concurrency validation. |
| 5 | Zod version mismatch (v3 in agent-service vs v4 in conclave-app) prevents sharing schemas across monorepo boundary. | MEDIUM | Zod version note added to Task 2 Notes section. Dependencies table updated with both versions and mismatch warning. Existing `isValidViewHint()` approach (plain `includes()`) confirmed as correct. |
| 6 | `container-app` max-width constraint not addressed by negative-margin approach. Session layout would be constrained to container width. | MEDIUM | Task 6 code example updated: added `max-w-none w-full` to the wrapper div. Description updated to explain the `container-app` escape. A10 assumption updated. TD-7 updated with container escape and coupling comment. |
| 7 | `flow_started`/`flow_completed` should render as visible chat messages, not just state updates. 30-120s silence during `test_flow` feels broken. | MEDIUM | Task 4 gains explicit note about visible rendering requirement. Task 8 gains new item 3: `flow_started`/`flow_completed` rendering spec with status message style (centered, smaller text, pulsing indicator, checkmark). |
| 8 | Tool schema conversion for `test_flow` is non-trivial (`flow_config` is untyped `object`). | MEDIUM | Addressed by finding #3 (spike now tests `test_flow` specifically). Task 2 question 4 notes the `z.record(z.unknown())` question. |
| 9 | Empty `currentView.artifacts` array would render empty view components. | MEDIUM | Task 9 workspace renderer gains defensive guard: check `artifacts.length === 0` and show "No results" state. Unit test added for empty artifacts case. |
| 10 | Session list page needs Wave 1 fallback (endpoint may not exist). | MEDIUM | Task 15 gains "Wave 1 not-ready fallback" section: graceful empty state on fetch error, "New Session" button still works, no raw network errors. A14 assumption updated. |
| 11 | ViewHint prompt instruction is rigid -- agent should have permission to omit when unsure. | MEDIUM | Session conductor prompt (Task 1) updated: "When in doubt, omit the view_hint and let the frontend choose the default." added before the existing "document" fallback line. |
| 12 | Session resume not covered -- clicking old session shows empty page if Wave 1 not done. | MEDIUM | Task 6 gains "Session resume note" with fetch + 404 handling: "Session not found" with "Back to Sessions" link. |
| 13 | Negative-margin approach tightly coupled to AppShell padding values. | LOW | Coupling comment (`// COUPLING: cancels AppShell padding...`) added to Task 6 code example. TD-7 expanded with coupling note and `fullBleed` prop alternative-considered. |
| 14 | `SDKPartialAssistantMessage` event type is `'stream_event'` with `event: RawMessageStreamEvent` -- not a direct `text_delta`. Plan's event mapping is pseudo-code. | LOW | Task 3 event mapping annotated: unwrap `event` field first, `delta.text` not top-level. Added explicit note that mappings are pseudo-code, not copy-pasteable. A2 assumption updated. |
| 15 | `AgentEventType` also needs the new event types, not just `SSEEventType`. | LOW | Task 4 key components note updated: extend BOTH `SSEEventType` and `AgentEventType`. |
| 16 | Flow Architect chat page bypasses AppShell entirely (alternative to negative-margin approach). | INFORMATIONAL | Noted in TD-7 as "alternative considered" -- staying within AppShell preserves sidebar navigation. |
| 17 | Session tree adds overhead for short sessions (fewer than 3 flow runs). | LOW | Task 13 gains UX note: auto-minimize tree to breadcrumb-only view below 3 flow runs. Polish item, not blocker. |
| 18 | `MobileNav` has no conditional hide mechanism currently. | LOW | Already addressed in Task 14 (pathname check approach confirmed as correct by review). No change needed. |
| 19 | `SuggestedPrompt` has no `onClick` handler. | LOW | Already addressed in Task 8 (correctly identified in plan). No change needed beyond what was already specified. |
