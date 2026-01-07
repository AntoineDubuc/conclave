# Phase Zero: Proof of Concept Implementation Plan

## Executive Summary

**Goal:** Prove that a user can chat with Claude via a web interface, design a multi-LLM collaboration flow through conversation, and execute that flow against real LLMs—all running locally in Docker.

**Tech Stack:** Python + Streamlit + Anthropic SDK (with tool_use) + Conclave Python engine

**Success Criteria:**
1. User opens browser, sees chat interface
2. User describes a flow in natural language
3. Claude creates the flow (config + prompts)
4. User triggers execution
5. Flow runs against multiple LLMs (via user's API keys or OpenRouter)
6. User sees results

**Not in Scope:**
- User authentication
- Database/persistence
- Production deployment
- Real-time streaming
- Billing/payments

---

## Key Research Decisions

### SDK Choice: Anthropic SDK (not Agent SDK)

From `research/00_SDK_DECISION.md`:

| Factor | Anthropic SDK | Agent SDK |
|--------|---------------|-----------|
| Setup | `pip install anthropic` | Needs Claude Code runtime |
| Docker | Lightweight | Heavy dependencies |
| Tools | Define JSON schemas | MCP server setup |
| Control | Full control over tool loop | Automatic tool execution |
| Fit | Perfect for 3 simple tools | Overkill for our use case |

**Decision:** Use Anthropic SDK with manual tool loop for Phase Zero.

### Conclave Integration: UI-Specific Executor

From `research/06_FLOW_EXECUTION.md`:

Rather than modifying Conclave's CLI-oriented engines, we create a simplified executor that:
1. Uses Conclave's provider factory and types
2. Implements flow logic directly (basic + leading)
3. Returns structured results (not file output)
4. Supports progress callbacks for UI updates

### Docker Strategy: Volume Mount

From `research/01_PROJECT_SETUP.md`:

Mount Conclave as a volume for development speed:
```yaml
volumes:
  - ../../conclave_cli/python/conclave:/app/conclave
```

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Container                          │
│                    (Port 8501)                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Streamlit App (app.py)                  │    │
│  │                                                      │    │
│  │  ┌─────────────┐  ┌────────────────────────────┐    │    │
│  │  │   Sidebar   │  │       Main Area            │    │    │
│  │  │             │  │                            │    │    │
│  │  │ • API Keys  │  │  col1: Chat Interface      │    │    │
│  │  │ • Status    │  │  col2: Flow Config/Results │    │    │
│  │  │             │  │                            │    │    │
│  │  └─────────────┘  └────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              FlowArchitectAgent                      │    │
│  │              (lib/agent.py)                          │    │
│  │                                                      │    │
│  │  - Anthropic SDK with tool_use                       │    │
│  │  - Manual tool loop (while stop_reason=="tool_use")  │    │
│  │  - Tools: preview_flow, create_flow, list_templates  │    │
│  │  - Maintains conversation history in self.messages   │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              FlowExecutor                            │    │
│  │              (lib/executor.py)                       │    │
│  │                                                      │    │
│  │  - Creates providers from user API keys              │    │
│  │  - Runs basic flow (parallel + peer review)          │    │
│  │  - Runs leading flow (leader synthesis pattern)      │    │
│  │  - Returns FlowResults dataclass                     │    │
│  │  - Supports OpenRouter (single key for all models)   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## State Flow

From `research/08_INTEGRATION.md`:

```
User Message
     ↓
FlowArchitectAgent.chat()
     ↓
Claude API (with tools)
     ↓
Tool Call? ──No──→ Text Response → Display in chat
     │
    Yes
     ↓
preview_flow/create_flow/list_templates
     ↓
Update st.session_state.current_flow
     ↓
render_flow() shows editable config
     ↓
User edits (optional) and clicks "Run Flow"
     ↓
FlowExecutor.run(flow, api_keys)
     ↓
Update st.session_state.flow_results
     ↓
render_results() shows output with download options
```

---

## File Structure

```
conclave_ui/poc/phase_0/
├── app.py                      # Main Streamlit application
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .env.example
├── .gitignore
├── README.md
│
├── lib/
│   ├── __init__.py
│   ├── agent.py                # FlowArchitectAgent class
│   ├── tools.py                # Tool definitions and handlers
│   ├── executor.py             # Flow execution engine
│   └── openrouter.py           # OpenRouter provider
│
├── components/
│   ├── __init__.py
│   ├── sidebar.py              # API key inputs + status
│   ├── chat.py                 # Chat message display + input
│   ├── flow_display.py         # Flow config editor
│   └── results.py              # Results viewer + export
│
└── research/                   # Research docs (reference only)
    ├── 00_SDK_DECISION.md
    ├── 01_PROJECT_SETUP.md
    ├── 02_CHAT_UI.md
    ├── 03_AGENT_TOOLS.md
    ├── 04_FLOW_DISPLAY.md
    ├── 05_API_KEYS.md
    ├── 06_FLOW_EXECUTION.md
    ├── 07_RESULTS_DISPLAY.md
    └── 08_INTEGRATION.md
```

---

## Dependencies

### requirements.txt

```
# Core framework
streamlit>=1.30.0

# Claude agent (Flow Architect)
anthropic>=0.40.0

# LLM providers for flow execution
openai>=1.0.0              # Also used for OpenRouter
google-generativeai>=0.3.0

# Conclave dependencies
pydantic>=2.0.0
pyyaml>=6.0
rich>=13.0.0

# Utilities
python-dotenv>=1.0.0
```

---

## Docker Configuration

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# System dependencies (curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Streamlit port
EXPOSE 8501

# Health check
HEALTHCHECK CMD curl --fail http://localhost:8501/_stcore/health

# Run with hot reload
CMD ["streamlit", "run", "app.py", "--server.address", "0.0.0.0", "--server.runOnSave", "true"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8501:8501"
    volumes:
      # Hot reload for development
      - .:/app
      # Mount Conclave Python package
      - ../../conclave_cli/python/conclave:/app/conclave
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    env_file:
      - .env
```

---

## Core Components

### FlowArchitectAgent (lib/agent.py)

From `research/00_SDK_DECISION.md` and `research/03_AGENT_TOOLS.md`:

```python
import anthropic
from lib.tools import TOOLS, handle_tool_call

SYSTEM_PROMPT = """You are a Flow Architect for a multi-LLM collaboration platform.

Your role is to help users design flows where multiple AI models work together.

## Flow Patterns

**Basic (Round-Robin):**
All models respond independently, then see each other's work and refine.
Best for: brainstorming, code review, getting diverse perspectives.

**Leading (Hub-and-Spoke):**
One model leads and synthesizes contributions from all others.
Best for: architecture docs, final reports, unified deliverables.

## Available Models

- **anthropic** (Claude): Strong reasoning, nuanced analysis
- **openai** (GPT): Broad knowledge, good at following formats
- **gemini** (Google): Strong analytical capabilities
- **grok** (xAI): Real-time knowledge, unique perspectives

## Your Tools

- `preview_flow`: Show a flow structure before creating it
- `create_flow`: Finalize a flow configuration (only after user approves preview)
- `list_templates`: Show available templates

## Your Approach

1. Understand the user's goal - ask clarifying questions if needed
2. Recommend a pattern and explain why
3. Propose structure: rounds (typically 2-3), models, prompts
4. Use preview_flow to show the user
5. Iterate based on feedback
6. Use create_flow when user is happy

Be conversational but efficient. Default to 2-3 rounds and 3 models unless specified."""


class FlowArchitectAgent:
    def __init__(self, api_key: str = None):
        self.client = anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()
        self.messages = []
        self.current_flow = None

    def chat(self, user_message: str) -> tuple[str, dict | None]:
        """Process user message and return (response_text, flow_if_created)."""

        self.messages.append({"role": "user", "content": user_message})

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=self.messages
        )

        # Handle tool use loop
        flow_created = None

        while response.stop_reason == "tool_use":
            tool_uses = [b for b in response.content if b.type == "tool_use"]
            tool_results = []

            for tool_use in tool_uses:
                result, flow = handle_tool_call(tool_use.name, tool_use.input)
                if flow:
                    flow_created = flow
                    self.current_flow = flow
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use.id,
                    "content": result
                })

            # Add to conversation history
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

    def reset(self):
        """Clear conversation history."""
        self.messages = []
        self.current_flow = None
