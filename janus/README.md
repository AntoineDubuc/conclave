# Janus 🎭
**The AI War Room - Orchestration for Multi-Agent Debate**

Janus is a CLI tool that automates the "Council of Experts" reasoning pattern. Instead of manually copying prompts between Claude, ChatGPT, and Gemini, Janus orchestrates a debate between them to refine your ideas, audit your code, or plan your architecture.

## 🚀 Quick Start Tutorial

### 1. Installation
Since you have the source code, link it globally:

```bash
cd janus
npm install
npm run build
npm link
```

### 2. Authentication
Janus connects to the APIs directly. You need to provide your keys.
Rename the example file and add your keys:

```bash
mv .env.example .env
# Edit .env and add:
# OPENAI_API_KEY=sk-...
# Edit .env and add:
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant... (Optional if you have Claude CLI installed)
# GEMINI_API_KEY=...

### 💡 efficient: Reuse your Claude Plan!
If you have **Claude Code CLI** installed and authenticated (`claude login`), Janus will automatically use it if you **do not** provide an `ANTHROPIC_API_KEY`.
This means you can leverage your existing Pro/Max plan limits!

```

### 3. Run Your First "War Room"
Create a file with a rough idea. Let's say, `app_idea.md`:

```markdown
# Idea: Coffee Tracker
I want a simple React Native app to track my daily caffeine intake.
It should warn me if I drink too much.
```

Now, ignite the engine:

```bash
janus run ideation app_idea.md
```

**What happens next?**
1.  **Round 1 (Divergence)**: Janus sends your idea to Claude, OpenAI, and Gemini simultaneously. It asks them to "Flesh this out".
2.  **Round 2 (Convergence)**: Janus takes Claude's plan, feeds it to Gemini and OpenAI, and says "Critique this". It does the same for everyone.
3.  **Result**: You will find the output in `.janus/runs/<run_id>/`. Look for `claude.v3.md` (or the highest version) for the battle-tested plan.

---

## 🛠️ Configuration

### Defining New Flows
You can define your own workflows (e.g., "Security Audit", "UX Review") using the wizard:

```bash
janus new-flow
```

It will ask you:
1.  **Name**: e.g., `audit`
2.  **Round 1 Prompt**: "Find all security vulnerabilities in this code..."
3.  **Rounds**: How many iterations of critique?
4.  **Refinement Prompt**: "Review your peer's findings. Did you miss anything?"

### Advanced Config (`~/.janus/config.yaml`)
You can manually edit the config to add new providers (like Grok or local Ollama) or tweak the model names.

---

## 🧠 Why "Janus"?
Janus is the Roman god of beginnings, gates, transitions, time, duality, doorways, passages, frames, and endings. He is usually depicted as having two faces.
Just like this tool, he looks at the past (your draft) and the future (the refined plan) simultaneously.
