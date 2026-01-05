# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Janus is a CLI tool that orchestrates multi-LLM collaboration sessions. It gets multiple AI models (Claude, GPT, Gemini, Grok) to brainstorm, critique each other's work, and converge on refined solutions. The goal is to harvest unique insights from each model.

## Repository Structure

```
.
├── python/          # Python implementation (recommended)
├── typescript/      # TypeScript/Node.js implementation
├── README.md        # Project overview
├── GETTING_STARTED.md  # Newbie tutorial
└── CLAUDE.md        # This file
```

Both implementations have identical functionality and CLI interfaces.

## CLI Commands (Both Versions)

```bash
janus run <flow> <file>   # Run a flow on input markdown
janus list                # List available flows
janus doctor              # Check provider connectivity
janus models              # Configure AI models
janus new-flow            # Create a custom flow
janus delete-flow <name>  # Delete a flow
janus auth-claude         # Manage Claude CLI auth
janus init                # Initialize configuration
```

## Architecture (Shared Concepts)

### Core Components

- **CLI Entry**: Click (Python) / Commander.js (TypeScript)
- **Config Manager**: Loads/saves `janus.config.yaml`, manages flows
- **Provider Factory**: Creates provider instances based on config
- **Flow Engine**: Orchestrates rounds of LLM collaboration

### Provider Layer

All providers implement a `generate(prompt, options)` interface:

| Provider | Type | API |
|----------|------|-----|
| Anthropic | Direct API | anthropic SDK |
| OpenAI | Direct API | openai SDK |
| Gemini | Direct API | google-genai SDK |
| Grok | OpenAI-compatible | openai SDK with custom base_url |
| Claude CLI | CLI wrapper | Spawns `claude` binary |

### Flow Types

1. **Basic (Round-Robin Democratic)**
   - All models respond independently in Round 1
   - Each model sees all peer outputs in subsequent rounds
   - Everyone refines based on collective feedback

2. **Leading (Hub-and-Spoke)**
   - One model designated as "leader"
   - Others contribute ideas
   - Leader synthesizes into unified vision

### Flow Execution Pattern

```
Round 1 (Divergence):
  Input + round_1_prompt → [All providers in parallel] → Individual responses

Round 2..N (Convergence):
  Previous output + peer outputs + refinement_prompt → Refined responses

Output:
  .janus/runs/<run_id>/<provider>.v<round>.md
```

## Python Implementation (`python/`)

### Key Files

```
python/janus/
├── cli.py              # Click-based CLI
├── core/
│   ├── types.py        # Pydantic models
│   └── config.py       # ConfigManager
├── providers/
│   ├── base.py         # Provider ABC
│   ├── factory.py      # Provider factory
│   ├── anthropic.py
│   ├── openai.py
│   ├── gemini.py
│   ├── grok.py
│   └── claude_cli.py
├── flows/
│   ├── __init__.py     # Flow registry
│   ├── basic/          # Basic flow engine + prompts
│   └── leading/        # Leading flow engine + prompts
└── utils/
    ├── output.py
    └── prompts.py
```

### Development Commands

```bash
cd python
python -m venv venv
source venv/bin/activate
pip install -e .
janus --help
```

## TypeScript Implementation (`typescript/`)

### Key Files

```
typescript/src/
├── index.ts            # Commander.js CLI
├── core/
│   ├── types.ts        # Zod schemas
│   ├── config.ts       # ConfigManager
│   └── claude-cli.ts
├── providers/
│   ├── base.ts
│   ├── factory.ts
│   ├── anthropic.ts
│   ├── openai.ts
│   ├── gemini.ts
│   └── claude_binary.ts
├── flows/
│   ├── index.ts        # Flow registry
│   ├── basic/
│   └── leading/
└── commands/
    ├── init.ts
    ├── doctor.ts
    └── ...
```

### Development Commands

```bash
cd typescript
npm install
npm run build
npm run dev        # ts-node for development
npm link           # Global CLI access
```

## Configuration

### janus.config.yaml

```yaml
active_providers:
  - anthropic
  - openai
  - gemini
  - grok

providers:
  anthropic:
    type: anthropic
    model: claude-opus-4-5-20251101
    auth_method: auto  # auto | api_key | cli
  openai:
    type: openai
    model: gpt-5.2
  gemini:
    type: gemini
    model: gemini-2.0-flash
  grok:
    type: grok
    model: grok-4
    base_url: https://api.x.ai/v1

flows:
  custom-flow:
    flow_type: basic  # basic | leading
    max_rounds: 3
    default_leader: anthropic  # For leading flows
    prompts:
      round_1: "..."
      refinement: "..."
      leader_synthesis: "..."  # For leading flows
```

### Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...
XAI_API_KEY=xai-...
```

## Key Design Patterns

1. **Provider abstraction**: All providers share common interface
2. **Flow self-containment**: Each flow is a folder with engine + prompts
3. **Graceful degradation**: Failed providers don't block others
4. **Parallel execution**: All providers run concurrently per round
5. **File-based communication**: Inter-model context via output files
6. **Markdown prompts**: Prompts stored as .md files for easy editing

## Adding a New Provider

1. Create `providers/<name>.py` or `.ts`
2. Implement `Provider` interface with `generate()` method
3. Add to `ProviderType` enum in types
4. Add case in `factory.py`/`factory.ts`
5. Add default config in `DEFAULT_CONFIG`

## Adding a New Flow

1. Create `flows/<name>/` directory
2. Add `engine.py`/`engine.ts` with flow logic
3. Add prompt files (`*.md`)
4. Add `prompts.py`/`prompts.ts` to load them
5. Register in `flows/__init__.py` or `flows/index.ts`
