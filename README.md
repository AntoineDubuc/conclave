# Janus

**Multi-LLM collaboration CLI that harvests unique insights from each model.**

Janus orchestrates structured conversations between AI models (Claude, GPT, Gemini, Grok) to produce better results than any single model alone. Each model brings its own perspective, critiques peers, and refines its thinking across multiple rounds.

## Why Janus?

Different AI models have different strengths, biases, and blind spots. Janus leverages this diversity:

- **Claude** excels at nuanced reasoning and safety considerations
- **GPT** brings broad knowledge and creative problem-solving
- **Gemini** offers strong analytical and multimodal capabilities
- **Grok** provides real-time knowledge and unique perspectives

By having them collaborate, you get solutions that are more robust, creative, and thoroughly vetted.

## How It Works

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

## Quick Start

### Python (Recommended)

```bash
cd python
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -e .

# Set up API keys
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GEMINI_API_KEY="..."
export XAI_API_KEY="..."  # For Grok

# Run your first collaboration
janus run basic-ideator your-idea.md
```

### TypeScript

```bash
cd typescript
npm install
npm run build
npm link

janus run basic-ideator your-idea.md
```

## Available Flows

| Flow | Type | Description |
|------|------|-------------|
| `basic-ideator` | Democratic | Round-robin: all models brainstorm, then refine based on peer feedback |
| `leading-ideator` | Hub-spoke | One model leads and synthesizes contributions from others |
| `audit` | Democratic | Security-focused code review with cross-validation |

## CLI Commands

```bash
janus list                          # Show available flows
janus run <flow> <file.md>          # Run a flow on input
janus run leading-ideator input.md --leader openai  # Specify leader
janus doctor                        # Check provider connectivity
janus models                        # Configure AI models
janus new-flow                      # Create a custom flow
janus auth-claude                   # Manage Claude CLI auth
```

## Configuration

Janus uses `janus.config.yaml` in your project directory:

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

## Project Structure

```
.
├── python/          # Python implementation (recommended)
├── typescript/      # TypeScript/Node.js implementation
├── GETTING_STARTED.md  # Newbie tutorial
└── README.md        # This file
```

## Authentication Options

### API Keys (Default)
Set environment variables for each provider you want to use.

### Claude CLI (Subscription Mode)
If you have a Claude Pro/Max subscription, Janus can use the Claude CLI instead of API keys:

```bash
npm i -g @anthropic-ai/claude-code
claude  # Authenticate once
janus auth-claude  # Verify status
```

## Use Cases

- **Architecture Planning**: Get multiple perspectives on system design
- **Code Review**: Cross-validate security and quality findings
- **Creative Brainstorming**: Harvest diverse ideas and synthesize the best
- **Technical Writing**: Multiple models critique and improve documentation
- **Problem Solving**: Approach complex problems from multiple angles

## License

MIT
