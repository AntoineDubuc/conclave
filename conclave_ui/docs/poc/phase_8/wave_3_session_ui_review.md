# Wave 3: Session UI -- Review

## Verdict: APPROVE WITH CHANGES

This is a strong, well-structured plan. The two-persona review from Revision 1 clearly improved it: the Agent SDK spike is time-boxed, the fallback path is defined, and the assumptions register is honest. The plan is implementable as written. The changes below are risk-reduction measures, not blockers.

---

## PM Review (User Persona)

- **The two-panel layout will feel natural, not clunky.** The 60/40 fixed split, the persistent input bar, and the workspace/chat separation mirror tools PMs already use (Linear, Notion side-by-side, VSCode). The decision to avoid a draggable resizer in V1 (TD-4) is correct -- nobody wants to fiddle with panel widths when they are thinking about their product. The onboarding card for the empty workspace (Task 9) is a good touch that prevents the "now what?" moment.

- **The session conductor prompt is the single most important deliverable in this wave.** Reading the full prompt text in Task 1, it hits the right notes: action-first, concise, context-aware. The instruction "If the user says 'run X', you run X" is exactly the behavioral shift needed. One concern: the prompt is approximately 800 tokens, but the ViewHint decision table adds rigidity. In practice, the agent will sometimes make wrong ViewHint calls (e.g., choosing `card_grid` for 2 outputs when `tabbed_view` would be better). The `document` fallback (TD-5) mitigates this, but the prompt should add: "When in doubt, omit the view_hint and let the frontend choose the default." This gives the agent permission to be uncertain.

- **Session resume is not covered in Wave 3.** The plan talks about "resumable sessions" in the executive summary, but none of the 17 tasks implement session loading from Supabase. Task 15 (session list) shows past sessions, but clicking one just navigates to `/sessions/[id]` -- there is no rehydration logic. This is fine if Wave 1 delivers session persistence, but it should be called out explicitly as a Wave 1 dependency. If Wave 1 is not done, clicking an old session will show an empty page. Add a loading/error state for this case.

- **The session tree is useful, not noise -- but only if sessions run long enough.** For a 2-flow session, the tree adds overhead. For a 10-flow session, it is essential. The plan correctly makes the tree collapsible and puts it in the workspace (not a separate panel). The bidirectional navigation (click tree node, chat scrolls to corresponding message) in Task 13 is a genuinely good UX idea. However, the tree should hide or minimize automatically when there are fewer than 3 flow runs.

- **This will feel like a product, not a prototype.** The combination of glass morphism styling, the onboarding empty states, the suggested prompts, the breadcrumb navigation, and the smooth panel transitions puts this well past "prototype" territory. The one thing that could break the illusion: if the agent blocks for 30-60 seconds during `test_flow` with no visual feedback. The plan explicitly defers progress streaming to Wave 4. This means Wave 3 sessions will have long silent pauses during flow execution. Adding even a simple "Running flow... (this may take up to 60 seconds)" message in the chat would help enormously. Task 4 defines `flow_started` and `flow_completed` SSE events -- make sure the chat panel renders these as visible status messages, not just state updates.

---

## Senior Engineer Review

### Critical Finding: Agent SDK Query API Requires Streaming Input for MCP Tools

**Severity: HIGH**

The official Claude Agent SDK documentation states:

> "Important: Custom MCP tools require streaming input mode. You must use an async generator/iterable for the `prompt` parameter - a simple string will not work with MCP servers."

The plan's Task 3 code example passes a plain string prompt conceptually, but the actual `query()` API requires an `AsyncIterable<SDKUserMessage>` when `mcpServers` is provided. The adapter code in Task 3 must use an async generator to yield user messages, not a simple string. This is not a dealbreaker, but the plan's code snippets will not work as written.

**Evidence:** The custom tools docs at `platform.claude.com/docs/en/agent-sdk/custom-tools` show the required pattern:

```typescript
async function* generateMessages() {
  yield {
    type: "user" as const,
    message: {
      role: "user" as const,
      content: "What's the weather in San Francisco?"
    }
  };
}

for await (const message of query({
  prompt: generateMessages(),
  options: {
    mcpServers: { "my-custom-tools": customServer }
  }
})) { /* ... */ }
```

The `query()` function returns `AsyncGenerator<SDKMessage, void>`, not a direct stream of text deltas. The plan's event mapping (Task 3: `SDKPartialAssistantMessage` with `text_delta` -> yield text event) is correct in concept, but the message type is actually `type: 'stream_event'` with an `event: RawMessageStreamEvent` field, not a direct `text_delta`. The spike (Task 2) will catch this, but the plan's code examples should be flagged as pseudo-code, not copy-pasteable implementations.

