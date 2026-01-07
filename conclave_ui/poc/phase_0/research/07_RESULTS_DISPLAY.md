# Research: Phase 0.7 - Results Display

## Goal
Display flow execution results in a clear, organized way.

---

## Results Data Structure

```python
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
```

---

## Display Layout

### Option A: By Round
```
Round 1
├── Claude: [expandable content]
├── GPT: [expandable content]
└── Gemini: [expandable content]

Round 2
├── Claude: [expandable content]
...
```

### Option B: By Model
```
Claude
├── Round 1: [expandable]
├── Round 2: [expandable]

GPT
├── Round 1: [expandable]
...
```

### Option C: Side-by-side (for 2-3 models)
```
| Round | Claude | GPT | Gemini |
|-------|--------|-----|--------|
| 1     | ...    | ... | ...    |
| 2     | ...    | ... | ...    |
```

**Decision: Option A (By Round)** - Most intuitive for understanding flow progression.

---

## Implementation

```python
def render_results(results: FlowResults):
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

        with st.expander(f"Round {round_num}", expanded=(round_num == max(rounds.keys()))):
            tabs = st.tabs([r.model for r in round_results])

            for tab, result in zip(tabs, round_results):
                with tab:
                    st.markdown(result.content)

                    # Copy button
                    if st.button(f"📋 Copy", key=f"copy_{round_num}_{result.model}"):
                        st.write("Copied!")  # Would need JS for actual clipboard

    # Final synthesis (for leading flows)
    if results.final_synthesis:
        st.markdown("---")
        st.markdown("### 📝 Final Synthesis")
        st.markdown(results.final_synthesis)

    # Export options
    st.markdown("---")
    col1, col2 = st.columns(2)

    with col1:
        # Download as JSON
        import json
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
        # Download as Markdown
        md_content = format_results_as_markdown(results)
        st.download_button(
            "📥 Download Markdown",
            data=md_content,
            file_name=f"{results.flow_name}-results.md",
            mime="text/markdown"
        )


def format_results_as_markdown(results: FlowResults) -> str:
    """Format results as markdown document."""

    lines = [
        f"# {results.flow_name} Results",
        f"*Flow type: {results.flow_type}*",
        "",
    ]

    # Group by round
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

## Model Colors

Color-code models for visual distinction:

```python
MODEL_COLORS = {
    "anthropic": "#D97706",  # Orange/amber
    "openai": "#10B981",     # Green
    "gemini": "#3B82F6",     # Blue
    "grok": "#EF4444",       # Red
}

def get_model_badge(model: str) -> str:
    color = MODEL_COLORS.get(model.lower(), "#6B7280")
    return f'<span style="background-color: {color}; color: white; padding: 2px 8px; border-radius: 4px;">{model}</span>'
```

---

## Diff View (Optional Enhancement)

Show what changed between rounds:

```python
def render_diff(prev_content: str, curr_content: str):
    """Show diff between two versions."""
    import difflib

    diff = difflib.unified_diff(
        prev_content.splitlines(),
        curr_content.splitlines(),
        lineterm=""
    )

    st.code("\n".join(diff), language="diff")
```

---

## Tasks Checklist

- [ ] Create `components/results.py`
- [ ] Implement `render_results()` function
- [ ] Group results by round
- [ ] Add expandable sections per model
- [ ] Implement JSON download
- [ ] Implement Markdown download
- [ ] Add model color coding
- [ ] Handle leading flow final synthesis
- [ ] Test with real flow results