```

### Tool Definitions (lib/tools.py)

From `research/03_AGENT_TOOLS.md`:

```python
TOOLS = [
    {
        "name": "preview_flow",
        "description": "Show the user a preview of a flow configuration. Always use this before create_flow.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Short name for the flow"},
                "description": {"type": "string", "description": "One sentence description"},
                "flow_type": {
                    "type": "string",
                    "enum": ["basic", "leading"],
                    "description": "basic = round-robin, leading = hub-and-spoke"
                },
                "max_rounds": {
                    "type": "integer",
                    "minimum": 2,
                    "maximum": 6,
                    "description": "Number of rounds (typically 2-3)"
                },
                "models": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["anthropic", "openai", "gemini", "grok"]},
                    "minItems": 2,
                    "description": "Which models to include"
                },
                "default_leader": {
                    "type": "string",
                    "enum": ["anthropic", "openai", "gemini", "grok"],
                    "description": "For leading flows, which model synthesizes"
                },
                "prompts": {
                    "type": "object",
                    "properties": {
                        "round_1": {"type": "string", "description": "Initial prompt"},
                        "refinement": {"type": "string", "description": "Refinement round prompt"},
                        "leader_synthesis": {"type": "string", "description": "For leading flows"}
                    },
                    "required": ["round_1", "refinement"]
                }
            },
            "required": ["name", "description", "flow_type", "max_rounds", "models", "prompts"]
        }
    },
    {
        "name": "create_flow",
        "description": "Finalize and create a flow. Only use AFTER user approves a preview.",
        "input_schema": {
            # Same schema as preview_flow
        }
    },
    {
        "name": "list_templates",
        "description": "List available flow templates",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }
]


