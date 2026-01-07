# Research: Phase 0.4 - Flow Display

## Goal
Display and allow editing of flow configuration created by the agent.

---

## What to Display

When Claude creates a flow, show:
1. **Name & Description**
2. **Flow Type** (basic/leading)
3. **Rounds** (editable)
4. **Models** (editable multi-select)
5. **Leader** (for leading flows, editable)
6. **Prompts** (editable text areas)
7. **Settings** (temperature, etc.)

---

## Streamlit Components

```python
def render_flow(flow: dict):
    """Render flow configuration with editing."""

    st.markdown(f"### {flow['name']}")
    st.caption(flow.get('description', ''))

    # Type badge
    flow_type = flow['flow_type']
    if flow_type == 'basic':
        st.info("🔄 Basic Flow (Round-Robin)")
    else:
        st.info("👑 Leading Flow (Hub-and-Spoke)")

    # Editable settings
    col1, col2 = st.columns(2)

    with col1:
        new_rounds = st.slider(
            "Rounds",
            min_value=2,
            max_value=6,
            value=flow['max_rounds'],
            key="flow_rounds"
        )
        flow['max_rounds'] = new_rounds

    with col2:
        new_models = st.multiselect(
            "Models",
            options=["anthropic", "openai", "gemini", "grok"],
            default=flow['models'],
            key="flow_models"
        )
        flow['models'] = new_models

    # Leader (for leading flows)
    if flow_type == 'leading':
        flow['default_leader'] = st.selectbox(
            "Leader",
            options=flow['models'],
            index=flow['models'].index(flow.get('default_leader', flow['models'][0])),
            key="flow_leader"
        )

    # Prompts in expanders
    st.markdown("#### Prompts")

    with st.expander("Round 1 Prompt", expanded=False):
        flow['prompts']['round_1'] = st.text_area(
            "Initial prompt",
            value=flow['prompts']['round_1'],
            height=150,
            key="prompt_round1",
            label_visibility="collapsed"
        )

    with st.expander("Refinement Prompt", expanded=False):
        flow['prompts']['refinement'] = st.text_area(
            "Refinement prompt",
            value=flow['prompts']['refinement'],
            height=150,
            key="prompt_refinement",
            label_visibility="collapsed"
        )

    if flow_type == 'leading' and flow['prompts'].get('leader_synthesis'):
        with st.expander("Leader Synthesis Prompt", expanded=False):
            flow['prompts']['leader_synthesis'] = st.text_area(
                "Synthesis prompt",
                value=flow['prompts']['leader_synthesis'],
                height=150,
                key="prompt_synthesis",
                label_visibility="collapsed"
            )

    # Advanced settings
    with st.expander("Advanced Settings", expanded=False):
        flow['temperature'] = st.slider(
            "Temperature",
            min_value=0.0,
            max_value=1.0,
            value=flow.get('temperature', 0.7),
            step=0.1,
            key="flow_temp"
        )
        flow['max_tokens'] = st.number_input(
            "Max tokens per response",
            min_value=100,
            max_value=4000,
            value=flow.get('max_tokens', 1000),
            key="flow_tokens"
        )

    return flow
```

---

## Visual Flow Diagram

Optional: Show a visual representation of the flow:

```python
def render_flow_diagram(flow: dict):
    """Show a simple visual of the flow pattern."""

    if flow['flow_type'] == 'basic':
        st.markdown("""
        ```
        Round 1: All models brainstorm independently
            ↓
        Round 2+: Each sees peers, refines own work
            ↓
        Output: Multiple refined perspectives
        ```
        """)
    else:
        leader = flow.get('default_leader', 'Leader')
        st.markdown(f"""
        ```
        Round 1: All models ideate
            ↓
        Round 2: {leader} synthesizes
            ↓
        Round 3: Others respond to synthesis
            ↓
        Round 4: {leader} final synthesis
        ```
        """)
```

---

## JSON/YAML View

Let users see the raw config:

```python
with st.expander("View Raw Config"):
    tab1, tab2 = st.tabs(["JSON", "YAML"])
    with tab1:
        st.json(flow)
    with tab2:
        import yaml
        st.code(yaml.dump(flow, default_flow_style=False), language="yaml")
```

---

## Tasks Checklist

- [ ] Create `components/flow_display.py`
- [ ] Implement `render_flow()` function
- [ ] Add editable rounds slider
- [ ] Add editable models multiselect
- [ ] Add editable leader select (leading flows)
- [ ] Add expandable prompt editors
- [ ] Add advanced settings
- [ ] Add raw JSON/YAML view
- [ ] Test editing updates session state