### Critical Finding: Agent SDK Requires Claude Code Runtime

**Severity: HIGH**

The SDK quickstart documentation confirms: "The Agent SDK uses Claude Code as its runtime. Install it for your platform." The `query()` function spawns a Claude Code subprocess. This means:

1. Claude Code CLI must be installed on the deployment machine (or container).
2. Authentication must be configured (either via `claude` CLI login or `ANTHROPIC_API_KEY` env var).
3. The SDK does NOT use the `@anthropic-ai/sdk` Anthropic client directly -- it manages its own subprocess.

For a server-side Express handler, this means the agent-service process spawns a Claude Code child process for every `query()` call. This has implications for concurrency (how many simultaneous sessions can run?), cold start time, and containerized deployment. The plan's spike (Task 2) correctly identifies this as a question to answer, but the plan's fallback (Option B: refactored raw API) should be treated as the more likely outcome for a production deployment, not just a backup.

**Recommendation:** Given the subprocess model, Option B (refactored raw Anthropic API handler) is likely the pragmatic choice for Wave 3. The Agent SDK is better suited for CLI-style agents, not server-side request handlers serving multiple concurrent users. The spike should validate this hypothesis.

### Finding: Tool Schema Conversion is Feasible but Non-Trivial

**Severity: MEDIUM**

The existing tools use Anthropic API `input_schema` format (JSON Schema with `type: "object"`, `properties`, `required`). The Agent SDK's `tool()` helper requires Zod schemas (`ZodRawShape`). The plan mentions a `jsonSchemaToZod()` conversion function in the adapter (Task 3) but does not define it.

Looking at the actual tool schemas in the codebase:

- `list-models.ts`: Simple schema -- one optional string enum property. Easy Zod conversion.
- `test-flow.ts`: Complex schema -- nested object (`flow_config`), optional nested object (`api_keys`), number with min/max constraints. The `flow_config` property is typed as `type: "object"` with no further schema definition (it just says "description"). This means the Zod schema would need to be `z.record(z.unknown())` or a manually-written detailed schema. Non-trivial.
- `show-diagram.ts`, `estimate-cost.ts`: Medium complexity.
- `task.ts`: Has `task` (string) and `context` (open object). Straightforward.

The plan estimates the adapter at "under 30 lines per tool" as the proceed criterion. For `list_available_models`, this is realistic. For `test_flow`, it will be closer to 50 lines due to the nested schema. The spike should specifically test `test_flow` conversion, not just `list_available_models`.

### Finding: AppShell Negative Margin Approach is Fragile but Acceptable

**Severity: LOW**

The plan (Task 6, TD-7) uses negative margins (`-m-4 md:-m-6 -mb-20 md:-mb-6`) to cancel the AppShell's padding. I verified the AppShell source:

```tsx
// app-shell.tsx line 68
<main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
  <div className="container-app relative z-10">{children}</div>
</main>
```

The negative margin approach works, but it is tightly coupled to the exact padding values. If anyone changes the AppShell padding, the session page breaks silently. A more robust approach would be to add a `fullBleed` prop to AppShell that conditionally removes the padding. However, for Wave 3, the negative margin approach is acceptable -- just add a comment:

```tsx
// COUPLING: These negative margins cancel AppShell's p-4 md:p-6 pb-20 md:pb-6
// If AppShell padding changes, update these values too.
```

Also note: the `container-app` wrapper inside AppShell adds a `max-width` constraint. The negative margins cancel the padding, but the session page content is still inside `<div className="container-app relative z-10">`. The session layout needs to break out of this container too. This is not addressed in the plan. The session page div would need `max-w-none` or `w-screen` to override the container.

### Finding: SuggestedPrompt Has No onClick Handler

**Severity: LOW (correctly identified in plan)**

The plan (Task 8) correctly identifies that `SuggestedPrompt` in `chat-message-list.tsx` has no `onClick` handler:

```tsx
// chat-message-list.tsx line 67-76
function SuggestedPrompt({ text }: { text: string }) {
  return (
    <button type="button" className="...">
      {text}
    </button>
  );
}
```

The button renders but does nothing when clicked. The plan correctly proposes adding `onSuggestedPromptClick` to `ChatMessageList` props and threading it through. This is a straightforward fix.

### Finding: MobileNav Has No Conditional Hide Mechanism

**Severity: LOW**

The plan (Task 14, TD-10) says to hide `MobileNav` on session pages. Looking at the actual component:

```tsx
// mobile-nav.tsx
export function MobileNav() {
  const pathname = usePathname();
  // ... no conditional rendering based on pathname
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass-nav ...">
```

`MobileNav` is rendered unconditionally in `AppShell` (line 74). To hide it on session pages, one of two approaches is needed:

1. Add a pathname check inside `MobileNav`: `if (pathname.startsWith('/sessions/')) return null;`
2. Pass a `hide` prop from `AppShell`, triggered by the child route.

Approach 1 is simpler and the plan implicitly suggests it ("add pathname check to hide on session pages"). This is fine.

### Finding: Zod Version Mismatch Between Services

**Severity: MEDIUM**

The agent-service has `zod: ^3.22.4` in its `package.json`. The conclave-app has `zod: ^4.3.5`. The plan says to bump agent-service Zod to `^3.24.1` for SDK compatibility. However, the Agent SDK's `tool()` helper imports from `zod` and expects Zod v3 APIs. Meanwhile, the frontend is already on Zod v4, which has breaking API changes. This means:

- The agent-service and conclave-app cannot share a single Zod version.
- The shared types (Task 5) cannot use Zod for runtime validation on both sides.
- The plan's frontend `isValidViewHint()` function wisely avoids Zod and uses a simple `includes()` check instead. This is correct.

No action needed beyond awareness. The services are separate packages with independent dependencies, so the version mismatch is not a runtime problem. Just do not attempt to share Zod schemas across the monorepo boundary.

### Finding: Flow Architect Chat Page Bypasses AppShell

**Severity: INFORMATIONAL**

The existing `/flows/new/chat` page (`page.tsx`) creates its own full-screen layout with its own background gradients, header, and chat area. It does NOT use the AppShell at all -- it renders `<div className="min-h-screen bg-[#0a0a1a] text-white flex flex-col">` as a standalone page. This means the negative-margin approach for the session page is not the only option. An alternative would be to follow the chat page pattern and build a fully standalone session page. However, the plan's approach (staying within AppShell with negative margins) preserves sidebar navigation, which is better for sessions that need the sidebar for context switching.

### Finding: SSE Event Contract Difference

**Severity: LOW**

The plan's Task 4 defines new SSE events (`workspace_update`, `flow_started`, `flow_completed`). The existing `AgentEvent` type in `types/index.ts` uses a flat union:

```typescript
export interface AgentEvent {
  type: AgentEventType; // "text" | "tool_use" | "tool_result" | "error" | "done"
  content?: string;
  tool?: string;
  // ...
}
```

The new events need to be added to both `AgentEventType` and `SSEEventType`. The plan correctly specifies this for `SSEEventType` but does not explicitly mention extending `AgentEventType`. This is minor -- the session handler will define its own event types if using the SDK path.

---

## Assumptions Audit

