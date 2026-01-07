# Conclave SaaS - Ideation

## Core Value Proposition

**Let users create custom multi-LLM flows by chatting with Claude Code.**

Instead of manually writing YAML configs and prompts, users describe what they want in natural language, and Claude Code (via the Agent SDK) generates the flow for them - just like how we built Conclave together through conversation.

---

## The "Meta" Insight

We used Claude Code to build a multi-LLM collaboration tool. Now we use Claude Code to help users *design* their own multi-LLM collaborations. The agent becomes a "Flow Architect."

```
┌─────────────────────────────────────────────────────────────┐
│                     USER EXPERIENCE                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User: "I want 3 AI models to debate a technical decision  │
│         and then vote on the best approach"                 │
│                                                             │
│  Claude Code: "I'll create a debate flow for you. Here's   │
│               what I'm thinking:                            │
│               - Round 1: Each model proposes an approach    │
│               - Round 2: Cross-examination                  │
│               - Round 3: Voting with confidence scores      │
│               - Final: Synthesis with dissent log           │
│                                                             │
│               Should I generate this flow?"                 │
│                                                             │
│  User: "Yes, but make the leader rotate each round"         │
│                                                             │
│  Claude Code: [Creates flow config, prompts, saves to user] │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                  │
│                     (Next.js / React)                            │
├──────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │
│  │ Flow Studio │  │  My Flows   │  │    Run Flow             │   │
│  │  (Chat UI)  │  │  Dashboard  │  │    (Execute + Results)  │   │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                         BACKEND                                   │
│                     (Node.js / Python)                           │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              Claude Agent SDK (EC2)                       │    │
│  │                                                           │    │
│  │  Agent has tools:                                        │    │
│  │  - create_flow(config) → saves flow to user account      │    │
│  │  - validate_flow(config) → checks for errors             │    │
│  │  - test_flow(flow_id, sample_input) → runs test          │    │
│  │  - list_templates() → shows built-in flow templates      │    │
│  │  - read_docs(topic) → retrieves Conclave documentation   │    │
│  │                                                           │    │
│  │  Agent context includes:                                  │    │
│  │  - Conclave architecture knowledge                        │    │
│  │  - User's existing flows                                  │    │
│  │  - Best practices for multi-LLM collaboration             │    │
│  │                                                           │    │
│  └──────────────────────────────────────────────────────────┘    │
│                              │                                    │
│  ┌───────────────────────────┴───────────────────────────────┐   │
│  │                    Flow Execution Engine                   │   │
│  │              (Conclave core, multi-tenant)                │   │
│  │                                                           │   │
│  │  - Runs flows with user's API keys or our pool           │   │
│  │  - Stores results in user's workspace                     │   │
│  │  - Handles rate limiting, retries, errors                 │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                 │
├──────────────────────────────────────────────────────────────────┤
│  Users          │  Flows           │  Runs           │  Results  │
│  - API keys     │  - Config YAML   │  - Status       │  - Files  │
│  - Preferences  │  - Prompts       │  - Logs         │  - JSON   │
│  - Subscription │  - Metadata      │  - Cost         │           │
└──────────────────────────────────────────────────────────────────┘
```

---

## Key Pages / Features

### 1. Flow Studio (The Core Experience)

Chat interface where users design flows with Claude Code.

**User Journey:**
1. User clicks "Create New Flow"
2. Chat opens with Claude Code
3. User describes their use case
4. Claude Code proposes a flow structure
5. User refines through conversation
6. Claude Code generates and saves the flow
7. User can test with sample input

**Example Conversations:**

```
User: "I want to do security audits where multiple AI models
       review code and cross-check each other's findings"

Claude: "Great use case! I'll create a security audit flow:

         Pattern: Basic (Round-Robin)
         Why: Cross-validation works best when all models see
              each other's findings equally - no hierarchy.

         Structure:
         - Round 1: Independent security analysis
         - Round 2: Review peer findings, add missed issues
         - Round 3: Prioritize and consolidate

         Prompts I'll generate:
         - round_1: Focus on OWASP Top 10, injection, auth issues
         - refinement: Cross-reference peers, dispute or confirm

         Sound good? Or would you like to adjust?"
```

### 2. My Flows Dashboard

List of user's flows with:
- Name, description, type (basic/leading/custom)
- Last run date, run count
- Quick actions: Run, Edit, Duplicate, Delete

### 3. Run Flow

Execute a flow:
- Select input (paste text, upload file, or write inline)
- Choose which models to use
- Watch real-time progress
- View results when complete

### 4. Results Viewer

- Side-by-side model outputs
- Diff view between rounds
- Synthesis highlighting
- Export options (Markdown, PDF, JSON)

### 5. Templates Gallery

Pre-built flows users can start from:
- Security Audit
- Architecture Design (Leading)
- Brainstorming (Basic)
- Code Review
- Technical Writing
- Debate Mode

---

## Claude Agent SDK Integration

### Agent System Prompt

