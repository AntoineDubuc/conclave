# Getting Started with Conclave on macOS

This guide walks you through setting up Conclave on macOS (Intel or Apple Silicon).

---

## Prerequisites

- macOS 11 (Big Sur) or later
- Terminal access
- At least one of:
  - AI provider API key (OpenAI, Anthropic, Google, or xAI)
  - Claude Pro or Max subscription

---

## Step 1: Install Homebrew (if needed)

Homebrew is the easiest way to install dependencies on macOS.

```bash
# Check if Homebrew is installed
brew --version

# If not installed, install it:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

---

## Step 2: Install Python

```bash
# Install Python 3.11+ via Homebrew
brew install python@3.11

# Verify installation
python3 --version
# Should show: Python 3.11.x or higher
```

---

## Step 3: Install Node.js (for Claude Code)

Even if you use the Python version of Conclave, you need Node.js for Claude Code CLI.

```bash
# Install Node.js via Homebrew
brew install node

# Verify installation
node --version  # Should show v18+ or higher
npm --version
```

---

## Step 4: Install Conclave

```bash
# Navigate to the project
cd /path/to/conclave/python

# Create a virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate

# Your prompt should now show (venv)

# Install Conclave
pip install -e .

# Verify installation
conclave --version
```

**Tip**: Add this alias to your `~/.zshrc` for easy activation:

```bash
echo 'alias conclave-env="source /path/to/conclave/python/venv/bin/activate"' >> ~/.zshrc
source ~/.zshrc
```

---

## Step 5: Set Up Claude Code (Recommended)

If you have a Claude Pro ($20/month) or Max ($100/month) subscription, use Claude without API costs.

### 5.1: Install Claude Code

```bash
# Install globally
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

### 5.2: Authenticate

```bash
claude
```

This opens your default browser to authenticate:

1. Press Enter when prompted
2. Log in to claude.ai with your Anthropic account
3. Click "Authorize" to grant access
4. Return to Terminal - you'll see a success message

### 5.3: Verify It Works

```bash
# Quick test
claude -p "Say hello"

# Conclave verification
conclave auth-claude
```

Expected output:

```
Claude Code Authentication Manager

Checking Claude Code status...
Claude CLI is accessible and responding.
```

---

## Step 6: Set Up API Keys

Create a `.env` file in your project directory for API keys:

```bash
cd /path/to/your/project

# Create .env file
cat > .env << 'EOF'
# OpenAI
OPENAI_API_KEY=sk-...

# Google Gemini
GEMINI_API_KEY=AI...

# xAI Grok
XAI_API_KEY=xai-...

# Anthropic (only if NOT using Claude Code)
# ANTHROPIC_API_KEY=sk-ant-...
EOF
```

Or set them in your shell profile (`~/.zshrc`):

```bash
# Add to ~/.zshrc
export OPENAI_API_KEY="sk-..."
export GEMINI_API_KEY="AI..."
export XAI_API_KEY="xai-..."

# Reload
source ~/.zshrc
```

---

## Step 7: Verify Everything

```bash
# Make sure venv is activated
source /path/to/conclave/python/venv/bin/activate

# Run health check
conclave doctor
```

Expected output:

```
Using Claude CLI (subscription mode)

Provider Health Check:

  Checking Anthropic (CLI)... OK
  Checking OpenAI... OK
  Checking Gemini... OK
  Checking Grok... OK
```

---

## Step 8: Run Your First Flow

```bash
# Create a test file
cat > my-idea.md << 'EOF'
# App Idea: Habit Tracker

I want to build an app that helps people build good habits.

Features:
- Daily check-ins
- Streak tracking
- Reminders
- Progress visualization

Questions:
1. What tech stack should I use?
2. How do I keep users engaged?
EOF

# Run the collaboration
conclave run basic-ideator my-idea.md
```

---

## macOS-Specific Tips

### Using iTerm2

If you use iTerm2, you can create a profile for Conclave:
1. Preferences > Profiles > + (new profile)
2. Name: "Conclave"
3. Command: `/path/to/conclave/python/venv/bin/python -m conclave.cli`

### Spotlight Integration

Create a shell script for quick access:

```bash
# Create script
cat > /usr/local/bin/conclave-run << 'EOF'
#!/bin/bash
source /path/to/conclave/python/venv/bin/activate
conclave "$@"
EOF

chmod +x /usr/local/bin/conclave-run
```

### Keychain for API Keys

For secure API key storage, use macOS Keychain:

```bash
# Store a key
security add-generic-password -a "$USER" -s "OPENAI_API_KEY" -w "sk-..."

# Retrieve in scripts
export OPENAI_API_KEY=$(security find-generic-password -a "$USER" -s "OPENAI_API_KEY" -w)
```

---

## Troubleshooting

### "command not found: conclave"

The virtual environment isn't activated:

```bash
source /path/to/conclave/python/venv/bin/activate
```

### "command not found: claude"

Node.js binaries aren't in PATH:

```bash
# Check where npm installs global packages
npm config get prefix

# Add to PATH in ~/.zshrc
export PATH="$(npm config get prefix)/bin:$PATH"
source ~/.zshrc
```

### Python SSL Certificate Errors

Install certificates for Python:

```bash
/Applications/Python\ 3.11/Install\ Certificates.command
```

Or via pip:

```bash
pip install certifi
```

### "Permission denied" Installing Global Packages

Don't use `sudo` with npm. Fix permissions:

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc

# Now install Claude Code
npm install -g @anthropic-ai/claude-code
```

---

## Next Steps

- Read the [main tutorial](../GETTING_STARTED.md) for usage details
- Run `conclave list` to see available flows
- Run `conclave new-flow` to create custom flows
- Check `conclave --help` for all commands

Happy collaborating!
