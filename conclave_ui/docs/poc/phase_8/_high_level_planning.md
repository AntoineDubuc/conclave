# Phase 8: Conclave Sessions

> **What if all your favorite AIs could think together as a team?**

## What It Is

**Conclave Sessions** is a persistent AI workspace where users have an open-ended conversation with an intelligent agent that can assemble and run multi-model collaborations on the fly — not as isolated tasks, but as steps toward a larger goal.

Today, Conclave lets users pick a flow pattern, select models, run it, and see results. That's powerful, but it's a tool. Sessions turn Conclave into a thinking partner.

## The Problem

Every AI power user today has Claude, ChatGPT, and Gemini open in separate tabs. They copy-paste between them. They manually synthesize conflicting perspectives. They lose context every time they start a new conversation. And when they want to go deeper — "take what Gemini said and have Claude challenge it" — they're back to copy-paste.

Existing flows solve the orchestration problem but not the thinking problem. A flow is a recipe: defined inputs, defined steps, defined outputs. Thinking isn't like that. Thinking is iterative, exploratory, and unpredictable. You don't know the next step until you see the results of the current one.

## The Solution

A Session is an ongoing conversation where the user's goal drives the experience, and flows are tools the agent reaches for when needed.

**Example interaction:**

> **User:** I want to ideate on a new mobile app for elderly care.
>
> **Agent:** Good starting point. I'd suggest a Hub-and-Spoke approach — one model leading the synthesis while others contribute specialized perspectives. Want me to set that up with 3 models?
>
> **User:** Yes, let's go.
>
> *Agent assembles and runs a Hub-and-Spoke flow. Results appear inline in the conversation with full editing and iteration capability.*
>
> **User:** Interesting. Gemini's point about medication tracking is strong. Can we get Gemini to flesh that out using 5 different persona perspectives?
>
> *Agent creates a new flow on the fly — Gemini as the hub with 5 persona-driven prompts. Previous context carries forward automatically.*
>
> **User:** Now take the best ideas from both runs and have Claude write a product brief.
>
> *Agent runs a single-model task, feeding accumulated session context as input.*

The user never left the conversation. They never re-explained their goal. They never manually copied outputs between runs. The session remembered everything and the agent handled all the orchestration.

## Key Distinction

| | Flows (Today) | Sessions (Phase 8) |
|---|---|---|
| **Mental model** | "I want to run this pattern" | "I want to achieve this goal" |
| **Lifecycle** | Start → Configure → Run → Done | Open-ended, multi-step |
| **Context** | Each flow is isolated | Accumulates across the session |
| **Agent role** | Absent (wizard-driven) | Active co-pilot throughout |
| **Flow creation** | Upfront, before execution | On-the-fly, mid-conversation |
| **Iteration** | Within a single flow's results | Across multiple flows and approaches |

Flows are recipes. Sessions are kitchens.

## UI/UX: Adaptive Workspace

### Layout: Two-Panel with Adaptive Focus

The session screen follows the IDE convention users already know (VS Code, Cursor):

```
+------------------------------------------+------------------+
|                                          |                  |
|           WORKSPACE (left)               |   CHAT (right)   |
|                                          |                  |
|  Session tree / artifacts / results      |   Conversation   |
|  Expands to full-width when reviewing    |   with agent     |
|                                          |                  |
+------------------------------------------+------------------+
|  [  Type a message...                                    >] |
+-------------------------------------------------------------+
```

**Two states:**

1. **Conversing** — Chat panel on the right, session tree/artifacts on the left. The user is directing the agent, reviewing the session history, and deciding next steps.

2. **Reviewing** — When flow results come back (e.g., 5 persona outputs), the workspace expands full-width to give the user room to read, compare, and edit. The chat panel collapses, but a **persistent input bar stays at the bottom** — full-width, always visible, cursor ready. The user can type "now have Claude synthesize these" without clicking anything to re-open the chat. An expand icon on the input bar brings the full chat history back.

### Why This Works for PMs

- **No mode confusion.** The input bar is always visible. The user never loses the AI. The context just shifts between "I'm reviewing work" and "I'm directing the next step."
- **Familiar pattern.** Left = structure/navigation, right = active interaction. Same as Notion, Slack, or any IDE.
- **Results get the space they need.** Five persona outputs side-by-side or in tabs, not crammed into a chat bubble.
- **Reversible.** Click the expand icon on the input bar and the chat slides back. No hidden state, no lost context.

