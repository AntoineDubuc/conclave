# Research: Discovery Chat → Configure Step Data Loss

## Bug Summary

In advanced mode, after chatting extensively in the Discovery step and clicking "Continue to Configure", the Configure step shows empty fields. The user's conversation is not used to pre-fill anything. The user expected to see a synthesized task description ready to review/edit.

---

## Root Cause

The `handleDiscoveryContinue` callback (page.tsx:356-361) stores the transcript in `discoveryTranscript` state but **never uses it to populate `taskText`** (which drives the TaskInput textarea) or any other UI field.

```typescript
const handleDiscoveryContinue = useCallback(
  (transcript: string) => {
    setDiscoveryTranscript(transcript);  // stored but not shown in UI
    goToNextStep();                       // moves to "configure"
  },
  [goToNextStep]
);
```

The `discoveryTranscript` is only used at execution time (page.tsx:447) where it's passed as `payload.discovery_context` to the executor API. The executor prepends it to the task prompt (execute/route.ts:365-368):

```typescript
if (discovery_context) {
  taskPrompt = `Context from discovery conversation:\n${discovery_context}\n\n---\n\nTask:\n${task}`;
}
```

---

## Confirmed Facts

### 1. The User Flow (Advanced Mode Wizard)

Steps: `choice → flow-type → mode → models → discovery → configure → results`

Defined in `app/(app)/flows/new/page.tsx:109-118`.

### 2. State Variables at Configure Step

| State Variable | Initial Value | Source | Used in Configure UI? |
|---|---|---|---|
| `taskText` | `""` (line 205) | User types manually | Yes — TaskInput textarea |
| `discoveryTranscript` | `""` (line 206) | Set by handleDiscoveryContinue | **NO — never shown** |
| `agentConfigs` | `[]` → built at models step (line 350) | `buildAgentConfigsFromSelection()` | Yes — SystemPromptEditor |
| `defaultPrompts` | `{}` → built at models step (line 321) | Same as above | Yes — reset reference |

### 3. Discovery Chat Component

**File:** `components/flows/discovery-chat.tsx`

- Uses `useDiscoveryChat` hook (direct LLM call via `/api/chat/discovery`, NOT the agent service)
- The "Continue to Configure" button calls `onContinue(getTranscript())`
- `getTranscript()` returns plain text: `"User: ...\n\nAssistant: ..."`
- Props: `onContinue: (transcript: string) => void`
- Has internal `selectedModel` state (`ModelInfo` with `.id` and `.provider`)
- The model used for discovery is NOT exposed to the parent component
- The "Continue" button is disabled when `!hasMessages` (line 488)
- There's also a "Skip" button that just calls `onSkip()` → `goToNextStep()` with no transcript

### 4. Discovery Chat API Endpoint

**File:** `app/api/chat/discovery/route.ts`

- Generic SSE streaming endpoint supporting 4 providers (Anthropic, OpenAI, Google, xAI)
- Hardcodes `DISCOVERY_CHAT_SYSTEM_PROMPT` (imported from `lib/flows/defaults.ts`)
- Request body: `{ model, provider, messages, temperature?, maxTokens?, apiKey? }`
- Response: SSE with `data: {"type":"text","delta":"..."}\n\n` chunks
- No optional system prompt parameter — always uses the discovery prompt
- **Reusable for synthesis?** Structurally yes (same LLM call mechanism), but would need a separate endpoint or an optional `systemPrompt` param since the current one hardcodes the prompt

### 5. Discovery Chat System Prompt

**File:** `lib/flows/defaults.ts:323-331`

```
You are a helpful assistant guiding the user through exploring and refining their ideas
before running a multi-model collaboration flow.

Help the user:
- Clarify what they want to accomplish
- Refine their task description
- Think through the problem from multiple angles
- Identify what perspectives would be valuable

Be conversational and helpful. Ask clarifying questions when needed.
When the user seems ready, encourage them to proceed to configuration.
```

Key: This is conversational guidance. It does NOT request structured output. The resulting transcript is a natural back-and-forth conversation, not a clean task description.

### 6. TaskInput Component

**File:** `components/flows/task-input.tsx`

- Controlled component: `value` prop → textarea, `onChange` → setTaskText
- Props: `value, onChange, onRunFlow?, isRunning?, disabled?, placeholder?, maxLength?, className?`
- Has template buttons for quick-fill (but separate from discovery)
- **Pre-fill is trivial:** Just set `taskText` state before rendering
- Character limit: 10,000 (maxLength default)

