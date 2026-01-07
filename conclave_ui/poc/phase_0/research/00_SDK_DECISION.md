# Research: SDK Decision - Agent SDK vs Anthropic SDK

## The Two Options

### Option A: Claude Agent SDK (`claude-agent-sdk`)
- **What it is:** High-level framework for building autonomous agents
- **Runtime:** Built on Claude Code CLI
- **Tool execution:** Automatic - SDK handles the tool loop
- **Built-in tools:** Read, Write, Edit, Bash, Glob, Grep, WebSearch, etc.

### Option B: Anthropic SDK with Tool Use (`anthropic`)
- **What it is:** Direct API access to Claude models
- **Runtime:** Direct HTTPS calls to api.anthropic.com
- **Tool execution:** Manual - you implement the tool loop
- **Built-in tools:** None - you define all tools

---

## Analysis for Our Use Case

### What We Need

1. **Conversational agent** - Multi-turn chat that remembers context
2. **Custom tools only:**
   - `preview_flow` - Show flow structure (returns JSON)
   - `create_flow` - Finalize flow config (returns JSON)
   - `list_templates` - Show available templates (returns list)
3. **Structured output** - Flow configurations as JSON/YAML
4. **No file system access needed** - Tools return data, not write files

### Decision Matrix

| Requirement | Agent SDK | Anthropic SDK |
|-------------|-----------|---------------|
| Multi-turn conversation | ✅ ClaudeSDKClient | ✅ Manual message history |
| Custom tools (3 simple ones) | ✅ MCP server setup | ✅ Simple JSON schemas |
| Structured JSON output | ✅ output_format | ✅ Tool returns |
| No file system needed | ⚠️ Overkill - has many built-in | ✅ Perfect fit |
| Docker simplicity | ⚠️ Needs Claude Code runtime | ✅ Just pip install |
| Dependencies | Heavy (claude-agent-sdk + claude-code) | Light (anthropic only) |
| Learning curve | Medium | Low |
| Control over tool loop | Less | Full |

---

## Recommendation: Anthropic SDK with Tool Use

**For Phase Zero, use the regular Anthropic SDK** because:

1. **Simpler setup** - Just `pip install anthropic`
2. **Lighter Docker** - No Claude Code runtime needed
3. **Perfect fit** - Our tools are just JSON in/out, no file operations
4. **More control** - We can see exactly what's happening
5. **Easier debugging** - Explicit tool loop

### When to Upgrade to Agent SDK

Consider Agent SDK in **Phase 1+** if we want Claude to:
- Actually write flow code files to disk
- Execute and test flows automatically
- Do complex multi-step reasoning with file operations

---

## Implementation Approach

### Tool Loop Pattern (Anthropic SDK)

```python
import anthropic

class FlowArchitectAgent:
    def __init__(self):
        self.client = anthropic.Anthropic()
        self.messages = []  # Conversation history

    def chat(self, user_message: str) -> tuple[str, dict | None]:
        self.messages.append({"role": "user", "content": user_message})

        # Initial response
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=self.messages
        )

        # Handle tool use loop
        while response.stop_reason == "tool_use":
            # Find tool use blocks
            tool_uses = [b for b in response.content if b.type == "tool_use"]

            # Execute tools and collect results
            tool_results = []
            flow_created = None

            for tool_use in tool_uses:
                result, flow = self.execute_tool(tool_use.name, tool_use.input)
                if flow:
                    flow_created = flow
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use.id,
                    "content": result
                })

            # Add assistant response and tool results to history
            self.messages.append({"role": "assistant", "content": response.content})
            self.messages.append({"role": "user", "content": tool_results})

            # Get next response
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=self.messages
            )

        # Extract final text
        final_text = "".join(b.text for b in response.content if hasattr(b, "text"))
        self.messages.append({"role": "assistant", "content": response.content})

        return final_text, flow_created
```

---

## Tool Definitions

```python
TOOLS = [
    {
        "name": "preview_flow",
        "description": "Show the user a preview of a flow configuration. Use this before create_flow to let the user see and approve the structure.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Name of the flow"
                },
                "description": {
                    "type": "string",
                    "description": "What this flow does"
                },
                "flow_type": {
                    "type": "string",
                    "enum": ["basic", "leading"],
                    "description": "basic = round-robin, leading = hub-and-spoke with leader"
                },
                "max_rounds": {
                    "type": "integer",
                    "description": "Number of rounds (typically 2-4)"
                },
                "models": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Models to use, e.g. ['anthropic', 'openai', 'gemini']"
                },
                "default_leader": {
                    "type": "string",
                    "description": "For leading flows, which model leads"
                },
                "prompts": {
                    "type": "object",
                    "properties": {
                        "round_1": {"type": "string", "description": "Initial prompt for round 1"},
                        "refinement": {"type": "string", "description": "Prompt for refinement rounds"},
                        "leader_synthesis": {"type": "string", "description": "For leading flows, the synthesis prompt"}
                    },
                    "required": ["round_1", "refinement"]
                }
            },
            "required": ["name", "flow_type", "max_rounds", "models", "prompts"]
        }
    },
    {
        "name": "create_flow",
        "description": "Finalize and create a flow configuration. Only use this after the user has approved a preview.",
        "input_schema": {
            # Same as preview_flow
        }
    },
    {
        "name": "list_templates",
        "description": "List available flow templates that users can start from",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }
]
```

---

## Conversation History Management

The Anthropic SDK is stateless - we maintain conversation history ourselves:

```python
# In session_state (Streamlit)
if "messages" not in st.session_state:
    st.session_state.messages = []  # For display
if "agent" not in st.session_state:
    st.session_state.agent = FlowArchitectAgent()  # Holds API message history
```

This gives us full control and visibility into what's being sent to Claude.

---

## Next Steps

1. ✅ Decision made: Use Anthropic SDK
2. Create requirements.txt with `anthropic>=0.40.0`
3. Implement FlowArchitectAgent class
4. Test tool loop locally before Streamlit integration