### Left Panel: Session Tree

The left panel is the session's table of contents — a structured view of everything that has happened:

- **Session name and goal** at the top
- **Flow runs as expandable nodes** — each run shows pattern type, models used, timestamp
  - Child nodes: individual model outputs, clickable to open in the workspace
- **Artifacts** — accumulated outputs (edited results, synthesized briefs, etc.)
- **Context breadcrumb** — "Session > Flow 2 > Gemini Persona Output" so the user always knows where they are

### The Adaptive Challenge

The core UI problem: the conversation is linear, but the work artifacts keep changing shape. A Hub-and-Spoke with 3 models needs a different layout than 5 Gemini personas, which is different from a single Claude brief.

**Approach:** The workspace renders a view component appropriate to the current artifact:

| Artifact Type | Workspace View |
|---|---|
| Multi-model parallel results | Tabbed view (one tab per model) or side-by-side comparison |
| Single model output | Full-width document editor |
| Persona exploration (N agents) | Card grid or tabbed view with persona labels |
| Synthesis/brief | Full-width document with edit capability |
| Flow diagram | Visual representation of phases and participants |

The agent tells the UI what it produced, and the workspace renders the appropriate view. The user doesn't configure layouts — the system adapts.

---

## Technical Architecture

### Decision 1: Session State

**In-memory on the agent service + Supabase sync.**

The agent service holds the active session in memory for fast context access while the user is working. It syncs to Supabase in the background for durability. If the user leaves and comes back, it rehydrates from the database.

Why: The agent needs fast access to session context to reason about next steps — "what did Gemini say in flow 2?" can't require a database round trip every time. In-memory for the hot path, database for persistence.

```
                  +-----------------------+
                  |    Agent Service      |
                  |                       |
  User message -->|  Session Memory       |--- sync -->  Supabase
                  |  (conversation,       |              (sessions table,
                  |   flow results,       |<-- rehydrate  session_events table)
                  |   user edits)         |
                  +-----------------------+
```

**Data model (Supabase):**

- `sessions` — id, user_id, name, goal, status, created_at, updated_at
- `session_events` — id, session_id, event_type, payload (JSONB), sequence_number, created_at
  - Event types: `user_message`, `agent_message`, `flow_started`, `flow_completed`, `user_edit`, `artifact_created`

The event log is append-only. The agent service replays it to rebuild session memory on rehydration.

### Decision 2: Agent Orchestration

**Stateful agent loop — the agent is the orchestrator.**

The agent service maintains a long-running session process. When the user says "run this," the agent calls the executor, gets results, reasons about them, and streams back both the results and its next suggestion in one turn. The frontend is a display layer, not an orchestrator.

Why: This is what makes sessions feel intelligent. If the frontend drives the loop, every "run then think about it" requires a round trip through the user. With a stateful agent, it can run a flow, analyze results, and say "Gemini had the strongest take — want me to go deeper?" in one seamless interaction.

```
User: "Run 5 personas on this"
         |
         v
  +--- Agent Service (stateful) ---+
  |                                |
  |  1. Build flow config          |
  |  2. Call Executor API -------->|---> Executor API (stateless, unchanged)
  |  3. Receive results   <--------|
  |  4. Analyze & reason           |
  |  5. Stream to frontend:        |
  |     - progress updates         |
  |     - results                  |
  |     - next suggestion          |
  +--------------------------------+
         |
         v
  Frontend renders results + suggestion
```

**Key implication:** The executor API remains stateless and unchanged. All session intelligence lives in the agent service. This means Phase 8 doesn't require executor changes — only agent service and frontend work.

### Decision 3: Frontend-Agent Communication

**Server-Sent Events (SSE) for streaming, POST for user messages.**

The agent streams typed events over a single HTTP connection: `flow_started`, `model_progress`, `flow_completed`, `agent_suggestion`, `artifact_created`. The frontend receives these and updates the workspace in real time. User messages go via regular POST requests.

Why: The pattern is inherently asymmetric — the user sends short messages, the agent streams long responses with progress updates. SSE handles this naturally and is simpler to operate than WebSockets. The existing chat hook already uses fetch; SSE is incremental, not a rewrite.

