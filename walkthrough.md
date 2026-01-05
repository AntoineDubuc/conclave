# Janus CLI Walkthrough

This guide walks you through using **Janus**, your AI War Room.

## 1. Installation

Install and link the CLI globally:

```bash
cd janus
npm install
npm run build
npm link
```

Verify installation:

```bash
janus --help
```

## 2. First Run - Setup Wizard

On first run, Janus automatically launches the setup wizard:

```bash
janus
```

The wizard will:

```
     ██╗ █████╗ ███╗   ██╗██╗   ██╗███████╗
     ██║██╔══██╗████╗  ██║██║   ██║██╔════╝
     ██║███████║██╔██╗ ██║██║   ██║███████╗
██   ██║██╔══██║██║╚██╗██║██║   ██║╚════██║
╚█████╔╝██║  ██║██║ ╚████║╚██████╔╝███████║
 ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚══════╝

Welcome to Janus - The AI War Room

Discovering available AI providers...

Anthropic (Claude)
  ✓ Claude Code CLI installed (v2.0.76)
  ✓ Logged in via Max subscription
  → Ready! Using your subscription (no API charges)

OpenAI (GPT)
  ✗ OPENAI_API_KEY not found
  → [Enter key] or [Skip]

Google Gemini
  ✗ GEMINI_API_KEY not found
  → [Enter key] or [Skip] (free tier available!)
```

### Authentication Options

**For Claude (Anthropic):**
- If you have Claude Code CLI installed and logged in, Janus uses your subscription automatically
- No API key needed for Pro/Max subscribers!
- Alternatively, set `ANTHROPIC_API_KEY` in your `.env` file

**For OpenAI & Gemini:**
- Add API keys to `.env` file or enter them in the wizard

## 3. Check Provider Status

Verify your providers are working:

```bash
janus doctor
```

Example output:

```
🏥 Janus Health Check

Discovering providers...

Anthropic (Claude)
  ✓ Using Claude CLI v2.0.76 (subscription)
    → Using your subscription (no API charges)

OpenAI (GPT)
  ✓ API key configured

Google Gemini
  ✓ API key configured

--- Connection Tests ---

✔ Anthropic (CLI): Connected (Subscription)
✔ OpenAI: Connected (API Key)
✔ Gemini: Connected (API Key)

--- Summary ---

✓ 3 providers ready. Janus is operational!
```

## 4. Running a Debate

Create a markdown file with your rough idea:

```bash
cat > idea.md << 'EOF'
# App Idea: Coffee Tracker

I want a mobile app that:
- Tracks my daily caffeine intake
- Warns me if I drink too much
- Shows trends over time
EOF
```

Run the debate:

```bash
janus run ideation idea.md
```

Output:

```
Starting Flow: Ideation (Run ID: a1b2c3d4)
Output Directory: .janus/runs/a1b2c3d4

ℹ Using Claude CLI (subscription mode)
⠋ Round 1: Divergence (Brainstorming)
✔ Round 1 Complete
⠋ Round 2: Convergence (Refinement)
✔ Round 2 Complete

Flow Complete!
Explore the results in: .janus/runs/a1b2c3d4
```

## 5. Exploring Results

Check the output files:

```bash
ls .janus/runs/a1b2c3d4/
```

```
anthropic (cli).v1.md   # Claude's initial plan
openai.v1.md            # OpenAI's initial plan
gemini.v1.md            # Gemini's initial plan
anthropic (cli).v2.md   # Claude's refined plan (after seeing peers)
openai.v2.md            # OpenAI's refined plan
gemini.v2.md            # Gemini's refined plan
```

The `.v2.md` files contain the battle-tested, peer-reviewed plans.

## 6. Creating Custom Flows

Create your own debate workflows:

```bash
janus new-flow
```

Example: Create a "security-audit" flow:

```
? What would you like to name this flow? security-audit
? Enter the Round 1 prompt: You are a senior security engineer. Analyze this code for vulnerabilities, injection risks, and authentication flaws.
? How many rounds of refinement? 2
? Enter the refinement prompt: Review the other auditors' findings. Did you miss anything? Verify their claims and create a unified report.
```

Run your new flow:

```bash
janus run security-audit src/auth.ts
```

## 7. Available Commands

| Command | Description |
|---------|-------------|
| `janus` | Setup wizard (first run) or help |
| `janus init` | Re-run setup wizard |
| `janus run <flow> <file>` | Run a debate |
| `janus new-flow` | Create custom flow |
| `janus list` | Show available flows |
| `janus delete-flow <name>` | Remove a flow |
| `janus doctor` | Health check |
| `janus models` | Configure models |
| `janus auth-claude` | Claude CLI auth management |

## 8. Configuration Files

Janus looks for config in this order:
1. `./janus.config.yaml` (project-level)
2. `~/.janus/config.yaml` (global)

### Setting Auth Method

In your config, you can explicitly set how Anthropic authenticates:

```yaml
providers:
  anthropic:
    type: anthropic
    model: claude-sonnet-4-5-20250929
    auth_method: cli  # Use Claude CLI (subscription)
```

Options:
- `cli` - Use Claude Code CLI with your Pro/Max subscription
- `api_key` - Use ANTHROPIC_API_KEY environment variable
- `auto` - Try API key first, fall back to CLI (default)

## 9. Tips

- **Use subscription mode**: If you have Claude Pro/Max, the CLI auth saves money
- **Start with 2 rounds**: More rounds = more refinement, but also more API calls
- **Review all versions**: Sometimes v1 has ideas that get lost in convergence
- **Custom prompts matter**: A good Round 1 prompt sets the tone for the entire debate
