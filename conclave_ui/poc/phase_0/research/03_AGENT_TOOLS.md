# Research: Phase 0.3 - Claude Agent with Tools

## Goal
Create a conversational agent using Anthropic SDK that can design flows through tool use.

---

## Architecture

```
User Message → FlowArchitectAgent → Anthropic API
                                        ↓
                               Claude (with tools)
                                        ↓
                              Tool Call (if needed)
                                        ↓
                           Tool Handler → Result
                                        ↓
                              Claude (continues)
                                        ↓
                               Final Response
```

---

## System Prompt

```python
SYSTEM_PROMPT = """You are a Flow Architect for a multi-LLM collaboration platform.

Your role is to help users design flows where multiple AI models work together to solve problems.

## Flow Patterns

**Basic (Round-Robin):**
All models respond independently, then see each other's work and refine.
Best for: brainstorming, code review, getting diverse perspectives, security audits.

**Leading (Hub-and-Spoke):**
One model leads and synthesizes contributions from all others.
Best for: architecture docs, final reports, unified deliverables, when you need ONE answer.

## Available Models

- **anthropic** (Claude): Strong reasoning, nuanced analysis, safety-conscious
- **openai** (GPT): Broad knowledge, creative, good at following formats
- **gemini** (Google): Strong analytical capabilities, good with data
- **grok** (xAI): Real-time knowledge, unique perspectives

## Your Tools

- `preview_flow`: Show a flow structure before creating it. Use this to let the user see and approve.
- `create_flow`: Finalize a flow configuration. Only use after user approves a preview.
- `list_templates`: Show available templates to help users get started.

## Your Approach

1. **Understand the goal** - Ask clarifying questions if needed
2. **Recommend a pattern** - Explain why basic or leading fits their use case
3. **Propose structure** - Rounds, models, and prompt strategy
4. **Preview first** - Always use preview_flow before create_flow
5. **Iterate** - Refine based on user feedback
6. **Create** - Use create_flow when user is happy

## Guidelines

- Be conversational but efficient
- Explain your reasoning briefly
- Default to 2-3 rounds (more rounds = diminishing returns)
- Default to 3 models unless user specifies
- Write clear, actionable prompts that encourage models to build on each other
- For leading flows, recommend Claude as leader for nuanced synthesis (unless user prefers otherwise)
"""
```

---

## Tool Definitions

```python
TOOLS = [
    {
        "name": "preview_flow",
        "description": "Show the user a preview of a flow configuration. Always use this before create_flow to let them review and adjust.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Short name for the flow (e.g., 'startup-brainstorm', 'code-review')"
                },
                "description": {
                    "type": "string",
                    "description": "One sentence describing what this flow does"
                },
                "flow_type": {
                    "type": "string",
                    "enum": ["basic", "leading"],
                    "description": "basic = round-robin (all equal), leading = one model synthesizes"
                },
                "max_rounds": {
                    "type": "integer",
                    "minimum": 2,
                    "maximum": 6,
                    "description": "Number of rounds. 2-3 typical, more for complex tasks."
                },
                "models": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["anthropic", "openai", "gemini", "grok"]},
                    "minItems": 2,
                    "description": "Which models to include in this flow"
                },
                "default_leader": {
                    "type": "string",
                    "enum": ["anthropic", "openai", "gemini", "grok"],
                    "description": "For leading flows, which model synthesizes. Recommended: anthropic."
                },
                "prompts": {
                    "type": "object",
                    "properties": {
                        "round_1": {
                            "type": "string",
                            "description": "Initial prompt for round 1. Should set context and ask for initial response."
                        },
                        "refinement": {
                            "type": "string",
                            "description": "Prompt for refinement rounds. Should encourage building on peer feedback."
                        },
                        "leader_synthesis": {
                            "type": "string",
                            "description": "For leading flows: prompt for leader to synthesize all inputs."
                        }
                    },
                    "required": ["round_1", "refinement"]
                }
            },
            "required": ["name", "description", "flow_type", "max_rounds", "models", "prompts"]
        }
    },
    {
        "name": "create_flow",
        "description": "Finalize and create a flow configuration. Only use this AFTER the user has approved a preview.",
        "input_schema": {
            # Same schema as preview_flow
        }
    },
    {
        "name": "list_templates",
        "description": "List available flow templates to help users get started",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }
]
```

---

## Tool Handlers

