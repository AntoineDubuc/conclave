# Tutorial: Interactive Chat Room

**Use Case: Brainstorming Janus's Next Feature**

The chat room lets you have real-time discussions with multiple AI models, all sharing context. Unlike batch flows that produce files, chat is interactive and conversational.

---

## How It Works

The chat follows a **turn-based** interaction model:

```
┌─────────────────────────────────────────────────────────────┐
│  YOU send a message                                         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  ALL MODELS respond (in parallel)                           │
│  [Claude] [GPT] [Gemini] → Each gives a brief response      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  YOU send another message                                   │
│  (Models see the full conversation history)                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  ALL MODELS respond again...                                │
└─────────────────────────────────────────────────────────────┘
```

### Key Points

1. **You always go first** - The human initiates each exchange
2. **All models respond together** - After you speak, every active model replies
3. **Shared context** - Each model sees the entire conversation history (your messages + all model responses)
4. **Brief by default** - Models give 2-4 sentence responses to keep discussion flowing
5. **@mentions narrow responses** - Use `@anthropic` to get only Claude to respond

### The Conversation Flow

```
You:      "What's the best database for a habit tracker?"
          ↓
Claude:   "SQLite for mobile-only, Supabase if you need sync."
GPT:      "Agree. Firebase also works in the Google ecosystem."
Gemini:   "Consider Realm for offline-first with automatic sync."
          ↓
You:      "@anthropic why SQLite over Realm?"
          ↓
Claude:   "SQLite is simpler, zero dependencies, and Realm adds..."
          (Only Claude responds because of @mention)
          ↓
You:      "What about performance at scale?"
          ↓
Claude:   "SQLite handles millions of rows fine for local..."
GPT:      "At true scale, neither - you'd want Postgres..."
Gemini:   "Realm's lazy loading helps with large datasets..."
          (All respond again - no @mention)
```

---

## When to Use Chat vs Flows

| Scenario | Use |
|----------|-----|
| Open-ended exploration, brainstorming | **Chat** |
| Need to iterate quickly on ideas | **Chat** |
| Want structured output saved to files | **Flows** |
| Processing multiple documents | **Flows** |

---

## Quick Start

```bash
# Start chat with all configured models
janus chat

# Start with specific models only
janus chat -m anthropic -m openai

# Resume a previous session
janus chat -s my_session.json
```

---

## Real Example: Brainstorming Janus Features

Let's use the chat room to brainstorm the next feature for Janus itself.

### Starting the Session

```bash
janus chat -m anthropic -m openai -m gemini
```

```
━━━ Janus Chat Room ━━━
Models: Anthropic (CLI), OpenAI, Gemini
Type /help for commands, /quit to exit
```

### Round 1: Initial Question

```
You: What should be the next innovative feature for Janus?
```

All three models respond with brief 2-4 sentence answers:

```
╭─────────────────────── Anthropic (CLI) ───────────────────────╮
│ I'd suggest structured debate mode - where models are         │
│ explicitly assigned opposing positions on a topic and must    │
│ defend them across rounds, with a final synthesis by a        │
│ neutral arbiter model.                                        │
│                                                               │
│ What angles are @OpenAI and @Gemini seeing?                   │
╰───────────────────────────────────────────────────────────────╯

╭─────────────────────────── OpenAI ────────────────────────────╮
│ Add an "argument graph + adjudication" mode: Janus extracts   │
│ claims, assumptions, and evidence from each model into a      │
│ shared graph, then runs targeted cross-examination prompts    │
│ to resolve conflicts and quantify uncertainty.                │
╰───────────────────────────────────────────────────────────────╯

╭─────────────────────────── Gemini ────────────────────────────╮
│ I think Janus could benefit from custom routing logic for     │
│ batch flows. Instead of just round-robin, users could specify │
│ rules based on content, like "route creative prompts to       │
│ Anthropic."                                                   │
╰───────────────────────────────────────────────────────────────╯
```

### Round 2: Deep Dive with @Mention

You can address specific models using `@mentions`:

```
You: @anthropic can you elaborate on how voting/consensus would work?
```

Only Claude responds this time:

```
╭─────────────────────── Anthropic (CLI) ───────────────────────╮
│ Here's how I'd approach it technically:                       │
│                                                               │
│ **Structured output per model:** Each responds with JSON      │
│ containing position, confidence, key_claims, and rebuttals.   │
│                                                               │
│ **Consensus detection:** After each round, Janus computes     │
│ agreement matrices. If >75% converge with high confidence,    │
│ that branch closes.                                           │
│                                                               │
│ **Arbiter synthesis:** A designated model produces a final    │
│ verdict with explicit minority opinion acknowledgment.        │
╰───────────────────────────────────────────────────────────────╯
```

### Round 3: Get Detailed Response with /expand

When you need more detail, use the `/expand` command:

```
You: /expand
```

All models now give detailed 500-1000 word responses with code examples, diagrams, and implementation specifics.

---

## Available Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/quit` | Exit the chat |
| `/clear` | Clear conversation history |
| `/models` | List active models |
| `/expand` | Get detailed responses from all |
| `/ask <model>` | Get response from one model |
| `/save [file]` | Save session to file |
| `/load <file>` | Load a previous session |

---

## @Mention Syntax

Address specific models to get targeted responses:

```
@anthropic what do you think?         # Only Claude responds
@openai @gemini compare your views    # Both respond, not others
```

Without mentions, all models respond.

---

## Session Persistence

Save your conversation for later:

```
You: /save feature-brainstorm
Saved to: ~/.janus/chat_sessions/feature-brainstorm.json
```

Resume later:

```bash
janus chat -s feature-brainstorm.json
```

---

## Tips for Effective Multi-LLM Chat

### 1. Start Broad, Then Focus

Begin with open questions to all models, then use @mentions to drill into specific angles.

### 2. Let Models Challenge Each Other

Models can reference each other with @mentions. Ask follow-up questions that encourage cross-examination:

```
You: @openai what do you think of @anthropic's approach?
```

### 3. Use /expand Strategically

Default responses are brief (2-4 sentences) to keep discussions moving. Only expand when you need implementation details.

### 4. Save Key Sessions

Interesting brainstorms are worth preserving. Use `/save` with descriptive names.

---

## Example Use Cases

| Use Case | How to Run |
|----------|------------|
| Feature brainstorming | `janus chat` - open discussion |
| Code review discussion | `janus chat -m anthropic -m openai` - security focus |
| Architecture decisions | `janus chat` - get multiple perspectives |
| Debugging strategies | `janus chat` - different approaches |
| API design feedback | `janus chat` - pros/cons from each |

---

## How It Differs from Flows

| Aspect | Chat | Flows |
|--------|------|-------|
| Interaction | Real-time, interactive | Batch, non-interactive |
| Output | Displayed in terminal | Written to files |
| Context | Shared conversation history | Structured rounds |
| Use case | Exploration, brainstorming | Document processing |

---

## Full Transcript Example

See [CHAT_TRANSCRIPT_EXAMPLE.md](../CHAT_TRANSCRIPT_EXAMPLE.md) for a complete 3-round session where models brainstorm Janus features including structured debate mode, argument graphs, and consensus systems.

---

*Next: Try [Basic Flow Tutorial](BASIC_FLOW_TUTORIAL.md) for batch document processing.*