| # | Assumption | Plan Verdict | Reviewed Verdict | Evidence |
|:-:|-----------|:------------:|:----------------:|----------|
| A1 | The Claude Agent SDK supports registering custom tools via MCP servers (`createSdkMcpServer()` + `tool()` with Zod schemas), NOT via `allowedTools` with Anthropic-style schemas. | Corrected in plan | **CONFIRMED** | Official docs at `platform.claude.com/docs/en/agent-sdk/custom-tools` show exactly this API: `createSdkMcpServer({ name, tools: [tool(name, desc, zodSchema, handler)] })`. Tool names follow `mcp__<server>__<tool>` pattern. |
| A2 | The Agent SDK yields messages that can map to SSE events, but requires `includePartialMessages: true` for streaming text deltas. | Corrected in plan | **CONFIRMED WITH CAVEAT** | `SDKPartialAssistantMessage` is type `'stream_event'` with `event: RawMessageStreamEvent` from the Anthropic SDK. Compatible with existing delta parsing, but requires unwrapping the `event` field first. Plan's event mapping pseudocode is directionally correct but not copy-pasteable. |
| A3 | The Agent SDK's `query()` accepts `options.model` (string) and `options.systemPrompt` (string or preset). | Confirmed | **CONFIRMED** | TypeScript reference: `Options.model` is `string`, `Options.systemPrompt` is `string \| { type: 'preset'; preset: 'claude_code'; append?: string }`. However, `query()` requires `AsyncIterable<SDKUserMessage>` for `prompt` when `mcpServers` is provided -- a simple string will not work with MCP tools. |
| A4 | Existing chat components can be reused without forking. `ChatMessageList` needs `emptyState` prop and `onSuggestedPromptClick` callback. | Confirmed | **CONFIRMED** | Reviewed `chat-message-list.tsx`. Generic props, no route coupling. `SuggestedPrompt` has no `onClick` handler at line 67-76. Empty state is hardcoded to "Welcome to Flow Architect" text. Both need modification but not forking. |
| A5 | The existing `ToolResultRenderer` works for session mode because sessions use the same tools. | Confirmed | **CONFIRMED** | Tools in `config.ts` re-export from `tools/index.ts`: `list_available_models`, `show_flow_diagram`, `estimate_cost`, `test_flow`, `task`. All 5 tools use the same `Tool` interface with `{ name, schema, execute }` shape. Session handler will use the same tools. |
| A6 | Radix Tabs supports dynamic tab creation at runtime. | Confirmed | **CONFIRMED** | `@radix-ui/react-tabs` v1.1.13 is in `conclave-app/package.json`. Radix Tabs is controlled component -- dynamic `TabsTrigger`/`TabsContent` elements render via standard React `.map()`. |
| A7 | Next.js 16 supports `app/(app)/sessions/[id]/page.tsx` route pattern. | Confirmed | **CONFIRMED** | Existing `app/(app)/flows/[id]/page.tsx` and `app/(app)/runs/[id]/page.tsx` use same pattern. `next: 16.1.1` in `conclave-app/package.json`. |
| A8 | Agent service can support `/api/sessions/*` routes alongside existing `/api/chat/*` routes. | Confirmed | **CONFIRMED** | Express supports multiple route prefixes. The agent-service is Express-based (`express: ^4.18.2` in `agent-service/package.json`). No conflict. |
| A9 | No existing tree component. Session tree is purpose-built using shadcn Accordion. | Confirmed | **CONFIRMED** | Globbed all components -- no tree component found. `@radix-ui/react-accordion` v1.2.12 is in dependencies. `components/ui/accordion.tsx` exists as the shadcn wrapper. |
| A10 | Two-panel layout works within AppShell by canceling main padding with negative margins. | Confirmed (approach refined) | **CONFIRMED WITH CAVEAT** | AppShell line 68: `<main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">`. Negative margins cancel padding. However, `<div className="container-app relative z-10">` on line 69 adds a max-width container that the session page also needs to escape. Plan does not address the `container-app` constraint. |
| A11 | `test_flow` tool returns structured data transformable into `SessionArtifact[]`. | Plausible | **CONFIRMED** | Reviewed `test-flow.ts`. `TestFlowOutput` has `phases` (array with `name`, `outputs: Record<string, string>`), `full_outputs` (Record<string, Record<string, string>>), per-model results keyed by participant ID. Transformation to `SessionArtifact[]` is straightforward: iterate `full_outputs`, create one artifact per participant with model name as label and output as content. |
| A12 | SSE via `response.body.getReader()` works for session endpoints without `EventSource` migration. | Confirmed | **CONFIRMED** | `use-agent-chat.ts` lines 205-232 use `response.body?.getReader()` with `TextDecoder`, line splitting, and JSON parsing. Same pattern works for any SSE-over-POST endpoint. No `EventSource` dependency. |
| A13 | The Agent SDK is published as `@anthropic-ai/claude-agent-sdk` and requires Claude Code runtime on the host. Node.js >= 20 compatible. | Partially wrong; Addressed by spike | **CONFIRMED -- RUNTIME DEPENDENCY IS REAL** | NPM package exists at `npmjs.com/package/@anthropic-ai/claude-agent-sdk`. Quickstart doc confirms: "The Agent SDK uses Claude Code as its runtime. Install it for your platform." The SDK spawns a Claude Code subprocess, not an in-process API client. This is a deployment concern for server-side use. Agent-service `package.json` has `"node": ">=20.0.0"`. |
| A14 | Wave 1 and Wave 2 are complete or have stub interfaces before Wave 3 begins. | Plausible | **PLAUSIBLE -- BUT SESSION LIST WILL BE EMPTY** | If Wave 1 (Supabase persistence) is not done, sessions are in-memory only. The session list page (Task 15) will show no past sessions after a server restart. The plan correctly notes "Wave 3 uses in-memory store + demo-user as stand-ins" but Task 15's session list endpoint needs a fallback for this scenario. |
| A15 | Mobile responsiveness is secondary for Wave 3. MobileNav hidden on session pages. | Validated with review | **CONFIRMED** | `MobileNav` at `components/layout/mobile-nav.tsx` is `fixed bottom-0 ... z-50 md:hidden`. It has no conditional rendering currently. Adding `if (pathname.startsWith('/sessions/')) return null;` is trivial. The plan (Task 14) correctly identifies this. |

