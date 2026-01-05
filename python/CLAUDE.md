# Conclave (Python)

Multi-LLM collaboration CLI. Harvests unique insights from each model through structured flows.

## Architecture

```
conclave/
├── __init__.py
├── cli.py                   # CLI entry point (Click)
├── core/
│   ├── types.py             # Pydantic models for config
│   └── config.py            # Config management
├── providers/
│   ├── base.py              # Provider ABC
│   ├── factory.py           # Provider factory
│   ├── anthropic.py         # Anthropic API
│   ├── openai.py            # OpenAI API
│   ├── gemini.py            # Google Gemini API
│   └── claude_cli.py        # Claude CLI wrapper
├── flows/
│   ├── __init__.py          # Flow registry
│   ├── basic/               # Round-robin flow
│   │   ├── __init__.py
│   │   ├── engine.py
│   │   ├── prompts.py
│   │   ├── round-1.md
│   │   └── refinement.md
│   └── leading/             # Hub-and-spoke flow
│       ├── __init__.py
│       ├── engine.py
│       ├── prompts.py
│       ├── round-1.md
│       ├── refinement.md
│       └── leader-synthesis.md
└── utils/
    ├── output.py            # File output utilities
    └── prompts.py           # Prompt resolution
```

## Installation

```bash
cd /path/to/python
pip install -e .
```

## Usage

```bash
conclave run basic-ideator input.md
conclave run leading-ideator input.md --leader openai
conclave list
conclave doctor
```

## Adding a New Flow

1. Create `conclave/flows/your-flow/`
2. Add:
   - `engine.py` - Orchestration logic
   - `prompts.py` - Prompt loader
   - `*.md` - Markdown prompt files
   - `__init__.py` - Export Engine + metadata
3. Register in `conclave/flows/__init__.py`

## Configuration

Config: `./conclave.config.yaml`

```yaml
active_providers:
  - anthropic
  - openai
  - gemini
providers:
  anthropic:
    type: anthropic
    model: claude-opus-4-5-20251101
flows:
  my-flow:
    flow_type: basic
    max_rounds: 3
    prompts:
      round_1: "..."
      refinement: "..."
```
