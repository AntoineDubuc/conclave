# Getting Started with Conclave

This tutorial will walk you through setting up Conclave and running your first multi-LLM collaboration session.

---

## Choose Your Platform

For detailed, platform-specific installation instructions, see:

| Platform | Guide |
|----------|-------|
| **macOS** | [Getting Started on macOS](docs/GETTING_STARTED_MACOS.md) |
| **Windows** | [Getting Started on Windows](docs/GETTING_STARTED_WINDOWS.md) |
| **Ubuntu/Debian** | [Getting Started on Ubuntu](docs/GETTING_STARTED_UBUNTU.md) |

The guides above include:
- Step-by-step installation for your OS
- Platform-specific troubleshooting
- Tips and shortcuts for your environment

**Continue below** for a general overview that works on any platform.

---

## What You'll Learn

1. Installing Conclave
2. Setting up authentication (API keys or Claude subscription)
3. Using Claude Code with your Max/Pro subscription (no API costs!)
4. Running your first flow
5. Understanding the output
6. Creating custom flows

## Prerequisites

- Python 3.10+ (for Python version) or Node.js 18+ (for TypeScript version)
- At least one of:
  - AI provider API key (OpenAI, Anthropic, Google, or xAI)
  - Claude Pro or Max subscription (use Claude without API costs)

---

## Step 1: Installation

### Option A: Python (Recommended)

```bash
# Clone or navigate to the project
cd conclave_cli/python

# Create a virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate  # macOS/Linux
# or
venv\Scripts\activate     # Windows

# Install Conclave
pip install -e .

# Verify installation
conclave --version
```

### Option B: TypeScript

```bash
cd conclave_cli
npm install
npm run build
npm link

conclave --version
```

---

## Step 2: Authentication Options

Conclave supports two ways to authenticate with AI providers:

| Method | Best For | Cost |
|--------|----------|------|
| **API Keys** | Pay-per-use, all providers | Usage-based billing |
| **Claude Code CLI** | Claude Pro/Max subscribers | Included in subscription |

You can mix both methods - for example, use your Claude subscription for Anthropic and API keys for OpenAI/Gemini.

---

## Step 3: Using Claude with Your Pro/Max Subscription (Recommended)

If you have a Claude Pro ($20/month) or Max ($100/month) subscription, you can use Claude in Conclave **without any additional API costs**. This works through Claude Code, Anthropic's official CLI tool.

### Why Use Claude Code?

- **No API charges** - Uses your existing subscription
- **Same models** - Access to Claude Opus, Sonnet, and Haiku
- **Auto-detection** - Conclave automatically uses CLI when available

### Step 3.1: Install Claude Code

```bash
# Install globally via npm
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

If you don't have npm/Node.js:
- **macOS**: `brew install node`
- **Windows**: Download from [nodejs.org](https://nodejs.org/)
- **Linux**: `sudo apt install nodejs npm` or equivalent

### Step 3.2: Authenticate Claude Code

Run Claude Code once to complete the authentication flow:

```bash
claude
```

This opens a browser window to authenticate with your Anthropic account:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   Welcome to Claude Code!                                │
│                                                          │
│   To get started, please authenticate:                   │
│                                                          │
│   Press Enter to open browser...                         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

1. Press Enter - your browser opens to claude.ai
2. Log in with your Anthropic account (the one with Pro/Max subscription)
3. Authorize Claude Code
4. Return to terminal - you should see a success message

### Step 3.3: Verify Claude Code Works

Test that Claude Code is responding:

```bash
claude -p "Say hello"
```

You should see Claude respond. If you get an error, see troubleshooting below.

### Step 3.4: Verify Conclave Detects Claude Code

Run the Conclave auth check:

```bash
conclave auth-claude
```

Expected output:

```
Claude Code Authentication Manager

Checking Claude Code status...
Claude CLI is accessible and responding.
```

### Step 3.5: How Auto-Detection Works

Conclave automatically chooses the best authentication method for Anthropic:

```
┌─────────────────────────────────────────────────────────────┐
│                    Conclave Auth Priority                      │
├─────────────────────────────────────────────────────────────┤
│ 1. ANTHROPIC_API_KEY environment variable (if set)         │
│    ↓ (if not set or placeholder)                           │
│ 2. Claude Code CLI (if installed and authenticated)        │
│    ↓ (if not available)                                    │
│ 3. Error - no authentication available                     │
└─────────────────────────────────────────────────────────────┘
```

To **force** Claude Code CLI even if you have an API key:

```yaml
# In conclave.config.yaml
providers:
  anthropic:
    type: anthropic
    model: claude-opus-4-5-20251101
    auth_method: cli  # Force CLI instead of auto
