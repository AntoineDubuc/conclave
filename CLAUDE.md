# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Janus is a CLI tool that orchestrates multi-LLM "debate" sessions. It automates the pattern of getting multiple AI models (Claude, OpenAI, Gemini) to brainstorm, critique each other's work, and converge on refined solutions.

## Build & Development Commands

```bash
cd janus
npm install         # Install dependencies
npm run build       # Compile TypeScript to dist/
npm run dev         # Run with ts-node (dev mode)
npm link            # Link globally to use `janus` command
```

## CLI Commands

```bash
janus run <flow> <file>   # Run a flow on an input markdown file
janus new-flow            # Interactive wizard to create a new flow
janus list                # List available flows
janus delete-flow <name>  # Delete a flow
janus doctor              # Check provider connectivity/auth
janus models              # List and configure active AI models
janus auth-claude         # Manage Claude Code CLI authentication
```

## Architecture

### Core Components (`janus/src/`)

- **index.ts**: CLI entry point using Commander.js. Defines all subcommands.
- **core/engine.ts**: `FlowEngine` - orchestrates the debate loop (divergence → convergence rounds). Runs all providers in parallel for each round.
- **core/config.ts**: `ConfigManager` - loads/saves `janus.config.yaml`, manages flows.
- **core/types.ts**: Zod schemas for config validation (`JanusConfigSchema`, `FlowSchema`, `ProviderConfigSchema`).

### Provider Layer (`janus/src/providers/`)

- **base.ts**: `Provider` interface - all providers implement `generate(prompt, options)`.
- **factory.ts**: `ProviderFactory.createProviders()` - instantiates providers based on config. Falls back to Claude CLI if no Anthropic API key.
- **anthropic.ts**, **openai.ts**, **gemini.ts**: Direct API provider implementations.
- **claude_binary.ts**: Spawns the `claude` CLI binary as a provider (uses existing Claude Code auth).

### Flow Execution Pattern

1. **Round 1 (Divergence)**: Input file + round_1 prompt sent to all providers in parallel
2. **Rounds 2..N (Convergence)**: Each provider receives its previous output + peer outputs with refinement prompt
3. Outputs saved to `.janus/runs/<run_id>/<provider>.v<round>.md`

## Configuration

- **janus.config.yaml**: Defines `active_providers`, provider configs (type, model, api_key/base_url), and flows
- **.env**: API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`)
- Flows define: `max_rounds`, `prompts.round_1`, `prompts.refinement`

## Key Design Patterns

- Providers are instantiated at runtime based on `active_providers` list
- OpenAI provider reused for `openai_compatible` endpoints (Grok, Ollama)
- Graceful degradation: if a provider fails, others continue
- All inter-model communication happens via file outputs passed as context