### 7. SystemPromptEditor Component

**File:** `components/flows/system-prompt-editor.tsx`

- Props: `agents: AgentConfig[], onUpdate, onResetToDefault, defaultPrompts`
- Reads initial prompt from `agent.systemPrompt` (line 170)
- Could be pre-populated by modifying `agentConfigs` state before rendering
- **Not in scope for this fix** — system prompts are already sensible defaults

### 8. Configure Step Validation

**File:** `page.tsx:234`

```typescript
const canProceedFromConfigure = taskText.trim().length > 0;
```

The "Run Flow" button is disabled when `taskText` is empty. So after the bug, the user can't even run the flow without manually typing a task — all the discovery conversation is "lost" from the user's perspective.

### 9. Agent Config Initialization

**File:** `page.tsx:311-322`

`initializeAgentConfigs()` is called when proceeding FROM the models step (line 350), BEFORE discovery. So by the time we reach configure, `agentConfigs` already exist with role-specific default prompts from `buildAgentConfigsFromSelection()`.

### 10. Executor's Use of discovery_context

**File:** `app/api/flows/execute/route.ts:365-368`

At execution time, the raw transcript is prepended to the task prompt:
```typescript
taskPrompt = `Context from discovery conversation:\n${discovery_context}\n\n---\n\nTask:\n${task}`;
```

This means the executor ALREADY receives the discovery context. The fix should pre-fill `taskText` with a synthesized task description, and the executor will still get both the synthesized task AND the raw transcript context — which is the ideal outcome.

### 11. Existing Synthesis Patterns

No existing transcript-to-task synthesis pattern in the codebase. The hub-spoke flow has a synthesis prompt for leader agents, but that's for flow execution, not transcript extraction. A new synthesis mechanism needs to be created.

### 12. Discovery Chat Hook

**File:** `lib/hooks/use-discovery-chat.ts`

- Makes direct LLM API calls via `/api/chat/discovery`
- `getTranscript()` (lines 220-223): joins messages as `"User: ...\n\nAssistant: ..."`
- Stores messages as `DiscoveryMessage[]` with id, role, content, timestamp
- Returns: `{ messages, isStreaming, isConnecting, error, sendMessage, clearMessages, getTranscript }`

---

## Design Decision

### Approach: LLM Synthesis During Transition

When "Continue to Configure" is clicked:
1. Store the raw transcript (as before)
2. Navigate to configure step with a "synthesizing" loading overlay
3. Make a one-shot LLM call to a new `/api/chat/synthesize` endpoint
4. The synthesis prompt extracts a clean, actionable task description from the transcript
5. Pre-fill `taskText` with the synthesized result
6. User can review/edit the synthesized task before running

### Why LLM Synthesis (not raw transcript pre-fill)

- The transcript is conversational ("I'm thinking about...", "What if we..."), not a task description
- A transcript can be thousands of characters of back-and-forth — too messy for TaskInput
- LLM synthesis produces a clean, actionable task description the user can review
- The raw transcript is still available as `discovery_context` at execution time

### Edge Cases

| Case | Handling |
|------|----------|
| Synthesis fails (API error) | Fall back to empty taskText, show warning notification |
| Very long transcript | LLM naturally condenses; endpoint should have reasonable maxTokens |
| User edits synthesized task | Works naturally — TaskInput is a controlled component |
| User clicks Skip | No synthesis needed (existing behavior preserved) |
| Empty transcript | Can't happen — Continue button disabled when no messages |

### What About System Prompts?

Out of scope for this fix. The agent configs already have sensible role-specific defaults. Customizing system prompts based on discovery would be a separate feature.

---

## Files That Need Changes

| # | File | Change Type | Description |
|---|------|-------------|-------------|
| 1 | `app/api/chat/synthesize/route.ts` | **NEW** | Non-streaming synthesis endpoint |
| 2 | `lib/flows/defaults.ts` | **MODIFY** | Add `SYNTHESIS_SYSTEM_PROMPT` constant |
| 3 | `components/flows/discovery-chat.tsx` | **MODIFY** | Pass model/provider info with onContinue |
| 4 | `app/(app)/flows/new/page.tsx` | **MODIFY** | Add synthesis call, loading state, pre-fill taskText |

---

## Zero Assumptions Remaining

All open questions from initial research (Q1-Q7) have been answered with exact file paths and line numbers. The design approach, edge cases, and file change list are all confirmed against actual code.
