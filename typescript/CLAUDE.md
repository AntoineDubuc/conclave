# Janus

Multi-LLM collaboration CLI. Harvests unique insights from each model through structured flows.

## Architecture

```
src/
├── index.ts                 # CLI entry point (commander.js)
├── core/                    # Core infrastructure
│   ├── types.ts             # Zod schemas for config
│   ├── config.ts            # Local-first config management
│   ├── claude-cli.ts        # Claude CLI detection/auth
│   └── provider-discovery.ts
├── providers/               # LLM provider implementations
│   ├── base.ts              # Provider interface
│   ├── factory.ts           # Provider factory
│   ├── anthropic.ts         # Anthropic API
│   ├── openai.ts            # OpenAI API
│   ├── gemini.ts            # Google Gemini API
│   └── claude_binary.ts     # Claude CLI wrapper
├── flows/                   # Self-contained flow modules
│   ├── index.ts             # Flow registry
│   ├── basic/               # Round-robin flow
│   │   ├── index.ts         # Exports + metadata
│   │   ├── engine.ts        # Orchestration logic
│   │   ├── prompts.ts       # Default prompts
│   │   └── README.md        # Flow documentation
│   └── leading/             # Hub-and-spoke flow
│       ├── index.ts
│       ├── engine.ts
│       ├── prompts.ts
│       └── README.md
├── commands/                # CLI subcommands
│   ├── init.ts
│   ├── doctor.ts
│   ├── new-flow.ts
│   ├── models.ts
│   └── auth-claude.ts
└── utils/                   # Shared utilities (optional for flows)
    ├── index.ts
    ├── prompts.ts           # resolvePrompt()
    └── output.ts            # saveOutput(), createRunContext()
```

## Adding a New Flow

Each flow is a self-contained folder. To add a new flow:

1. Create `src/flows/your-flow/`
2. Add required files:
   - `engine.ts` - Your orchestration logic (no base class required)
   - `index.ts` - Export engine + metadata
   - `prompts.ts` - Default prompts (optional)
   - `README.md` - Documentation
3. Register in `src/flows/index.ts`

**Example `index.ts`:**
```typescript
export { YourFlowEngine as Engine } from './engine.js';
export { defaultPrompts } from './prompts.js';

export const metadata = {
    type: 'your-flow',
    displayName: 'Your Flow Name',
    description: 'What this flow does',
    pattern: 'Pattern Name',
    requiredConfig: [],  // e.g., ['default_leader']
};
```

**No forced inheritance.** Each flow can orchestrate however it wants. Use utils if helpful, or don't.

## Flow Types

| Type | Pattern | Description |
|------|---------|-------------|
| `basic` | Round-Robin | Democratic - everyone sees everyone's work |
| `leading` | Hub-and-Spoke | One leader synthesizes contributions |

## Configuration

Config: `./janus.config.yaml` (local to project)

```yaml
active_providers: [anthropic, openai, gemini]
providers:
  anthropic:
    type: anthropic
    model: claude-opus-4-5-20251101
    auth_method: auto  # cli | api_key | auto
flows:
  my-flow:
    flow_type: basic  # or 'leading'
    max_rounds: 3
    default_leader: anthropic  # for leading flows
    prompts:
      round_1: "..."
      refinement: "..."
      leader_synthesis: "..."  # leading flows only
```

## Commands

```bash
npx janus run <flow> <input.md>     # Run a flow
npx janus run flow input.md -l openai  # Specify leader
npx janus list                      # List flows
npx janus doctor                    # Check providers
npx janus init                      # Setup wizard
```

## Key Patterns

- **Local-first:** Config in `./janus.config.yaml`, outputs in `./.janus/runs/`
- **Composition over inheritance:** Flows use utils via import, not base class
- **Self-contained flows:** Each flow folder has everything it needs
- **Provider factory:** Auth method routing (CLI vs API key)