```

### Step 3.6: Check Everything with Doctor

Run the health check to see all providers:

```bash
conclave doctor
```

When Claude Code is working:

```
Using Claude CLI (subscription mode)

Provider Health Check:

  Checking Anthropic (CLI)... OK
  Checking OpenAI... OK
  Checking Gemini... OK
```

Notice it says **"Anthropic (CLI)"** - this confirms it's using your subscription, not API credits.

### Troubleshooting Claude Code

#### "Claude CLI not found"

The `claude` command isn't in your PATH:

```bash
# Check if installed
npm list -g @anthropic-ai/claude-code

# If not, install it
npm install -g @anthropic-ai/claude-code

# If installed but not found, check your PATH
which claude  # macOS/Linux
where claude  # Windows
```

#### "Claude CLI returned an error"

Authentication may have expired:

```bash
# Re-authenticate
claude

# Or check status
claude --version
```

#### "ANTHROPIC_API_KEY is present in environment"

You have both an API key and Claude Code. Conclave will use the API key by default. To use Claude Code instead:

```bash
# Option 1: Unset the API key temporarily
unset ANTHROPIC_API_KEY
conclave run basic-ideator my-idea.md

# Option 2: Force CLI in config
# Edit conclave.config.yaml:
# providers:
#   anthropic:
#     auth_method: cli
```

#### "Timeout" errors

Claude Code may be slow on first request. Increase timeout or try again:

```bash
# Test with a simple prompt
claude -p "hi"
```

---

## Step 4: Set Up API Keys (For Other Providers)

For providers other than Anthropic (or if you prefer API access), set up API keys:

### Get Your API Keys

| Provider | Get Key From | Environment Variable |
|----------|--------------|---------------------|
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) | `OPENAI_API_KEY` |
| Anthropic | [console.anthropic.com](https://console.anthropic.com/) | `ANTHROPIC_API_KEY` |
| Google Gemini | [aistudio.google.com](https://aistudio.google.com/apikey) | `GEMINI_API_KEY` |
| xAI (Grok) | [console.x.ai](https://console.x.ai/) | `XAI_API_KEY` |

### Set Environment Variables

**macOS/Linux** - Add to `~/.bashrc`, `~/.zshrc`, or create a `.env` file in your project:

```bash
# .env file (recommended for projects)
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...
XAI_API_KEY=xai-...
# Note: No ANTHROPIC_API_KEY if using Claude Code!
```

Or export directly:

```bash
export OPENAI_API_KEY="sk-..."
export GEMINI_API_KEY="AI..."
```

**Windows** - Use System Properties > Environment Variables, or in PowerShell:

```powershell
$env:OPENAI_API_KEY = "sk-..."
$env:GEMINI_API_KEY = "AI..."
```

### Verify All Providers

```bash
conclave doctor
```

```
Using Claude CLI (subscription mode)

Provider Health Check:

  Checking Anthropic (CLI)... OK
  Checking OpenAI... OK
  Checking Gemini... OK
  Checking Grok... OK
```

---

## Step 5: Your First Collaboration

### Create an Input File

Create a file called `my-idea.md`:

```markdown
# App Idea: Personal Finance Tracker

I want to build a mobile app that helps users track their spending habits.

Key features I'm considering:
- Connect to bank accounts
- Categorize transactions automatically
- Set budgets and get alerts
- Show spending trends over time

Questions I need help with:
1. What's the best tech stack for this?
2. How should I handle bank integrations securely?
3. What features should I prioritize for MVP?
```

### Run the Basic Ideator Flow

```bash
conclave run basic-ideator my-idea.md
```

### Watch the Magic Happen

```
--- Basic Flow (Round-Robin Democratic) ---
Pattern: All models respond independently, then refine based on peer feedback.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                      ROUND 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Anthropic (CLI)] Generating response...
[OpenAI] Generating response...
[Gemini] Generating response...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                      ROUND 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Anthropic (CLI)] Reviewing peers and refining...
[OpenAI] Reviewing peers and refining...
[Gemini] Reviewing peers and refining...