def handle_tool_call(name: str, input: dict) -> tuple[str, dict | None]:
    """Execute tool and return (result_text, flow_if_created)."""

    if name == "preview_flow":
        return format_preview(input), None
    elif name == "create_flow":
        validated = validate_flow(input)
        return f"✅ Flow '{validated['name']}' created!", validated
    elif name == "list_templates":
        return get_templates_text(), None
    return "Unknown tool", None


def format_preview(flow: dict) -> str:
    """Format flow as readable preview."""
    lines = [
        f"## {flow['name']}",
        f"*{flow.get('description', '')}*",
        "",
        f"**Type:** {flow['flow_type']} ({'all models equal' if flow['flow_type'] == 'basic' else 'leader synthesizes'})",
        f"**Rounds:** {flow['max_rounds']}",
        f"**Models:** {', '.join(flow['models'])}",
    ]
    if flow.get('default_leader'):
        lines.append(f"**Leader:** {flow['default_leader']}")

    lines.extend(["", "### Prompts", ""])
    prompts = flow.get('prompts', {})
    if prompts.get('round_1'):
        lines.append(f"**Round 1:** {prompts['round_1'][:200]}...")
    if prompts.get('refinement'):
        lines.append(f"**Refinement:** {prompts['refinement'][:200]}...")
    if prompts.get('leader_synthesis'):
        lines.append(f"**Synthesis:** {prompts['leader_synthesis'][:200]}...")

    lines.extend(["", "---", "*Reply to adjust, or say 'create it' to finalize.*"])
    return "\n".join(lines)


def validate_flow(flow: dict) -> dict:
    """Validate flow config."""
    assert flow.get('name'), "Flow must have a name"
    assert flow.get('flow_type') in ('basic', 'leading'), "Invalid flow type"
    assert 2 <= flow.get('max_rounds', 0) <= 6, "Rounds must be 2-6"
    assert len(flow.get('models', [])) >= 2, "Need at least 2 models"

    if flow['flow_type'] == 'leading' and not flow.get('default_leader'):
        flow['default_leader'] = flow['models'][0]

    return flow