```
Frontend                          Agent Service
   |                                    |
   |--- POST /sessions/:id/message ---->|
   |                                    |
   |<--- SSE stream -------------------|
   |    event: flow_started             |
   |    event: model_progress (1/5)     |
   |    event: model_progress (2/5)     |
   |    event: flow_completed           |
   |    event: workspace_update         |
   |    event: agent_message            |
   |                                    |
```

**Event schema:**

```json
{
  "event": "workspace_update",
  "data": {
    "type": "persona_results",
    "view_hint": "card_grid",
    "artifacts": [
      { "id": "p1", "label": "Caregiver Persona", "model": "gemini", "content": "..." },
      { "id": "p2", "label": "Patient Persona", "model": "gemini", "content": "..." }
    ]
  }
}
```

The `view_hint` field tells the frontend which workspace component to render. The agent decides the layout, not the user.

If we later need mid-execution interruption ("stop this flow"), we add a single `POST /sessions/:id/cancel` endpoint. No WebSocket upgrade needed.

### Decision 4: Result Piping

**Agent-managed context injection — the agent builds prompts, the executor stays dumb.**

When the user says "take Gemini's output and feed it to Claude," the agent reads the prior result from session memory and injects it directly into the next flow's prompt. The executor never knows it's part of a session — it just runs a flow config with whatever prompts it receives.

Why: Keep the executor as a simple, stateless flow runner. All intelligence — what context to include, how much to summarize, how to frame prior results — lives in the agent where the reasoning happens. This also means the executor needs zero changes for Phase 8.

```
Session Memory:
  Flow 1 result: { gemini: "Medication tracking is critical because..." }
  Flow 2 result: { personas: [...5 outputs...] }

User: "Have Claude write a product brief from all of this"

Agent builds flow config:
  participants: [{ id: "claude", provider: "anthropic", model: "claude-opus-4.5" }]
  phases: [{
    prompt: "Write a product brief for an elderly care app.

    Context from prior analysis:
    ---
    Initial analysis (Gemini): Medication tracking is critical because...
    ---
    Persona exploration (5 perspectives): [summarized by agent]
    ---

    Synthesize the above into a concise product brief."
  }]
```

The agent controls the narrative. It can summarize, quote selectively, or include full outputs depending on token budget and relevance.

### Architecture Summary

```
+------------------+     POST      +-------------------+     HTTP      +----------------+
|                  |  /message     |                   |   /execute    |                |
|   Next.js        |-------------->|   Agent Service   |-------------->|  Executor API  |
|   Frontend       |               |   (stateful)      |               |  (stateless)   |
|                  |<----- SSE ----|                   |<--- JSON -----|                |
|  - Workspace     |   events      |  - Session memory |   results     |  - Runs flows  |
|  - Chat          |               |  - Orchestration  |               |  - Calls LLMs  |
|  - Session tree  |               |  - Context mgmt   |               |  - Returns     |
|  - Input bar     |               |  - Prompt building|               |    results     |
|                  |               |                   |               |                |
+------------------+               +-------------------+               +----------------+
                                          |     ^
                                    sync  |     | rehydrate
                                          v     |
                                   +-------------------+
                                   |    Supabase       |
                                   |  - sessions       |
                                   |  - session_events |
                                   |  - flows          |
                                   |  - runs           |
                                   +-------------------+
```

**What changes per service:**

| Service | Changes for Phase 8 |
|---|---|
| **Executor API** | None. Stays stateless. Runs flow configs as today. |
| **Agent Service** | Major. Session memory, stateful loop, SSE streaming, context injection, flow orchestration. |
| **Next.js Frontend** | Major. Session UI, adaptive workspace, session tree, SSE client, persistent input bar. |
| **Supabase** | Minor. New `sessions` and `session_events` tables. |

---

## What Needs to Be True

1. **Session persistence** — event-sourced log in Supabase, in-memory on agent service for fast access
2. **Stateful agent** — long-running session process that orchestrates flows, analyzes results, and suggests next steps
3. **SSE streaming** — typed events from agent to frontend for real-time progress and workspace updates
4. **Agent-managed context** — the agent builds prompts with prior results, the executor stays dumb
5. **Adaptive workspace** — the left panel renders the right view based on `view_hint` from the agent
6. **Persistent input bar** — the user can always direct the agent, even when reviewing results full-width
7. **Session tree** — structured navigation so the user never gets lost in a long session
8. **Zero executor changes** — all new complexity in agent service and frontend only
