# Janus 🎭
**The AI War Room - Orchestration for Multi-Agent Debate**

Janus is a CLI tool that automates the "Council of Experts" reasoning pattern. Instead of manually copying prompts between Claude, ChatGPT, and Gemini, Janus orchestrates a debate between them to refine your ideas, audit your code, or plan your architecture.

## Quick Start

### 1. Installation

```bash
cd janus
npm install
npm run build
npm link
```

### 2. First Run - Setup Wizard

Simply run `janus` and the setup wizard will guide you:

```bash
janus
```

The wizard will:
- Detect your Claude Code CLI (if installed) and use your Pro/Max subscription
- Prompt for OpenAI and Gemini API keys (or skip them)
- Configure your providers automatically

### 3. Run Your First Debate

Create a file with your idea:

```bash
echo "I want to build a mobile app that tracks coffee intake and warns about overconsumption." > idea.md
```

Run the debate:

```bash
janus run ideation idea.md
```

Results appear in `.janus/runs/<run_id>/`:
- `claude.v1.md`, `openai.v1.md`, `gemini.v1.md` (Round 1: Divergence)
- `claude.v2.md`, etc. (Round 2+: Convergence)

---

## Authentication

Janus supports multiple authentication methods:

### Claude (Anthropic)

**Option A: Use your Claude Pro/Max subscription (Recommended)**

If you have Claude Code CLI installed and logged in:

```bash
# Install Claude Code CLI (if not already installed)
npm install -g @anthropic-ai/claude-code

# Login to your account
claude

# Janus will automatically detect and use your subscription
janus doctor
```

**Option B: Use an API key**

```bash
# Add to your .env file
ANTHROPIC_API_KEY=sk-ant-...
```

### OpenAI

```bash
OPENAI_API_KEY=sk-...
```

### Google Gemini

```bash
GEMINI_API_KEY=...
```

Get a free API key at https://aistudio.google.com/apikey

---

## Commands

| Command | Description |
|---------|-------------|
| `janus` | Run setup wizard (first run) or show help |
| `janus init` | Re-run the setup wizard |
| `janus run <flow> <file>` | Run a debate flow on an input file |
| `janus new-flow` | Create a new custom flow |
| `janus list` | List available flows |
| `janus doctor` | Check provider health and connectivity |
| `janus models` | List and configure active models |
| `janus auth-claude` | Manage Claude CLI authentication |

---

## Flows

Janus comes with two built-in flows:

### `ideation`
Refine a rough idea into a detailed plan through multi-model debate.

```bash
janus run ideation my_idea.md
```

### `audit`
Security audit a piece of code with multiple AI reviewers.

```bash
janus run audit src/auth.ts
```

### Create Custom Flows

```bash
janus new-flow
```

The wizard will ask for:
1. **Name**: e.g., `ux-review`
2. **Round 1 Prompt**: Initial instruction for all models
3. **Rounds**: Number of refinement iterations
4. **Refinement Prompt**: How models should critique peers

---

## Configuration

### Config File Locations

1. **Project-level**: `./janus.config.yaml` (takes priority)
2. **Global**: `~/.janus/config.yaml`

### Example Config

```yaml
active_providers:
  - anthropic
  - openai
  - gemini

providers:
  anthropic:
    type: anthropic
    model: claude-sonnet-4-5-20250929
    auth_method: cli  # or 'api_key' or 'auto'
  openai:
    type: openai
    model: gpt-4o
  gemini:
    type: gemini
    model: gemini-1.5-pro

flows:
  ideation:
    name: Ideation
    max_rounds: 3
    prompts:
      round_1: "Analyze this idea and create a comprehensive plan..."
      refinement: "Review your peers' work and improve your plan..."
```

### Auth Method Options

For the Anthropic provider, `auth_method` can be:
- `cli`: Use Claude Code CLI (subscription-based, no API charges)
- `api_key`: Use ANTHROPIC_API_KEY environment variable
- `auto`: Try API key first, fall back to CLI (default)

---

## How It Works

```
Round 1: Divergence
┌─────────┐     ┌─────────┐     ┌─────────┐
│  Claude │     │  OpenAI │     │  Gemini │
│   v1    │     │   v1    │     │   v1    │
└────┬────┘     └────┬────┘     └────┬────┘
     │               │               │
     └───────────────┼───────────────┘
                     │
Round 2+: Convergence (each model sees peers' work)
┌─────────┐     ┌─────────┐     ┌─────────┐
│  Claude │     │  OpenAI │     │  Gemini │
│   v2    │◄───►│   v2    │◄───►│   v2    │
└─────────┘     └─────────┘     └─────────┘
```

---

## Why "Janus"?

Janus is the Roman god of beginnings, gates, transitions, and duality. He is depicted with two faces - one looking to the past, one to the future.

Like Janus, this tool bridges your initial draft (past) with a refined, battle-tested plan (future) through the power of multiple perspectives.
