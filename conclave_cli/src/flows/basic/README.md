# Basic Ideator Flow

**Pattern:** Round-Robin (Democratic)

## How It Works

```
Round 1 (Divergence):
  ┌─────────┐  ┌─────────┐  ┌─────────┐
  │ Claude  │  │  GPT    │  │ Gemini  │
  │ ideates │  │ ideates │  │ ideates │
  └────┬────┘  └────┬────┘  └────┬────┘
       │            │            │
       ▼            ▼            ▼
     v1.md        v1.md        v1.md

Round 2+ (Convergence):
  ┌─────────────────────────────────────┐
  │  Everyone sees ALL peer outputs     │
  │  and refines their own work         │
  └─────────────────────────────────────┘
       │            │            │
       ▼            ▼            ▼
     v2.md        v2.md        v2.md
```

## When to Use

- **Brainstorming:** When you want diverse perspectives without hierarchy
- **Code Review:** Multiple reviewers finding different issues
- **Design Critique:** Gathering varied feedback on a design

## Configuration

```yaml
flows:
  my-basic-flow:
    name: My Basic Flow
    flow_type: basic
    max_rounds: 3
    prompts:
      round_1: "Your initial brainstorming prompt..."
      refinement: "How to incorporate peer feedback..."
```

## Output Structure

```
.conclave/runs/<run-id>/
├── claude.v1.md      # Claude's round 1 output
├── openai.v1.md      # GPT's round 1 output
├── gemini.v1.md      # Gemini's round 1 output
├── claude.v2.md      # Claude's refined output
├── openai.v2.md      # GPT's refined output
└── gemini.v2.md      # Gemini's refined output
```

## Extending This Flow

To modify this flow's behavior, edit `engine.ts`. Key extension points:

- **Change how peer outputs are formatted:** Modify the `otherOutputs` construction
- **Add voting/scoring:** Track scores in `RunState` and filter low performers
- **Custom termination:** Add early exit conditions beyond `max_rounds`
