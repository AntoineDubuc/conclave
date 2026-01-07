# Research: Phase 0.8 - Integration & Polish

## Goal
Wire all components together into a cohesive Streamlit application.

---

## Main App Structure

```python
# app.py

import streamlit as st
from lib.agent import FlowArchitectAgent
from lib.executor import FlowExecutor
from components.sidebar import render_sidebar
from components.chat import render_chat
from components.flow_display import render_flow
from components.results import render_results

# Page config
st.set_page_config(
    page_title="Conclave Flow Architect",
    page_icon="🔮",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize session state
def init_session_state():
    if "agent" not in st.session_state:
        st.session_state.agent = FlowArchitectAgent()
    if "messages" not in st.session_state:
        st.session_state.messages = []
    if "current_flow" not in st.session_state:
        st.session_state.current_flow = None
    if "flow_results" not in st.session_state:
        st.session_state.flow_results = None
    if "api_keys" not in st.session_state:
        st.session_state.api_keys = {}

init_session_state()

# Sidebar: API Keys
api_keys = render_sidebar()
st.session_state.api_keys = api_keys

# Main layout
col1, col2 = st.columns([1, 1])

with col1:
    st.header("💬 Chat with Flow Architect")
    render_chat()

with col2:
    # Show flow config if exists
    if st.session_state.current_flow:
        st.header("📋 Flow Configuration")
        flow = render_flow(st.session_state.current_flow)
        st.session_state.current_flow = flow  # Update with edits

        # Run button
        if st.button("🚀 Run Flow", type="primary", use_container_width=True):
            run_flow()

    # Show results if exists
    if st.session_state.flow_results:
        st.header("📊 Results")
        render_results(st.session_state.flow_results)


def run_flow():
    """Execute the current flow configuration."""

    flow = st.session_state.current_flow
    keys = st.session_state.api_keys

    # Validate we have required keys
    required_models = flow.get("models", [])
    missing = [m for m in required_models if not keys.get(m) and not keys.get("openrouter")]

    if missing:
        st.error(f"Missing API keys for: {', '.join(missing)}")
        return

    with st.spinner("Running flow..."):
        executor = FlowExecutor(keys)
        results = executor.run(flow)
        st.session_state.flow_results = results

    st.success("Flow completed!")
    st.rerun()
```

---

## Component Integration

### Chat → Flow Creation

```python
# In components/chat.py

def handle_message(user_message: str):
    """Process user message through agent."""

    agent = st.session_state.agent

    # Get response from Claude
    response_text, created_flow = agent.chat(user_message)

    # If a flow was created, update session state
    if created_flow:
        st.session_state.current_flow = created_flow

    return response_text
```

### Flow Editor → Validation

```python
# In components/flow_display.py

def render_flow(flow: dict) -> dict:
    """Render and allow editing flow config."""

    # ... editing UI ...

    # Validate on change
    if not validate_flow(flow):
        st.error("Invalid flow configuration")

    return flow


def validate_flow(flow: dict) -> bool:
    """Validate flow configuration."""

    errors = []

    if not flow.get("name"):
        errors.append("Flow must have a name")

    if not flow.get("models") or len(flow["models"]) < 2:
        errors.append("Need at least 2 models")

    if flow.get("flow_type") == "leading":
        if not flow.get("default_leader"):
            errors.append("Leading flow needs a leader")
        elif flow["default_leader"] not in flow["models"]:
            errors.append("Leader must be one of the selected models")

    rounds = flow.get("max_rounds", 0)
    if not (2 <= rounds <= 6):
        errors.append("Rounds must be 2-6")

    if errors:
        for e in errors:
            st.warning(e)
        return False

    return True
```

---

## State Flow Diagram

```
User Message
     ↓
FlowArchitectAgent.chat()
     ↓
Claude API (with tools)
     ↓
Tool Call? ──No──→ Text Response → Display
     │
    Yes
     ↓
preview_flow/create_flow
     ↓
Update st.session_state.current_flow
     ↓
render_flow() shows editable config
     ↓
User clicks "Run Flow"
     ↓
FlowExecutor.run()
     ↓
Update st.session_state.flow_results
     ↓
render_results() shows output
```

---

## Error Handling

```python
# Global error handler wrapper

def safe_agent_call(func):
    """Decorator for handling API errors gracefully."""

    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except anthropic.APIConnectionError:
            st.error("❌ Cannot connect to Anthropic API. Check your internet connection.")
            return None, None
        except anthropic.AuthenticationError:
            st.error("❌ Invalid Anthropic API key. Check your API key in the sidebar.")
            return None, None
        except anthropic.RateLimitError:
            st.error("⏳ Rate limit exceeded. Please wait a moment and try again.")
            return None, None
        except Exception as e:
            st.error(f"❌ Unexpected error: {str(e)}")
            return None, None

    return wrapper
```

---

## User Prompt Input

```python
# Main prompt for the flow

def render_user_prompt_input():
    """Render input for the actual task/question to send to the flow."""

    st.markdown("### Your Task")
    st.caption("What do you want the AI models to work on?")

    user_prompt = st.text_area(
        "Enter your prompt",
        placeholder="e.g., Brainstorm 5 startup ideas in the health tech space...",
        height=150,
        key="user_task_prompt",
        label_visibility="collapsed"
    )

    return user_prompt
```

---

## Reset Functionality

```python
def render_reset_buttons():
    """Buttons to reset various parts of the app."""

    col1, col2, col3 = st.columns(3)

    with col1:
        if st.button("🔄 New Chat"):
            st.session_state.agent.reset()
            st.session_state.messages = []
            st.rerun()

    with col2:
        if st.button("🗑️ Clear Flow"):
            st.session_state.current_flow = None
            st.rerun()

    with col3:
        if st.button("📊 Clear Results"):
            st.session_state.flow_results = None
            st.rerun()
```

---

## Final Directory Structure

```
conclave_ui/poc/phase_0/
├── app.py                 # Main Streamlit app
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .env.example
├── lib/
│   ├── __init__.py
│   ├── agent.py          # FlowArchitectAgent
│   ├── tools.py          # Tool handlers
│   └── executor.py       # Flow execution
├── components/
│   ├── __init__.py
│   ├── sidebar.py        # API key management
│   ├── chat.py           # Chat interface
│   ├── flow_display.py   # Flow editor
│   └── results.py        # Results display
└── research/             # This folder (reference only)
```

---

## Polish Items

- [ ] Add custom CSS for better styling
- [ ] Add loading animations
- [ ] Add keyboard shortcuts (Enter to send)
- [ ] Add session persistence (optional)
- [ ] Add flow template quick-select
- [ ] Add export/import flow configs
- [ ] Add copy-to-clipboard for results
- [ ] Mobile-responsive layout

---

## Testing Checklist

- [ ] Create flow via chat conversation
- [ ] Edit flow settings manually
- [ ] Run flow with valid API keys
- [ ] Handle missing API keys gracefully
- [ ] Handle API errors gracefully
- [ ] Download results as JSON
- [ ] Download results as Markdown
- [ ] Reset chat and start new flow
- [ ] Leading flow with synthesis works
- [ ] Basic flow round-robin works

---

## Tasks Checklist

- [ ] Create main `app.py` with layout
- [ ] Wire all components together
- [ ] Add global error handling
- [ ] Add user prompt input for flow execution
- [ ] Add reset buttons
- [ ] Add validation on flow changes
- [ ] Test end-to-end flow
- [ ] Docker build and run successfully
- [ ] Document usage in README
