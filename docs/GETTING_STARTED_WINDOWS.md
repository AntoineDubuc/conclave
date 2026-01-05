# Getting Started with Conclave on Windows

This guide walks you through setting up Conclave on Windows 10 or Windows 11.

---

## Prerequisites

- Windows 10 (version 1903+) or Windows 11
- Administrator access (for some installations)
- At least one of:
  - AI provider API key (OpenAI, Anthropic, Google, or xAI)
  - Claude Pro or Max subscription

---

## Step 1: Install Python

### Option A: Microsoft Store (Easiest)

1. Open Microsoft Store
2. Search for "Python 3.11"
3. Click "Get" to install
4. Open a new Command Prompt or PowerShell and verify:

```powershell
python --version
# Should show: Python 3.11.x or higher
```

### Option B: Official Installer

1. Download from [python.org](https://www.python.org/downloads/)
2. Run the installer
3. **Important**: Check "Add Python to PATH" at the bottom of the installer
4. Click "Install Now"
5. Open a new terminal and verify:

```powershell
python --version
```

---

## Step 2: Install Node.js

Node.js is required for Claude Code CLI.

1. Download the LTS version from [nodejs.org](https://nodejs.org/)
2. Run the installer (accept defaults)
3. Open a new Command Prompt or PowerShell and verify:

```powershell
node --version
# Should show: v18.x.x or higher

npm --version
```

---

## Step 3: Install Conclave

### Using Command Prompt

```cmd
:: Navigate to the project
cd C:\path\to\conclave\python

:: Create a virtual environment
python -m venv venv

:: Activate it
venv\Scripts\activate

:: Your prompt should now show (venv)

:: Install Conclave
pip install -e .

:: Verify installation
conclave --version
```

### Using PowerShell

```powershell
# Navigate to the project
cd C:\path\to\conclave\python

# Create a virtual environment
python -m venv venv

# Activate it (PowerShell requires different command)
.\venv\Scripts\Activate.ps1

# If you get an execution policy error, run this first:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Install Conclave
pip install -e .

# Verify installation
conclave --version
```

---

## Step 4: Set Up Claude Code (Recommended)

If you have a Claude Pro ($20/month) or Max ($100/month) subscription, use Claude without API costs.

### 4.1: Install Claude Code

Open Command Prompt or PowerShell **as Administrator**:

```powershell
npm install -g @anthropic-ai/claude-code
```

Verify installation:

```powershell
claude --version
```

### 4.2: Authenticate

```powershell
claude
```

This opens your default browser to authenticate:

1. Press Enter when prompted
2. Log in to claude.ai with your Anthropic account
3. Click "Authorize" to grant access
4. Return to your terminal - you'll see a success message

### 4.3: Verify It Works

```powershell
# Quick test
claude -p "Say hello"

# Conclave verification (make sure venv is activated)
conclave auth-claude
```

Expected output:

```
Claude Code Authentication Manager

Checking Claude Code status...
Claude CLI is accessible and responding.
```

---

## Step 5: Set Up API Keys

### Option A: Environment Variables (Persistent)

1. Press `Win + R`, type `sysdm.cpl`, press Enter
2. Go to **Advanced** tab → **Environment Variables**
3. Under "User variables", click **New** for each:

| Variable Name | Variable Value |
|--------------|----------------|
| `OPENAI_API_KEY` | `sk-...` |
| `GEMINI_API_KEY` | `AI...` |
| `XAI_API_KEY` | `xai-...` |

4. Click OK to save
5. **Restart your terminal** for changes to take effect

### Option B: PowerShell Session (Temporary)

```powershell
$env:OPENAI_API_KEY = "sk-..."
$env:GEMINI_API_KEY = "AI..."
$env:XAI_API_KEY = "xai-..."
```

### Option C: .env File (Per Project)

Create a file named `.env` in your project directory:

```
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...
XAI_API_KEY=xai-...
```

---

## Step 6: Verify Everything

```powershell
# Make sure venv is activated
cd C:\path\to\conclave\python
.\venv\Scripts\Activate.ps1

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

## Step 7: Run Your First Flow

```powershell
# Create a test file
@"
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
"@ | Out-File -FilePath my-idea.md -Encoding UTF8

# Run the collaboration
conclave run basic-ideator my-idea.md
```

---

## Windows-Specific Tips

### Windows Terminal (Recommended)

Install Windows Terminal from Microsoft Store for a better experience:
- Multiple tabs
- Better color support
- Split panes

### Create a Batch File for Quick Access

Create `conclave.bat` in a folder that's in your PATH:

```batch
@echo off
cd /d C:\path\to\conclave\python
call venv\Scripts\activate.bat
conclave %*
```

Then you can run `conclave` from anywhere.

### PowerShell Profile

Add to your PowerShell profile for auto-activation:

```powershell
# Find your profile location
$PROFILE

# Edit it (creates if doesn't exist)
notepad $PROFILE

# Add this line:
function Start-Conclave {
    cd C:\path\to\conclave\python
    .\venv\Scripts\Activate.ps1
}
Set-Alias -Name jenv -Value Start-Conclave
```

Now type `jenv` to activate the Conclave environment.

### WSL Alternative

If you prefer a Unix-like environment, use WSL (Windows Subsystem for Linux):

```powershell
# Install WSL (run as Administrator)
wsl --install

# After restart, open Ubuntu from Start menu
# Then follow the Ubuntu guide
```

---

## Troubleshooting

### "'python' is not recognized"

Python isn't in your PATH:

1. Reinstall Python and check "Add Python to PATH"
2. Or manually add: `C:\Users\<you>\AppData\Local\Programs\Python\Python311\` to PATH

### "'conclave' is not recognized"

The virtual environment isn't activated:

```powershell
cd C:\path\to\conclave\python
.\venv\Scripts\Activate.ps1
```

### "'claude' is not recognized"

npm global binaries aren't in PATH. Find and add them:

```powershell
# Find npm global folder
npm config get prefix

# Add this path + \bin to your PATH environment variable
```

### PowerShell Execution Policy Error

```powershell
# Run this once as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### SSL Certificate Errors

```powershell
# Upgrade pip and certifi
python -m pip install --upgrade pip certifi
```

### Long Path Issues

Enable long paths in Windows (as Administrator):

```powershell
# PowerShell as Administrator
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

### Antivirus Blocking

Some antivirus software blocks Python or npm. Add exceptions for:
- `C:\path\to\conclave\python\venv\`
- `%APPDATA%\npm\`
- `C:\Users\<you>\AppData\Local\Programs\Python\`

---

## Quick Reference: Commands

| Task | Command Prompt | PowerShell |
|------|---------------|------------|
| Activate venv | `venv\Scripts\activate.bat` | `.\venv\Scripts\Activate.ps1` |
| Deactivate venv | `deactivate` | `deactivate` |
| Set env var | `set VAR=value` | `$env:VAR = "value"` |
| View env var | `echo %VAR%` | `$env:VAR` |

---

## Next Steps

- Read the [main tutorial](../GETTING_STARTED.md) for usage details
- Run `conclave list` to see available flows
- Run `conclave new-flow` to create custom flows
- Check `conclave --help` for all commands

Happy collaborating!