Output saved to: .conclave/runs/20250104_153022/
```

---

## Step 6: Understanding the Output

Conclave saves all outputs to `.conclave/runs/<timestamp>/`:

```
.conclave/runs/20250104_153022/
├── anthropic.v1.md    # Claude's Round 1 response
├── anthropic.v2.md    # Claude's refined response
├── openai.v1.md       # GPT's Round 1 response
├── openai.v2.md       # GPT's refined response
├── gemini.v1.md       # Gemini's Round 1 response
└── gemini.v2.md       # Gemini's refined response
```

### What to Look For

**Round 1 outputs** (`*.v1.md`): Each model's independent take on your problem. Look for:
- Different approaches and architectures
- Unique insights each model brings
- Varying priorities and trade-offs

**Round 2+ outputs** (`*.v2.md`, etc.): Refined responses after seeing peers. Look for:
- Acknowledgment of good ideas from other models
- Synthesis of multiple approaches
- More nuanced and complete solutions

---

## Step 7: Try Different Flows

### List Available Flows

```bash
conclave list
```

```
Available Flows:

  basic-ideator [Basic]
    All models brainstorm independently, then refine based on peer feedback.
    Rounds: 3

  leading-ideator [Leading] (default leader: anthropic)
    One model leads and synthesizes contributions from others.
    Rounds: 4

  audit [Basic]
    Security-focused code review with cross-validation.
    Rounds: 2
```

### Try the Leading Flow

The leading flow has one model act as the "architect" who synthesizes everyone's ideas:

```bash
conclave run leading-ideator my-idea.md --leader openai
```

### Try the Audit Flow

For code review, create a file with code to analyze:

```bash
conclave run audit my-code.md
```

---

## Step 8: Create a Custom Flow

### Interactive Wizard

```bash
conclave new-flow
```

```
--- Conclave Flow Wizard ---

Flow name (e.g., 'code-audit'): tech-debate
Description: Models debate technical decisions
Flow type: 1 (basic)
Max rounds: 4

Enter prompts:
Round 1 prompt: You are a senior engineer. Analyze this technical decision...
Refinement prompt: Review your peers' arguments. Update your position...

Flow 'tech-debate' saved successfully!
```

### Run Your Custom Flow

```bash
conclave run tech-debate decision.md
```

---

## Tips for Best Results

### Write Good Input Files

Be specific about what you want:

```markdown
# Good: Specific and actionable
Design a REST API for a todo app. Include:
- Endpoint structure
- Authentication approach
- Error handling strategy
- Rate limiting considerations

# Bad: Too vague
Make me an API
```

### Choose the Right Flow

| Scenario | Flow | Why |
|----------|------|-----|
| Brainstorming ideas | `basic-ideator` | Democratic, all voices equal |
| Need a unified plan | `leading-ideator` | Leader synthesizes into one vision |
| Security review | `audit` | Cross-validation catches more issues |

### Adjust Round Count

More rounds = more refinement, but diminishing returns after 3-4:

```yaml
# In conclave.config.yaml
flows:
  my-flow:
    max_rounds: 4  # Increase for complex problems
```

---

## Cost Comparison

Using Conclave with a typical 3-round flow on a medium-length document:

| Setup | Claude Cost | Other Providers |
|-------|-------------|-----------------|
| Claude Code (Pro/Max) | $0 (included) | API costs apply |
| Anthropic API | ~$0.50-2.00 per run | API costs apply |

If you run Conclave frequently, the Claude Pro subscription ($20/month) pays for itself after ~10-40 runs.

---

## Quick Reference: Auth Methods

```yaml
# conclave.config.yaml

providers:
  anthropic:
    type: anthropic
    model: claude-opus-4-5-20251101
    auth_method: auto      # Try API key, fall back to CLI (default)
    # auth_method: cli     # Force Claude Code CLI
    # auth_method: api_key # Force API key

  openai:
    type: openai
    model: gpt-5.2
    # Always uses OPENAI_API_KEY

  gemini:
    type: gemini
    model: gemini-2.0-flash
    # Always uses GEMINI_API_KEY

  grok:
    type: grok
    model: grok-4
    # Always uses XAI_API_KEY
```

---

## Common Issues

### "Provider X failed to generate response"

- Check your API key is set correctly
- Run `conclave doctor` to verify connectivity
- Check the provider's status page for outages

### "No providers configured"

Run `conclave init` to set up your first provider, or create `conclave.config.yaml`:

```yaml
active_providers:
  - anthropic

providers:
  anthropic:
    type: anthropic
    model: claude-opus-4-5-20251101
    auth_method: cli  # Use your subscription
```

### "Claude CLI not found"

See [Step 3: Using Claude with Your Pro/Max Subscription](#step-3-using-claude-with-your-promax-subscription-recommended) for full setup instructions.

---

## Next Steps

1. **Explore the outputs** - Read through `.conclave/runs/` to see how models interact
2. **Customize prompts** - Edit `conclave.config.yaml` to tune model behavior
3. **Add more providers** - The more diverse perspectives, the better results
4. **Create specialized flows** - Build flows for your specific use cases

---

## Getting Help

- Run `conclave --help` for command reference
- Check individual command help: `conclave run --help`
- Run `conclave auth-claude` to debug Claude Code issues
- Run `conclave doctor` to check all provider connectivity
- Review the README for architecture details

Happy collaborating!