---

## Recommended Changes

1. **Add `container-app` escape to the session page wrapper (Task 6).** The plan's negative-margin approach cancels the AppShell padding but does not address the `container-app` max-width wrapper on line 69 of `app-shell.tsx`. The session page wrapper needs to also break out of this container. Options: (a) add `max-w-none w-full` to the negative-margin div, or (b) add a `fullBleed` prop to AppShell that conditionally omits the `container-app` class. Either way, the plan must address this or the session layout will be constrained to the container's max-width.

2. **Update Task 2 spike to test `test_flow` adapter, not just `list_available_models`.** The plan says "Write a prototype adapter that converts ONE existing tool (`list_available_models`, the simplest)." This is the wrong tool to test -- the simplest tool proves nothing about the hard cases. The spike should convert `test_flow`, which has a complex nested schema with `flow_config: { type: "object" }` (no further definition) and optional nested `api_keys`. If that converts cleanly, everything else will too.

3. **Spike must validate the subprocess model for concurrent server use (Task 2).** The Agent SDK spawns a Claude Code child process per `query()` call. For a server handling 5 concurrent sessions, that means 5 child processes. The spike should test: (a) Can two `query()` calls run concurrently without interference? (b) What is the cold start time for `query()`? (c) Does the subprocess survive if the parent Express request is aborted? If any of these fail, Option B (raw API) should be the default, not the fallback.

4. **Document that `query()` requires `AsyncIterable<SDKUserMessage>` for the prompt parameter when using MCP servers (Task 3).** The plan's code examples use a conceptual `handleSessionMessage(message, session)` signature. If the SDK path is chosen, the actual implementation must wrap user messages in an async generator. The adapter code in Task 3 should show this pattern explicitly, or the implementer will hit a confusing runtime error.

5. **Add `flow_started` / `flow_completed` rendering in the chat panel (Task 8).** The plan defines these SSE events in Task 4 but does not specify how the chat panel renders them. During `test_flow` execution (which can take 30-120 seconds), the user sees silence. The chat panel should render `flow_started` as a status message: "Running [flow_name] with [models]..." and `flow_completed` as "Flow completed in [N] seconds." This is the difference between "broken" and "working but waiting."

6. **Add a defensive guard for empty `currentView.artifacts` in the workspace renderer (Task 9).** The plan's switch statement dispatches to `DocumentView`, `TabbedView`, or `CardGridView` based on `viewHint`. But if `artifacts` is an empty array (e.g., partial flow failure where no models returned results), these components will render empty content. The workspace renderer should check `artifacts.length === 0` and show a "No results" state rather than an empty view component.

7. **Add an explicit "Wave 1 not ready" fallback for the session list (Task 15).** The plan says sessions come from `GET /api/sessions`. If Wave 1 is not done, this endpoint does not exist. Task 15 should define: (a) a mock/stub endpoint that returns an empty array, or (b) a frontend fallback that shows "Sessions are available after the next update" instead of a network error.

8. **Soften the ViewHint instruction in the session conductor prompt (Task 1).** Add to the "Workspace Updates" section: "If you are unsure which view_hint is appropriate, omit it. The frontend will use a safe default." This gives the agent permission to be uncertain rather than forcing a potentially wrong layout choice.

9. **Clarify that Option B (refactored raw API) is the more likely outcome.** The plan frames the SDK as the primary path and Option B as the fallback. Based on this review, the SDK's subprocess model is a poor fit for a server-side Express handler serving concurrent users. The plan should frame Option B as the recommended path and the SDK as a future upgrade if/when Anthropic provides an in-process API client. This reframing sets correct expectations and avoids the spike feeling like a "failure" when it correctly identifies the subprocess concern.

10. **Add a coupling comment to the negative-margin wrapper.** Wherever the `-m-4 md:-m-6 -mb-20 md:-mb-6` values appear, add a comment: `// COUPLING: cancels AppShell padding (p-4 md:p-6 pb-20 md:pb-6). Update if AppShell changes.` This prevents silent breakage when someone eventually modifies the AppShell.

---

## Summary

The plan is well-researched and implementable. The session conductor prompt, the ViewHint type system, the two-panel layout, and the SSE event extensions are all well-designed. The highest-risk item remains the Agent SDK integration, and the time-boxed spike (Task 2) is the right approach. Based on this review, the spike will most likely result in choosing Option B (refactored raw API handler), which is a fine outcome -- the plan is already well-prepared for it. The recommended changes above are refinements, not redesigns. Approve with the changes incorporated.
