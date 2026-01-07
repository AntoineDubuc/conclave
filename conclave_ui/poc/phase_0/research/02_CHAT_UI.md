# Research: Phase 0.2 - Chat UI

## Goal
Build a Streamlit chat interface for conversing with the Flow Architect agent.

---

## Streamlit Chat Components

### Key APIs

```python
# Display a chat message
with st.chat_message("user"):
    st.write("Hello!")

with st.chat_message("assistant"):
    st.write("Hi there!")

# Chat input (fixed at bottom)
prompt = st.chat_input("Type your message...")
if prompt:
    # Handle new message
```

### Message Roles
- `"user"` - Shows user avatar
- `"assistant"` - Shows AI avatar
- `"ai"` - Alias for assistant
- Custom name - Shows initials

---

## Session State for Chat History

```python
# Initialize on first run
if "messages" not in st.session_state:
    st.session_state.messages = []

# Display all messages
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.write(msg["content"])

# Handle new input
if prompt := st.chat_input("Describe your flow..."):
    # Add user message
    st.session_state.messages.append({
        "role": "user",
        "content": prompt
    })

    # Display user message immediately
    with st.chat_message("user"):
        st.write(prompt)

    # Get and display assistant response
    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            response = get_response(prompt)
        st.write(response)

    # Save assistant message
    st.session_state.messages.append({
        "role": "assistant",
        "content": response
    })
```

---

## Layout Options

### Option A: Single column chat
```python
st.title("Flow Architect")
# Chat messages fill the page
for msg in messages:
    st.chat_message(msg["role"]).write(msg["content"])
st.chat_input(...)
```

### Option B: Two columns (chat + flow)
```python
col1, col2 = st.columns([1, 1])

with col1:
    st.subheader("Chat")
    # Chat UI here

with col2:
    st.subheader("Flow")
    # Flow preview here
```

### Option C: Tabs
```python
tab1, tab2 = st.tabs(["Chat", "Flow Configuration"])

with tab1:
    # Chat UI

with tab2:
    # Flow editor
```

**Decision: Option B (Two columns)** - Shows chat and flow side by side.

---

## Typing Indicator

Streamlit doesn't have a built-in typing indicator, but we can use:

```python
with st.chat_message("assistant"):
    with st.spinner("Thinking..."):
        response = agent.chat(prompt)
    st.write(response)
```

Or create a custom one:
```python
# Custom typing animation
import time

with st.chat_message("assistant"):
    placeholder = st.empty()
    for i in range(3):
        placeholder.markdown("●" * (i + 1) + "○" * (2 - i))
        time.sleep(0.3)
    placeholder.write(response)
```

---

## Rendering Tool Results

When Claude uses a tool (like `preview_flow`), we want to render it nicely:

```python
def render_message(msg):
    with st.chat_message(msg["role"]):
        st.write(msg["content"])

        # If there's a flow preview attached
        if msg.get("flow_preview"):
            with st.expander("📋 Flow Preview", expanded=True):
                render_flow_preview(msg["flow_preview"])
```

---

## Welcome Message

```python
# Show welcome only if no messages
if not st.session_state.messages:
    st.info("""
    👋 **Welcome to Flow Architect!**

    I'll help you design multi-LLM collaboration flows.

    **Try saying:**
    - "I want 3 models to brainstorm startup ideas"
    - "Create a code review flow with Claude and GPT"
    - "Help me set up a flow where one model leads"
    """)
```

---

## Auto-scroll

Streamlit auto-scrolls chat by default when using `st.chat_message`.

For manual scroll control:
```python
# At the end of chat rendering
st.markdown(
    "<div id='bottom'></div>",
    unsafe_allow_html=True
)
# JavaScript to scroll (hacky)
st.components.v1.html("""
    <script>
        document.getElementById('bottom').scrollIntoView();
    </script>
""", height=0)
```

Usually not needed - Streamlit handles this.

---

## Message Structure

For our use case:
```python
# Simple text message
{
    "role": "user" | "assistant",
    "content": "text content"
}

# Message with flow data
{
    "role": "assistant",
    "content": "Here's a preview of your flow:",
    "flow_preview": {...},  # Tool result
    "flow_created": {...}   # If flow was finalized
}
```

---

## CSS Customization

```python
st.markdown("""
<style>
    /* Make chat messages wider */
    .stChatMessage {
        max-width: 100%;
    }

    /* Custom colors for different message types */
    [data-testid="stChatMessageContent"] {
        background-color: #f0f2f6;
    }
</style>
""", unsafe_allow_html=True)
```

---

## Tasks Checklist

- [ ] Set up page config and layout
- [ ] Initialize session state for messages
- [ ] Create chat message display loop
- [ ] Add chat input component
- [ ] Add spinner during API calls
- [ ] Create welcome message
- [ ] Style chat messages
- [ ] Test basic message flow