```python
def handle_tool_call(name: str, input: dict) -> tuple[str, dict | None]:
    """
    Handle a tool call from Claude.

    Returns:
        (result_text, flow_dict_if_created)
    """

    if name == "preview_flow":
        return handle_preview_flow(input), None

    elif name == "create_flow":
        validated = validate_flow(input)
        return f"✅ Flow '{validated['name']}' created!", validated

    elif name == "list_templates":
        return get_templates_text(), None

    return "Unknown tool", None


def handle_preview_flow(flow: dict) -> str:
    """Format a flow config as a readable preview."""

    lines = [
        f"## {flow['name']}",
        f"*{flow.get('description', 'No description')}*",
        "",
        f"**Pattern:** {flow['flow_type'].title()} "
        f"({'all models equal' if flow['flow_type'] == 'basic' else 'leader synthesizes'})",
        f"**Rounds:** {flow['max_rounds']}",
        f"**Models:** {', '.join(flow['models'])}",
    ]

    if flow.get('default_leader'):
        lines.append(f"**Leader:** {flow['default_leader']}")

    lines.extend(["", "### Prompts", ""])

    prompts = flow.get('prompts', {})
    if prompts.get('round_1'):
        lines.append(f"**Round 1:**\n> {prompts['round_1'][:200]}...")
    if prompts.get('refinement'):
        lines.append(f"\n**Refinement:**\n> {prompts['refinement'][:200]}...")
    if prompts.get('leader_synthesis'):
        lines.append(f"\n**Leader Synthesis:**\n> {prompts['leader_synthesis'][:200]}...")

    lines.extend(["", "---", "*Reply to adjust, or say 'create it' to finalize.*"])

    return "\n".join(lines)


def validate_flow(flow: dict) -> dict:
    """Validate and normalize a flow config."""

    # Ensure required fields
    assert flow.get('name'), "Flow must have a name"
    assert flow.get('flow_type') in ('basic', 'leading'), "Invalid flow type"
    assert 2 <= flow.get('max_rounds', 0) <= 6, "Rounds must be 2-6"
    assert len(flow.get('models', [])) >= 2, "Need at least 2 models"

    # For leading flows, require leader
    if flow['flow_type'] == 'leading':
        if not flow.get('default_leader'):
            flow['default_leader'] = flow['models'][0]  # Default to first

    return flow


def get_templates_text() -> str:
    """Return formatted list of templates."""

    templates = [
        {
            "name": "brainstorm",
            "description": "Democratic brainstorming with peer refinement",
            "flow_type": "basic",
            "use_case": "Open-ended ideation, exploring options"
        },
        {
            "name": "architecture",
            "description": "Architecture design with lead synthesizer",
            "flow_type": "leading",
            "use_case": "Technical specs, design docs"
        },
        {
            "name": "code-review",
            "description": "Multi-model code review with cross-validation",
            "flow_type": "basic",
            "use_case": "Security audits, finding bugs"
        },
        {
            "name": "debate",
            "description": "Models argue different positions",
            "flow_type": "basic",
            "use_case": "Exploring trade-offs, decision making"
        },
    ]

    lines = ["## Available Templates", ""]
    for t in templates:
        lines.append(f"### {t['name']} ({t['flow_type']})")
        lines.append(f"*{t['description']}*")
        lines.append(f"Best for: {t['use_case']}")
        lines.append("")

    lines.append("Say 'use [template name]' to start from one of these.")

    return "\n".join(lines)
```

---

## Agent Class

```python
import anthropic
from typing import Any

class FlowArchitectAgent:
    def __init__(self):
        self.client = anthropic.Anthropic()
        self.messages: list[dict] = []
        self.current_flow: dict | None = None

    def chat(self, user_message: str) -> tuple[str, dict | None]:
        """
        Process a user message and return response.

        Returns:
            (response_text, created_flow_or_none)
        """
        # Add user message to history
        self.messages.append({
            "role": "user",
            "content": user_message
        })

        # Call Claude
        response = self._call_claude()

        # Process response (may involve tool calls)
        result_text, flow = self._process_response(response)

        if flow:
            self.current_flow = flow

        return result_text, flow

    def _call_claude(self) -> anthropic.types.Message:
        """Make API call to Claude."""
        return self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=self.messages
        )

    def _process_response(self, response) -> tuple[str, dict | None]:
        """Process Claude's response, handling any tool calls."""

        # Check if Claude wants to use a tool
        if response.stop_reason == "tool_use":
            return self._handle_tool_use(response)

        # Otherwise, extract text response
        text = self._extract_text(response)
        self.messages.append({
            "role": "assistant",
            "content": response.content
        })
        return text, None

    def _handle_tool_use(self, response) -> tuple[str, dict | None]:
        """Handle tool use and get final response."""

        # Find tool use blocks
        tool_uses = [b for b in response.content if b.type == "tool_use"]

        created_flow = None
        tool_results = []

        for tool_use in tool_uses:
            result, flow = handle_tool_call(tool_use.name, tool_use.input)
            if flow:
                created_flow = flow
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_use.id,
                "content": result
            })

        # Add assistant response and tool results to history
        self.messages.append({
            "role": "assistant",
            "content": response.content
        })
        self.messages.append({
            "role": "user",
            "content": tool_results
        })

        # Get Claude's follow-up response
        follow_up = self._call_claude()
        final_text = self._extract_text(follow_up)

        self.messages.append({
            "role": "assistant",
            "content": follow_up.content
        })

        return final_text, created_flow

    def _extract_text(self, response) -> str:
        """Extract text content from response."""
        return "".join(
            block.text for block in response.content
            if hasattr(block, 'text')
        )

    def reset(self):
        """Clear conversation history."""
        self.messages = []
        self.current_flow = None
```

---

## Testing the Agent

```python
# Quick test script
import asyncio

async def test_agent():
    agent = FlowArchitectAgent()

    # Test 1: Initial request
    response, flow = agent.chat(
        "I want to create a flow where 3 AI models brainstorm startup ideas"
    )
    print("Response 1:", response)
    print("Flow:", flow)

    # Test 2: Refinement
    response, flow = agent.chat(
        "Make it 2 rounds and use Claude, GPT, and Gemini"
    )
    print("Response 2:", response)
    print("Flow:", flow)

    # Test 3: Create
    response, flow = agent.chat("Looks good, create it")
    print("Response 3:", response)
    print("Flow:", flow)

if __name__ == "__main__":
    asyncio.run(test_agent())
```

---

## Tasks Checklist

- [ ] Create `lib/agent.py`
- [ ] Define SYSTEM_PROMPT
- [ ] Define TOOLS schema
- [ ] Create `lib/tools.py` with handlers
- [ ] Implement FlowArchitectAgent class
- [ ] Handle tool use loop correctly
- [ ] Test agent standalone (without UI)
- [ ] Verify multi-turn conversation works
- [ ] Test flow creation end-to-end