def get_templates_text() -> str:
    """Return formatted templates list."""
    templates = [
        ("brainstorm", "basic", "Democratic brainstorming with peer refinement"),
        ("architecture", "leading", "Architecture design with lead synthesizer"),
        ("code-review", "basic", "Multi-model code review and cross-validation"),
        ("debate", "basic", "Models argue different positions"),
    ]
    lines = ["## Available Templates", ""]
    for name, ftype, desc in templates:
        lines.append(f"### {name} ({ftype})")
        lines.append(f"*{desc}*")
        lines.append("")
    lines.append("Say 'use [template name]' to start from one of these.")
    return "\n".join(lines)
```

### Flow Executor (lib/executor.py)

From `research/06_FLOW_EXECUTION.md`:

```python
import asyncio
from dataclasses import dataclass
from typing import Callable

@dataclass
class RoundResult:
    round_num: int
    model: str
    content: str

@dataclass
class FlowResults:
    flow_name: str
    flow_type: str
    rounds: list[RoundResult]
    final_synthesis: str | None = None


async def execute_flow(
    flow_config: dict,
    api_keys: dict,
    progress_callback: Callable[[str], None] = None
) -> FlowResults:
    """Execute a flow and return results."""

    providers = create_providers(flow_config['models'], api_keys)

    if flow_config['flow_type'] == 'basic':
        return await run_basic_flow(flow_config, providers, progress_callback)
    else:
        return await run_leading_flow(flow_config, providers, progress_callback)


async def run_basic_flow(flow, providers, progress_cb) -> FlowResults:
    """Run basic (round-robin) flow."""
    results = FlowResults(flow['name'], 'basic', [])
    round_outputs = {}

    # Round 1: Independent
    if progress_cb:
        progress_cb("Round 1: Brainstorming...")

    round_outputs[1] = {}
    tasks = [p.generate(flow['prompts']['round_1']) for p in providers]
    outputs = await asyncio.gather(*tasks)

    for provider, output in zip(providers, outputs):
        round_outputs[1][provider.name] = output
        results.rounds.append(RoundResult(1, provider.name, output))

    # Round 2+: Refinement with peer review
    for round_num in range(2, flow['max_rounds'] + 1):
        if progress_cb:
            progress_cb(f"Round {round_num}: Refinement...")

        round_outputs[round_num] = {}
        prev = round_outputs[round_num - 1]

        tasks = []
        for provider in providers:
            peer_outputs = "\n\n".join(
                f"[{p.name}]\n{prev[p.name]}"
                for p in providers if p.name != provider.name
            )
            prompt = f"""{flow['prompts']['refinement']}

Your previous response:
{prev[provider.name]}

Peer responses:
{peer_outputs}

Provide your refined response:"""
            tasks.append(provider.generate(prompt))

        outputs = await asyncio.gather(*tasks)

        for provider, output in zip(providers, outputs):
            round_outputs[round_num][provider.name] = output
            results.rounds.append(RoundResult(round_num, provider.name, output))

    return results
```

### OpenRouter Provider (lib/openrouter.py)

From `research/06_FLOW_EXECUTION.md`:

```python
from openai import AsyncOpenAI

OPENROUTER_MODELS = {
    "anthropic": "anthropic/claude-3.5-sonnet",
    "openai": "openai/gpt-4-turbo",
    "gemini": "google/gemini-pro-1.5",
    "grok": "x-ai/grok-beta",
}


class OpenRouterProvider:
    def __init__(self, name: str, api_key: str):
        self.name = name
        self.client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
        )
        self.model = OPENROUTER_MODELS.get(name.lower(), name)

    async def generate(self, prompt: str) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content
```

---

## UI Components

### Sidebar (components/sidebar.py)

From `research/05_API_KEYS.md`:

```python
import streamlit as st
import os

