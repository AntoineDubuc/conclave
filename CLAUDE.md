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
janus                     # First-run setup wizard (or --help)
janus init                # Re-run the setup wizard
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

- **index.ts**: CLI entry point using Commander.js. Defines all subcommands. Auto-triggers init wizard on first run.
- **core/engine.ts**: `FlowEngine` - orchestrates the debate loop (divergence → convergence rounds). Runs all providers in parallel for each round.
- **core/config.ts**: `ConfigManager` - loads/saves `janus.config.yaml`, manages flows.
- **core/types.ts**: Zod schemas for config validation (`JanusConfigSchema`, `FlowSchema`, `ProviderConfigSchema`).
- **core/claude-cli.ts**: Claude CLI detection, authentication checking, and login prompts.
- **core/provider-discovery.ts**: Discovers available providers and their auth status.

### Provider Layer (`janus/src/providers/`)

- **base.ts**: `Provider` interface - all providers implement `generate(prompt, options)`.
- **factory.ts**: `ProviderFactory.createProviders()` - instantiates providers based on config. Respects `auth_method` setting.
- **anthropic.ts**, **openai.ts**, **gemini.ts**: Direct API provider implementations.
- **claude_binary.ts**: Spawns the `claude` CLI binary as a provider (uses existing Claude Code subscription auth).

### Commands (`janus/src/commands/`)

- **init.ts**: First-run onboarding wizard. Discovers providers, guides auth setup.
- **doctor.ts**: Health check with provider discovery and connection tests.
- **new-flow.ts**: Interactive flow creation wizard.
- **models.ts**: Model configuration management.
- **auth-claude.ts**: Claude CLI authentication management.

### Flow Execution Pattern

1. **Round 1 (Divergence)**: Input file + round_1 prompt sent to all providers in parallel
2. **Rounds 2..N (Convergence)**: Each provider receives its previous output + peer outputs with refinement prompt
3. Outputs saved to `.janus/runs/<run_id>/<provider>.v<round>.md`

## Configuration

- **janus.config.yaml**: Defines `active_providers`, provider configs (type, model, auth_method, api_key/base_url), and flows
- **.env**: API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`)
- Flows define: `max_rounds`, `prompts.round_1`, `prompts.refinement`

### Anthropic auth_method Options

- `cli`: Use Claude Code CLI with Pro/Max subscription (no API charges)
- `api_key`: Use ANTHROPIC_API_KEY environment variable
- `auto`: Try API key first, fall back to CLI (default)

## Key Design Patterns

- Providers are instantiated at runtime based on `active_providers` list
- OpenAI provider reused for `openai_compatible` endpoints (Grok, Ollama)
- Claude CLI provider enables subscription-based auth for Max plan users
- Graceful degradation: if a provider fails, others continue
- All inter-model communication happens via file outputs passed as context
