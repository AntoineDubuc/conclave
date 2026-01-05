# Chat Room Feature - Implementation Plan

## Architectural Separation

The chat feature is **completely isolated** from existing Conclave functionality:

```
conclave/
├── cli.py              # Add ONE new command: `conclave chat`
├── core/
│   └── types.py        # Add chat-specific Pydantic models (additive only)
├── providers/          # UNCHANGED - reuse existing providers as-is
├── flows/              # UNCHANGED - batch paradigm stays separate
├── utils/              # UNCHANGED
└── chat/               # NEW - entirely self-contained module
    ├── __init__.py
    ├── room.py         # Main orchestrator
    ├── session.py      # State management
    ├── commands.py     # /help, /quit, etc.
    ├── context.py      # Token management
    ├── prompts.py      # Brevity system prompts
    ├── persistence.py  # Save/load sessions
    └── ui/
        ├── __init__.py
        ├── display.py  # Rich rendering
        └── input.py    # User input
```

### Why This Separation Works

| Concern | Flows (existing) | Chat (new) |
|---------|------------------|------------|
| **Paradigm** | Batch: submit → rounds → files | Interactive: real-time loop |
| **Input** | Markdown file | Keyboard input |
| **Output** | `.conclave/runs/*.md` files | Terminal display |
| **State** | Stateless per run | Persistent session |
| **Providers** | ✓ Reused as-is | ✓ Reused as-is |

### What Changes in Existing Files

**Only 2 existing files are modified:**

1. **`conclave/core/types.py`** - Add new models (additive, no breaking changes):
   ```python
   # New additions only:
   class MessageRole(str, Enum): ...
   class ChatMessage(BaseModel): ...
   class ChatConfig(BaseModel): ...
   ```

2. **`conclave/cli.py`** - Add one command:
   ```python
   @main.command()
   def chat(...):
       """Start interactive multi-LLM chat room."""
   ```

**Everything else is NEW files** in `conclave/chat/`.

---

## Implementation Phases

### Phase 1: Foundation (Core Data + Basic Loop)

**Files to create:**
- `conclave/chat/__init__.py`
- `conclave/chat/session.py`
- `conclave/chat/prompts.py`
- `conclave/chat/ui/__init__.py`
- `conclave/chat/ui/display.py`

**Files to modify:**
- `conclave/core/types.py` (add ChatMessage, ChatConfig)
- `conclave/cli.py` (add chat command)

**Deliverable:** Basic working chat - user types, all models respond.

```bash
conclave chat
> Hello, what's the best database for a habit tracker?
[Anthropic] SQLite for mobile, Supabase for sync.
[OpenAI] Agree. Firebase also works in Google ecosystem.
> /quit
```

---

### Phase 2: Commands

**Files to create:**
- `conclave/chat/commands.py`

**Commands implemented:**
- `/help` - Show available commands
- `/quit` - Exit chat
- `/clear` - Clear conversation history
- `/models` - List active models

**Deliverable:** Basic command handling works.

---

### Phase 3: Targeting + @Mentions

**Files to modify:**
- `conclave/chat/room.py` (add mention parsing)
- `conclave/chat/commands.py` (add /ask command)

**Features:**
- `@anthropic` in message → only Anthropic responds
- `/ask openai What do you think?` → only OpenAI responds

**Deliverable:** Can address specific models.

---

### Phase 4: Context Management

**Files to create:**
- `conclave/chat/context.py`

**Features:**
- Sliding window to fit context in token limits
- Token estimation (~4 chars/token)
- Configurable max context size

**Deliverable:** Long conversations don't break.

---

### Phase 5: Persistence

**Files to create:**
- `conclave/chat/persistence.py`

**Files to modify:**
- `conclave/chat/commands.py` (add /save, /load)

**Features:**
- Save sessions to `.conclave/chat_sessions/`
- Load and resume previous conversations
- List saved sessions

**Deliverable:** Sessions persist across runs.

---

### Phase 6: Expand + Polish

**Files to modify:**
- `conclave/chat/commands.py` (add /expand)
- `conclave/chat/prompts.py` (expand prompt)

**Features:**
- `/expand` gets detailed response to last message
- Improved display formatting
- Better error handling

**Deliverable:** Production-ready chat feature.

---

## File Details

### New Files Summary

| File | LOC (est.) | Purpose |
|------|------------|---------|
| `chat/__init__.py` | 10 | Exports |
| `chat/room.py` | 150 | Main loop, message handling |
| `chat/session.py` | 80 | State management |
| `chat/commands.py` | 120 | Command parsing + execution |
| `chat/context.py` | 60 | Token/context management |
| `chat/prompts.py` | 30 | System prompts |
| `chat/persistence.py` | 70 | JSON save/load |
| `chat/ui/__init__.py` | 5 | Exports |
| `chat/ui/display.py` | 100 | Rich panels, spinners |
| `chat/ui/input.py` | 30 | Input handling |
| **Total** | ~655 | |

### Modified Files Summary

| File | Changes |
|------|---------|
| `core/types.py` | +40 lines (new models) |
| `cli.py` | +25 lines (chat command) |

---

## Testing Strategy

### Manual Testing Checklist

- [ ] `conclave chat` starts successfully
- [ ] Multiple models respond to messages
- [ ] `/help` shows commands
- [ ] `/quit` exits cleanly
- [ ] `/clear` resets conversation
- [ ] `@anthropic` addresses only Claude
- [ ] `/ask openai ...` works
- [ ] Long conversations don't crash
- [ ] `/save` creates file
- [ ] `/load` restores session
- [ ] `/expand` gives detailed response

### Automated Tests (Future)

```
tests/
└── chat/
    ├── test_session.py
    ├── test_commands.py
    ├── test_context.py
    └── test_persistence.py
```

---

## Rollback Strategy

If issues arise, the chat feature can be completely removed by:
1. Deleting `conclave/chat/` directory
2. Removing chat models from `core/types.py`
3. Removing chat command from `cli.py`

No existing functionality is affected.

---

## Ready to Implement

The plan is ready. Next steps:
1. `git commit` current state
2. Implement Phase 1 (Foundation)
3. Test basic functionality
4. Proceed through remaining phases