def render_sidebar() -> dict:
    """Render sidebar with API key inputs. Returns dict of keys."""

    st.sidebar.title("⚙️ Settings")
    st.sidebar.header("API Keys")

    api_keys = {}

    # OpenRouter option
    use_openrouter = st.sidebar.checkbox(
        "Use OpenRouter (single key for all models)",
        help="OpenRouter provides access to multiple models with one API key"
    )

    if use_openrouter:
        api_keys["openrouter"] = st.sidebar.text_input(
            "OpenRouter API Key",
            type="password",
            key="key_openrouter"
        )
        st.sidebar.caption("Get a key at [openrouter.ai](https://openrouter.ai)")
    else:
        with st.sidebar.expander("Provider Keys", expanded=True):
            api_keys["anthropic"] = st.text_input(
                "Anthropic", type="password", key="key_anthropic", placeholder="sk-ant-..."
            )
            api_keys["openai"] = st.text_input(
                "OpenAI", type="password", key="key_openai", placeholder="sk-..."
            )
            api_keys["gemini"] = st.text_input(
                "Google Gemini", type="password", key="key_gemini", placeholder="AI..."
            )
            api_keys["grok"] = st.text_input(
                "xAI (Grok)", type="password", key="key_grok", placeholder="xai-..."
            )

    # Merge with environment variables
    api_keys = merge_with_env(api_keys)

    # Status display
    st.sidebar.markdown("---")
    st.sidebar.subheader("Status")

    if use_openrouter and api_keys.get("openrouter"):
        st.sidebar.success("✅ OpenRouter configured")
    else:
        configured = [k for k, v in api_keys.items() if v and k != "openrouter"]
        if configured:
            st.sidebar.success(f"✅ {', '.join(configured)}")
        else:
            st.sidebar.warning("⚠️ No API keys configured")

    return api_keys


def merge_with_env(user_keys: dict) -> dict:
    """Merge user keys with environment variables (user takes priority)."""
    env_map = {
        "anthropic": "ANTHROPIC_API_KEY",
        "openai": "OPENAI_API_KEY",
        "gemini": "GEMINI_API_KEY",
        "grok": "XAI_API_KEY",
        "openrouter": "OPENROUTER_API_KEY",
    }

    for key_name, env_var in env_map.items():
        if not user_keys.get(key_name):
            user_keys[key_name] = os.environ.get(env_var, "")

    return user_keys
```

### Results Display (components/results.py)

From `research/07_RESULTS_DISPLAY.md`:

```python
import streamlit as st
import json

MODEL_COLORS = {
    "anthropic": "#D97706",  # Orange
    "openai": "#10B981",     # Green
    "gemini": "#3B82F6",     # Blue
    "grok": "#EF4444",       # Red
}


def render_results(results):
    """Render flow execution results."""

    st.markdown(f"### Results: {results.flow_name}")

    # Group by round
    rounds = {}
    for r in results.rounds:
        if r.round_num not in rounds:
            rounds[r.round_num] = []
        rounds[r.round_num].append(r)

    # Display each round
    for round_num in sorted(rounds.keys()):
        round_results = rounds[round_num]
        is_last = round_num == max(rounds.keys())

        with st.expander(f"Round {round_num}", expanded=is_last):
            tabs = st.tabs([r.model for r in round_results])

            for tab, result in zip(tabs, round_results):
                with tab:
                    st.markdown(result.content)

    # Final synthesis (for leading flows)
    if results.final_synthesis:
        st.markdown("---")
        st.markdown("### 📝 Final Synthesis")
        st.markdown(results.final_synthesis)

    # Export options
    st.markdown("---")
    col1, col2 = st.columns(2)

    with col1:
        json_str = json.dumps({
            "flow_name": results.flow_name,
            "flow_type": results.flow_type,
            "rounds": [
                {"round": r.round_num, "model": r.model, "content": r.content}
                for r in results.rounds
            ]
        }, indent=2)

        st.download_button(
            "📥 Download JSON",
            data=json_str,
            file_name=f"{results.flow_name}-results.json",
            mime="application/json"
        )

    with col2:
        md_content = format_as_markdown(results)
        st.download_button(
            "📥 Download Markdown",
            data=md_content,
            file_name=f"{results.flow_name}-results.md",
            mime="text/markdown"
        )


def format_as_markdown(results) -> str:
    """Format results as markdown document."""
    lines = [
        f"# {results.flow_name} Results",
        f"*Flow type: {results.flow_type}*",
        "",
    ]

    rounds = {}
    for r in results.rounds:
        if r.round_num not in rounds:
            rounds[r.round_num] = []
        rounds[r.round_num].append(r)

    for round_num in sorted(rounds.keys()):
        lines.append(f"## Round {round_num}")
        lines.append("")
        for result in rounds[round_num]:
            lines.append(f"### {result.model}")
            lines.append("")
            lines.append(result.content)
            lines.append("")

    if results.final_synthesis:
        lines.append("## Final Synthesis")
        lines.append("")
        lines.append(results.final_synthesis)

    return "\n".join(lines)
