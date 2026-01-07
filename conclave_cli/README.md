# Conclave

**Multi-LLM collaboration CLI that harvests unique insights from each model.**

Conclave orchestrates structured conversations between AI models (Claude, GPT, Gemini, Grok) to produce better results than any single model alone. Each model brings its own perspective, critiques peers, and refines its thinking across multiple rounds.

## Why Conclave?

Different AI models have different strengths, biases, and blind spots. Conclave leverages this diversity:

- **Claude** excels at nuanced reasoning and safety considerations
- **GPT** brings broad knowledge and creative problem-solving
- **Gemini** offers strong analytical and multimodal capabilities
- **Grok** provides real-time knowledge and unique perspectives

By having them collaborate, you get solutions that are more robust, creative, and thoroughly vetted.

## Features

| Feature | Description |
|---------|-------------|
| **Batch Flows** | Structured multi-round collaboration with file output |
| **Interactive Chat** | Real-time multi-LLM conversations with shared context |
| **@Mentions** | Target specific models in chat |
| **Multiple Flow Types** | Democratic (basic) or hierarchical (leading) patterns |

---

## Quick Start

### Python (Recommended)

```bash
cd conclave_cli/python
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -e .

# Set up API keys
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GEMINI_API_KEY="..."
export XAI_API_KEY="..."  # For Grok

# Run your first collaboration
conclave run basic-ideator your-idea.md

# Start an interactive chat
conclave chat
```

### TypeScript

```bash
cd conclave_cli
npm install
npm run build
npm link

conclave run basic-ideator your-idea.md
```

---

## Interactive Chat Room

Have real-time discussions with multiple AI models, all sharing context.

### How It Works

**Turn-based**: You send a message → All models respond → You send another → All respond again...

```
You:      "What's the best approach for caching?"
          ↓
Claude:   "Redis for distributed, LRU for single-node."
GPT:      "Agree. Consider cache invalidation strategy."
Gemini:   "Don't forget CDN caching for static assets."
          ↓
You:      "@anthropic elaborate on Redis"
          ↓
Claude:   "Redis offers pub/sub for invalidation..."
          (Only Claude responds - @mention targeting)
```

Each model sees the **full conversation history**, so they can reference and build on each other's responses.

### Usage

```bash
conclave chat                          # All active models
conclave chat -m anthropic -m openai   # Specific models
conclave chat -s my_session.json       # Resume session
```

### Chat Features

| Feature | Example |
|---------|---------|
| @mentions | `@anthropic what do you think?` - only that model responds |
| Expand responses | `/expand` - get detailed 500+ word answers |
| Save sessions | `/save my-brainstorm` - persist for later |
| Target models | `/ask openai` - single model response |

See the full [Chat Tutorial](docs/tutorials/CHAT_TUTORIAL.md) for more.

---

## Batch Flows

### How Flows Work

```
┌─────────────────────────────────────────────────────────────┐
│                         ROUND 1                             │
│   Input → [Claude] [GPT] [Gemini] [Grok] → Individual plans │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                         ROUND 2                             │
│   Each model sees all peer outputs, critiques, and refines  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                         ROUND N                             │
│   Convergence: Models synthesize best ideas from all        │
└─────────────────────────────────────────────────────────────┘
```

### Available Flows

| Flow | Type | Description |
|------|------|-------------|
| `basic-ideator` | Democratic | Round-robin: all models brainstorm, then refine based on peer feedback |
| `leading-ideator` | Hub-spoke | One model leads and synthesizes contributions from others |

### Tutorials

- [Basic Flow Tutorial](docs/tutorials/BASIC_FLOW_TUTORIAL.md) - Security audit use case
- [Leading Flow Tutorial](docs/tutorials/LEADING_FLOW_TUTORIAL.md) - Architecture design use case
- [Chat Tutorial](docs/tutorials/CHAT_TUTORIAL.md) - Feature brainstorming use case

---

## CLI Commands

```bash
# Flows
conclave list                          # Show available flows
conclave run <flow> <file.md>          # Run a flow on input
conclave run leading-ideator input.md --leader openai

# Chat
conclave chat                          # Start interactive chat
conclave chat -m anthropic -m openai   # Chat with specific models

# Management
conclave doctor                        # Check provider connectivity
conclave models                        # Configure AI models
conclave new-flow                      # Create a custom flow
conclave auth-claude                   # Manage Claude CLI auth
```

---

## Configuration

Conclave uses `conclave.config.yaml` in your project directory:

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
  openai:
    type: openai
    model: gpt-5.2
  gemini:
    type: gemini
    model: gemini-2.0-flash
  grok:
    type: grok
    model: grok-4

flows:
  my-custom-flow:
    flow_type: basic
    max_rounds: 3
    prompts:
      round_1: "Analyze this problem..."
      refinement: "Review peer feedback..."
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](GETTING_STARTED.md) | Installation and setup |
| [Chat Tutorial](docs/tutorials/CHAT_TUTORIAL.md) | Interactive chat room guide |
| [Basic Flow Tutorial](docs/tutorials/BASIC_FLOW_TUTORIAL.md) | Round-robin flow guide |
| [Leading Flow Tutorial](docs/tutorials/LEADING_FLOW_TUTORIAL.md) | Hub-and-spoke flow guide |
| [Chat Transcript Example](docs/CHAT_TRANSCRIPT_EXAMPLE.md) | Full example session |

### Platform-Specific Setup

- [macOS](docs/GETTING_STARTED_MACOS.md)
- [Windows](docs/GETTING_STARTED_WINDOWS.md)
- [Ubuntu](docs/GETTING_STARTED_UBUNTU.md)

---

## Project Structure

```
conclave_cli/
├── src/             # TypeScript source
├── python/          # Python implementation (recommended)
├── docs/            # Documentation and tutorials
├── package.json     # TypeScript dependencies
└── README.md        # This file
```

---

## Authentication Options

### API Keys (Default)
Set environment variables for each provider you want to use.

### Claude CLI (Subscription Mode)
If you have a Claude Pro/Max subscription, Conclave can use the Claude CLI instead of API keys:

```bash
npm i -g @anthropic-ai/claude-code
claude  # Authenticate once
conclave auth-claude  # Verify status
```

---

## Use Cases

| Use Case | Recommended Feature |
|----------|---------------------|
| Open-ended brainstorming | `conclave chat` |
| Architecture design | Leading flow with `--leader anthropic` |
| Security audit | Basic flow (cross-validation) |
| Code review | Chat or Basic flow |
| Technical writing | Leading flow |
| Problem solving | Chat for exploration, flow for depth |

---

## License

MIT
