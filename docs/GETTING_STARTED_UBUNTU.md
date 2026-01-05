# Getting Started with Conclave on Ubuntu/Debian

This guide walks you through setting up Conclave on Ubuntu 20.04+, Debian 11+, or other Debian-based distributions.

---

## Prerequisites

- Ubuntu 20.04+ or Debian 11+ (or derivatives like Linux Mint, Pop!_OS)
- Terminal access
- sudo privileges
- At least one of:
  - AI provider API key (OpenAI, Anthropic, Google, or xAI)
  - Claude Pro or Max subscription

---

## Step 1: Update System Packages

```bash
sudo apt update && sudo apt upgrade -y
```

---

## Step 2: Install Python

Ubuntu usually comes with Python, but you need Python 3.10+:

```bash
# Check current version
python3 --version

# If version is below 3.10, install newer Python
sudo apt install python3.11 python3.11-venv python3-pip -y

# Verify installation
python3.11 --version
```

**Note**: On Ubuntu 22.04+, the default Python 3 is usually 3.10+, so you can use `python3` directly.

---

## Step 3: Install Node.js

Node.js is required for Claude Code CLI. Use NodeSource for the latest LTS version:

```bash
# Install curl if not present
sudo apt install curl -y

# Add NodeSource repository (LTS version)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -

# Install Node.js
sudo apt install nodejs -y

# Verify installation
node --version  # Should show v18+ or higher
npm --version
```

### Alternative: Using nvm (Node Version Manager)

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell
source ~/.bashrc

# Install latest LTS
nvm install --lts

# Verify
node --version
```

---

## Step 4: Install Conclave

```bash
# Navigate to the project
cd /path/to/conclave/python

# Create a virtual environment
python3 -m venv venv
# Or if you installed Python 3.11 separately:
# python3.11 -m venv venv

# Activate it
source venv/bin/activate

# Your prompt should now show (venv)

# Upgrade pip
pip install --upgrade pip

# Install Conclave
pip install -e .

# Verify installation
conclave --version
```

**Tip**: Add an alias to your `~/.bashrc` for easy activation:

```bash
echo 'alias conclave-env="source /path/to/conclave/python/venv/bin/activate"' >> ~/.bashrc
source ~/.bashrc
```

---

## Step 5: Set Up Claude Code (Recommended)

If you have a Claude Pro ($20/month) or Max ($100/month) subscription, use Claude without API costs.

### 5.1: Install Claude Code

```bash
# Install globally (may need sudo depending on npm setup)
sudo npm install -g @anthropic-ai/claude-code

# Or without sudo if you've configured npm properly
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
4. Return to terminal - you'll see a success message

**Headless Server?** If you're on a server without a browser:

```bash
# Claude will print a URL - copy it
claude

# Open the URL on another device, authenticate,
# then paste the code back in the terminal
```

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

### Option A: Environment Variables in .bashrc (Persistent)

```bash
# Add to ~/.bashrc
cat >> ~/.bashrc << 'EOF'

# Conclave API Keys
export OPENAI_API_KEY="sk-..."
export GEMINI_API_KEY="AI..."
export XAI_API_KEY="xai-..."
# export ANTHROPIC_API_KEY="sk-ant-..."  # Only if NOT using Claude Code
EOF

# Reload
source ~/.bashrc
```

### Option B: .env File (Per Project)

Create a `.env` file in your project directory:

```bash
cat > .env << 'EOF'
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...
XAI_API_KEY=xai-...
EOF

# Secure the file
chmod 600 .env
```

### Option C: Using direnv (Auto-load per directory)

```bash
# Install direnv
sudo apt install direnv -y

# Add to ~/.bashrc
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
source ~/.bashrc

# Create .envrc in project directory
cd /path/to/your/project
cat > .envrc << 'EOF'
export OPENAI_API_KEY="sk-..."
export GEMINI_API_KEY="AI..."
EOF

# Allow direnv for this directory
direnv allow
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

## Ubuntu-Specific Tips

### Fix npm Global Permission Issues

Avoid using `sudo` with npm by configuring a user-local directory:

```bash
# Create directory for global packages
mkdir -p ~/.npm-global