```

---

## Task List

### Phase 0.1: Project Setup

- [ ] Create `conclave_ui/poc/phase_0/` directory structure
- [ ] Create `requirements.txt` with all dependencies
- [ ] Create `Dockerfile`
- [ ] Create `docker-compose.yml` with Conclave volume mount
- [ ] Create `.env.example` with required variables
- [ ] Create `.gitignore`
- [ ] Create minimal `app.py` with "Hello World"
- [ ] Test `docker-compose build && docker-compose up`
- [ ] Verify Conclave imports work: `from conclave.core.types import FlowConfig`
- [ ] Verify hot reload works

**Deliverable:** Empty Streamlit app at localhost:8501

---

### Phase 0.2: Chat UI

- [ ] Set up page config (title, icon, wide layout)
- [ ] Initialize session state: `messages`, `agent`, `current_flow`, `flow_results`
- [ ] Create two-column layout (chat + flow/results)
- [ ] Implement chat message display using `st.chat_message`
- [ ] Implement chat input using `st.chat_input`
- [ ] Add welcome message with example prompts
- [ ] Add spinner during API calls
- [ ] Test basic message display (hardcoded responses)

**Deliverable:** Working chat UI (not connected to Claude yet)

---

### Phase 0.3: Claude Agent with Tools

- [ ] Create `lib/__init__.py`
- [ ] Create `lib/agent.py` with FlowArchitectAgent class
- [ ] Define SYSTEM_PROMPT for Flow Architect
- [ ] Create `lib/tools.py` with TOOLS schema
- [ ] Implement `handle_tool_call()` function
- [ ] Implement `preview_flow` handler with formatting
- [ ] Implement `create_flow` handler with validation
- [ ] Implement `list_templates` handler
- [ ] Implement tool loop in agent (while stop_reason == "tool_use")
- [ ] Connect chat UI to agent
- [ ] Test: describe flow → Claude proposes → user approves → flow created

**Deliverable:** User can create flows through conversation

---

### Phase 0.4: Flow Display

- [ ] Create `components/__init__.py`
- [ ] Create `components/flow_display.py`
- [ ] Show flow name, description, type badge
- [ ] Add rounds slider (2-6)
- [ ] Add models multiselect
- [ ] Add leader select (for leading flows)
- [ ] Add expandable prompt editors
- [ ] Add advanced settings (temperature, max_tokens)
- [ ] Add raw JSON view in expander
- [ ] Test editing updates `st.session_state.current_flow`

**Deliverable:** Editable flow configuration display

---

### Phase 0.5: API Key Management

- [ ] Create `components/sidebar.py`
- [ ] Add OpenRouter toggle checkbox
- [ ] Add OpenRouter key input (when toggled)
- [ ] Add individual provider key inputs (when not toggled)
- [ ] Implement env var fallback
- [ ] Show configuration status (checkmarks)
- [ ] Store keys in `st.session_state.api_keys`
- [ ] Test keys are correctly merged with env vars

**Deliverable:** Sidebar with API key management

---

### Phase 0.6: Flow Execution

- [ ] Create `lib/executor.py`
- [ ] Define `RoundResult` and `FlowResults` dataclasses
- [ ] Implement `create_providers()` from API keys
- [ ] Create `lib/openrouter.py` with OpenRouterProvider
- [ ] Implement `run_basic_flow()` (parallel + peer review)
- [ ] Implement `run_leading_flow()` (leader synthesis pattern)
- [ ] Add progress callback support
- [ ] Add "Run Flow" button in UI
- [ ] Show spinner and progress during execution
- [ ] Handle missing API keys gracefully
- [ ] Handle API errors gracefully

**Deliverable:** Flows can execute against real LLMs

---

### Phase 0.7: Results Display

- [ ] Create `components/results.py`
- [ ] Implement `render_results()` function
- [ ] Group results by round
- [ ] Add expandable sections per model
- [ ] Add model color coding
- [ ] Handle leading flow final synthesis
- [ ] Implement JSON download button
- [ ] Implement Markdown download button
- [ ] Test with real flow results

**Deliverable:** Results viewer with export

---

### Phase 0.8: Integration & Polish

- [ ] Wire all components together in `app.py`
- [ ] Add global error handling wrapper
- [ ] Add reset buttons (New Chat, Clear Flow, Clear Results)
- [ ] Add user prompt input for flow execution
- [ ] Add flow validation on edit
- [ ] End-to-end test: describe → create → run → results
- [ ] Fix discovered bugs
- [ ] Clean up styling
- [ ] Write README with setup instructions
- [ ] Document usage examples

**Deliverable:** Complete Phase Zero POC

---

## Testing Checklist

- [ ] Create flow via chat conversation
- [ ] Edit flow settings manually
- [ ] Run flow with OpenRouter key
- [ ] Run flow with individual provider keys
- [ ] Handle missing API keys gracefully
- [ ] Handle API errors gracefully
- [ ] Download results as JSON
- [ ] Download results as Markdown
- [ ] Reset chat and start new flow
- [ ] Leading flow with synthesis works
- [ ] Basic flow round-robin works
- [ ] Docker builds without errors
- [ ] Hot reload works during development

---

## Name Suggestions

| # | Name | Rationale |
|---|------|-----------|
| 1 | **Chorus** | Multiple voices harmonizing |
| 2 | **Ensemble** | Models working together like musicians |
| 3 | **Synth** | Synthesis of multiple AI perspectives |
| 4 | **Hive** | Collective intelligence |
| 5 | **Quorum** | Minimum needed for decision (multi-model consensus) |
| 6 | **Confluence** | Where streams (models) meet |
| 7 | **Mosaic** | Pieces forming a complete picture |
| 8 | **Prism** | Same input, different perspectives |
| 9 | **Polyphony** | Many voices, one composition |
| 10 | **Nexus** | Connection point between models |
| 11 | **Consilium** | Latin for "council" (like Conclave) |
| 12 | **Roundtable** | Equal voices discussing |
| 13 | **Weave** | Intertwining model outputs |
| 14 | **Lattice** | Interconnected structure |
| 15 | **Meridian** | Lines connecting points |
| 16 | **Convene** | Bringing models together |
| 17 | **Pluralis** | Latin for "plural/many" |
| 18 | **Synthesis** | Direct name for what it does |
| 19 | **Council** | Group deliberation |
| 20 | **Orchestrate** | Conducting multiple performers |

**Top 3:** Chorus, Ensemble, Quorum

---

## What's NOT in Phase Zero

- User accounts / authentication
- Persistent storage (flows lost on refresh)
- Real-time streaming of LLM responses
- Production deployment / HTTPS
- Payment / billing
- Team collaboration
- Flow history / versioning
- Advanced flow types (debate, voting)

These come in Phase 1+.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent creates invalid configs | High | Validate before execution, clear error messages |
| API keys in session state | Medium | Phase Zero only; proper storage in Phase 1 |
| Long execution times | Medium | Show progress, consider per-model timeouts |
| Streamlit state quirks | Medium | Careful session_state management, use `st.rerun()` |
| OpenRouter rate limits | Low | Show clear error, suggest waiting |

---

## Environment Variables

```bash
# .env.example

# Required: For the Flow Architect agent (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# Optional: User can also enter these via UI
OPENAI_API_KEY=
GEMINI_API_KEY=
XAI_API_KEY=

# Optional: Single key for all models
OPENROUTER_API_KEY=
```

---

## Ready to Build

All research is complete. Implementation phases are designed for incremental progress—each phase produces a working artifact.

**Research References:**
- `research/00_SDK_DECISION.md` - SDK choice rationale
- `research/01_PROJECT_SETUP.md` - Docker/Streamlit setup
- `research/02_CHAT_UI.md` - Chat components
- `research/03_AGENT_TOOLS.md` - Agent architecture
- `research/04_FLOW_DISPLAY.md` - Flow editor
- `research/05_API_KEYS.md` - Key management
- `research/06_FLOW_EXECUTION.md` - Execution engine
- `research/07_RESULTS_DISPLAY.md` - Results viewer
- `research/08_INTEGRATION.md` - Wiring together
