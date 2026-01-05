# Janus: Implementation Plan & Product Requirements

## 1. Executive Summary
**Janus** (formerly "Council") is a CLI-based orchestration tool that leverages multiple LLMs (Claude, OpenAI, Gemini) to "debate" and refine conceptual ideas. It moves the user's manual workflow of copy-pasting between agents into an automated, configurable "War Room" environment.

**Core Value Proposition**:
- **Divergence**: Get unique perspectives from 3 distinct models simultaneously.
- **Convergence**: Automate the cross-pollination of ideas (peer review) to produce superior final plans.
- **Traceability**: Maintain a perfect history of how an idea evolved from V1 to VN.

## 2. Architecture Overview
- **Interface**: Node.js CLI (`janus`)
- **Language**: TypeScript
- **State Management**: Local Filesystem (Markdowns + `.janus/` session folders)
- **Authentication**: Provider-agnostic (Environment Variables + Local Config)

### System Components
1.  **The Wizard**: Interactive CLI for defining and configuring new "Flows".
2.  **The Engine**: The logic that runs the generation/critique loops.
3.  **The Adapters**: Standardized interface for talking to Anthropic, OpenAI, Gemini, and generic OpenAI-compatible endpoints (Grok, Ollama).

## 3. Product Features & Configuration

### 3.1 Authentication Strategy
The system minimizes cost by attempting to reuse existing access where possible, but relies on standard API keys for stability.
- **Anthropic**: `ANTHROPIC_API_KEY` or `~/.claude/` session (experimental).
- **OpenAI**: `OPENAI_API_KEY`.
- **Gemini**: `GEMINI_API_KEY` (Free Tier recommended for reasoning).
- **Custom**: `janus config set provider.grok.key ...`

### 3.2 The "Flow" Concept
A **Flow** is a named, repeatable reasoning process. Users define Flows via the Wizard.
**Configuration Schema (`~/.janus/flows.yaml`)**:
```yaml
flows:
  ideation:
    max_rounds: 3
    prompts:
      round_1: "Flesh out this idea..."
      round_2: "Critique the other models..."
      round_3: "Final polish..."
```

### 3.3 The "Lens" Mechanic (Advanced)
A **Lens** is a filter applied to a run to enforce a specific persona or constraint.
- **Example**: `--lens security` injects specific system prompts about security auditing.
- **Example**: `--lens pm` forces the model to act as a rigorous Product Manager.

## 4. Execution Logic (The "Track")

When a user runs `janus run ideation my_idea.md`, the following sequence occurs:

### Round 1: Divergence
- **Input**: User's `my_idea.md` + Round 1 Prompt.
- **Action**: Sent to Model A, B, C in parallel.
- **Output**: `claude.v1.md`, `openai.v1.md`, `gemini.v1.md`.

### Round 2..N: Convergence Loop
- **Context**: Model A is given `[openai.v(N-1).md, gemini.v(N-1).md]`.
- **Input**: Round N Prompt (e.g., "Review these peers and update your plan").
- **Action**: Model A generates a new version incorporating peer feedback.
- **Output**: `claude.vN.md`.

### Final Synthesis
- **Action**: (Optional) A "Judge" model merges the final Nth versions into a single `my_idea.final.md`.

## 5. Technical Implementation Steps

### Phase 1: Scaffolding
- [ ] Initialize `janus` Node.js project (TypeScript, ESLint).
- [ ] Install core deps: `commander`, `inquirer`, `zod` (config validation).
- [ ] Create folder structure: `src/core`, `src/providers`, `src/commands`.

### Phase 2: The Adapters & Auth
- [ ] Implement `Provider` interface.
- [ ] Build `AntropicProvider`, `OpenAIProvider`, `GeminiProvider`.
- [ ] Build key-loading logic (Dotenv + System Keychain).

### Phase 3: The Engine
- [ ] Implement `FlowRunner` class.
- [ ] Implement `DebateLoop` logic (The V1->V2 state machine).
- [ ] Implement File I/O (saving to `.janus/run-id/`).

### Phase 4: The CLI
- [ ] `janus init`: Setup API keys.
- [ ] `janus new-flow`: The Wizard.
- [ ] `janus run <flow> <file>`: The Main trigger.