# Configure npm to use it
npm config set prefix '~/.npm-global'

# Add to PATH
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Now install without sudo
npm install -g @anthropic-ai/claude-code
```

### Create a Desktop Launcher

Create a `.desktop` file for easy access:

```bash
cat > ~/.local/share/applications/conclave.desktop << 'EOF'
[Desktop Entry]
Name=Conclave
Comment=Multi-LLM Collaboration CLI
Exec=gnome-terminal -- bash -c "source /path/to/conclave/python/venv/bin/activate && conclave list; exec bash"
Icon=utilities-terminal
Terminal=true
Type=Application
Categories=Development;
EOF
```

### Systemd Service (for Servers)

If you want to run Conclave flows as a service:

```bash
sudo cat > /etc/systemd/system/conclave-flow.service << 'EOF'
[Unit]
Description=Conclave Flow Runner
After=network.target

[Service]
Type=oneshot
User=your-username
WorkingDirectory=/path/to/your/project
Environment="PATH=/path/to/conclave/python/venv/bin:/usr/bin"
ExecStart=/path/to/conclave/python/venv/bin/conclave run basic-ideator input.md

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
sudo systemctl daemon-reload
```

### Using with tmux/screen (Remote Sessions)

```bash
# Start a tmux session
tmux new -s conclave

# Activate venv and run
source /path/to/conclave/python/venv/bin/activate
conclave run basic-ideator my-idea.md

# Detach: Ctrl+B, then D
# Reattach later: tmux attach -t conclave
```

---

## Troubleshooting

### "python3: command not found"

```bash
sudo apt install python3 python3-venv python3-pip -y
```

### "pip: command not found"

```bash
sudo apt install python3-pip -y
# Or within venv:
python -m ensurepip --upgrade
```

### "node: command not found"

The NodeSource installation may have failed. Try:

```bash
# Remove old Node if any
sudo apt remove nodejs npm -y

# Reinstall
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install nodejs -y
```

### "claude: command not found"

npm global binaries aren't in PATH:

```bash
# Find where npm installs global packages
npm config get prefix

# Add to PATH (replace /usr/local if different)
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Or if you used ~/.npm-global:
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### SSL Certificate Errors

```bash
# Update certificates
sudo apt install ca-certificates -y
sudo update-ca-certificates

# For Python
pip install --upgrade certifi
```

### Permission Denied on Virtual Environment

```bash
# Make sure you own the directory
sudo chown -R $USER:$USER /path/to/conclave/python

# Recreate venv
rm -rf venv
python3 -m venv venv
```

### "externally-managed-environment" Error (Ubuntu 23.04+)

Ubuntu 23.04+ uses PEP 668 which prevents pip from installing system-wide:

```bash
# Always use a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate
pip install -e .

# Or break system packages (not recommended)
pip install --break-system-packages -e .
```

### Browser Won't Open (SSH/Headless)

```bash
# Claude will print a URL to visit
claude

# Copy the URL, open on your local machine
# Complete auth, then paste the code back
```

---

## Quick Reference: Paths

| Item | Typical Location |
|------|------------------|
| Python 3 | `/usr/bin/python3` |
| Node.js | `/usr/bin/node` |
| npm global | `/usr/local/lib/node_modules/` or `~/.npm-global/` |
| Conclave venv | `/path/to/conclave/python/venv/` |
| Conclave config | `./conclave.config.yaml` |
| Conclave output | `./.conclave/runs/` |

---

## Next Steps

- Read the [main tutorial](../GETTING_STARTED.md) for usage details
- Run `conclave list` to see available flows
- Run `conclave new-flow` to create custom flows
- Check `conclave --help` for all commands

Happy collaborating!