```
You are a Flow Architect for Conclave, a multi-LLM collaboration platform.

Your role is to help users design custom flows that orchestrate multiple AI
models to solve problems together. You have deep knowledge of:

- Flow patterns: basic (round-robin), leading (hub-and-spoke), custom
- When each pattern works best
- How to write effective prompts for multi-model collaboration
- Best practices for getting models to build on each other's work

You have access to tools to:
- Create and save flows to the user's account
- Validate flow configurations
- Run test executions with sample inputs
- Retrieve documentation and examples

When helping users:
1. Understand their use case first
2. Recommend an appropriate flow pattern with rationale
3. Propose a structure (rounds, prompts, model roles)
4. Iterate based on feedback
5. Generate and save the final flow

Be conversational but efficient. Show your reasoning.
```

### Agent Tools

```typescript
// Tool definitions for the Claude Agent SDK

const tools = [
  {
    name: "create_flow",
    description: "Create a new flow in the user's account",
    parameters: {
      name: "string - Flow name",
      description: "string - What this flow does",
      flow_type: "enum: basic | leading",
      max_rounds: "number - 2-6 typically",
      default_leader: "string? - For leading flows",
      prompts: {
        round_1: "string - Initial prompt",
        refinement: "string - Peer review prompt",
        leader_synthesis: "string? - For leading flows"
      }
    }
  },
  {
    name: "validate_flow",
    description: "Check a flow config for errors before saving",
    parameters: {
      config: "object - Flow configuration to validate"
    }
  },
  {
    name: "test_flow",
    description: "Run a test execution with sample input",
    parameters: {
      flow_id: "string - Flow to test",
      sample_input: "string - Test content",
      models: "string[] - Models to use"
    }
  },
  {
    name: "list_templates",
    description: "Get available flow templates for inspiration"
  },
  {
    name: "get_user_flows",
    description: "List the user's existing flows"
  }
];
```

---

## Business Model Considerations

### Pricing Tiers

| Tier | Price | Includes |
|------|-------|----------|
| Free | $0 | 5 flows, 10 runs/month, bring your own API keys |
| Pro | $29/mo | Unlimited flows, 100 runs/month, priority support |
| Team | $99/mo | Collaboration, shared flows, 500 runs/month |
| Enterprise | Custom | Self-hosted, SSO, unlimited |

### API Key Models

1. **BYOK (Bring Your Own Keys)** - User provides their API keys
2. **Pooled** - We provide API access, charge per-token usage
3. **Hybrid** - User keys for some providers, pooled for others

---

## Technical Decisions to Make

### 1. Agent SDK Hosting

**Option A: Single EC2 with Agent SDK**
- One Claude Code instance handles all users
- Simpler, cheaper to start
- Context isolation via conversation sessions

**Option B: Per-User Agent Instances**
- Dedicated agent per user session
- Better isolation, more expensive
- Could use ECS/Fargate for scaling

**Recommendation:** Start with Option A, partition by user context.

### 2. Flow Execution

**Option A: Run in Browser (Client-Side)**
- User's API keys never touch our servers
- Limited to what browser can do
- Can't do long-running flows

**Option B: Run on Server**
- Better reliability, can handle long flows
- Need to securely store user API keys
- More infrastructure

**Option C: Hybrid**
- Agent design happens on server (Claude SDK)
- Execution can be client or server based on preference

**Recommendation:** Start with server-side, offer BYOK option.

### 3. Frontend Framework

- **Next.js** - Good for this: SSR, API routes, Vercel deployment
- React + Vite if we want more control

### 4. Database

- **PostgreSQL** - Users, flows, runs metadata
- **S3** - Flow outputs, large results
- **Redis** - Session state, rate limiting

---

## MVP Scope

### Phase 1: Core Flow Studio

- [ ] User auth (Clerk or Auth0)
- [ ] Chat UI connected to Claude Agent SDK
- [ ] Agent can create/save flows
- [ ] Basic flow execution (bring your own keys)
- [ ] Results viewer

### Phase 2: Polish + Templates

- [ ] Template gallery
- [ ] Flow editing (modify existing flows)
- [ ] Better results visualization
- [ ] Export options

### Phase 3: Collaboration + Scale

- [ ] Team workspaces
- [ ] Shared flow library
- [ ] Usage analytics
- [ ] Pooled API keys option

---

## Open Questions

1. **Naming**: Is "Conclave" the right name for the SaaS? Or should it be distinct?

2. **Model Selection**: Do users pick models per-flow, or do we recommend?

3. **Real-time Streaming**: Should we stream model responses during execution?

4. **Custom Flow Logic**: How far do we let users customize beyond config?
   - Just prompts and settings?
   - Or let Claude Code generate actual code?

5. **Competitive Positioning**: How do we differentiate from:
   - LangChain/LangGraph (dev-focused)
   - ChatGPT/Claude direct (single model)
   - Poe (multi-model but not collaborative)

---

## Next Steps

1. **Validate the core loop**: Build a minimal chat UI → Agent SDK → flow creation
2. **User research**: Would people pay for this? What use cases resonate?
3. **Technical spike**: Test Agent SDK hosting, latency, costs
4. **Design**: Wireframes for Flow Studio experience

