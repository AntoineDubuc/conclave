# Leading Ideator Flow

**Pattern:** Hub-and-Spoke (Hierarchical)

## How It Works

```
Step 1 (Everyone Ideates):
  ┌─────────┐  ┌─────────┐  ┌─────────┐
  │ Leader  │  │Contrib 1│  │Contrib 2│
  │ ideates │  │ ideates │  │ ideates │
  └────┬────┘  └────┬────┘  └────┬────┘
       │            │            │
       ▼            ▼            ▼
     v1.md        v1.md        v1.md

Step 2 (Leader Synthesizes):
  ┌─────────────────────────────────────┐
  │         Leader sees ALL             │
  │    and creates unified synthesis    │
  └──────────────────┬──────────────────┘
                     │
                     ▼
            synthesis.v2.md

Step 3 (Contributors Respond):
  ┌─────────────────────────────────────┐
  │  Contributors review synthesis      │
  │  and provide feedback/alternatives  │
  └─────────────────────────────────────┘
       │                          │
       ▼                          ▼
     v3.md                      v3.md

Step 4 (Leader Synthesizes Again):
                     │
                     ▼
            synthesis.v4.md

... alternating until max_rounds
```

## When to Use

- **Architecture Design:** One senior architect leads, juniors contribute ideas
- **Document Writing:** Editor synthesizes multiple writers' contributions
- **Decision Making:** One decider weighs multiple perspectives

## Configuration

```yaml
flows:
  my-leading-flow:
    name: My Leading Flow
    flow_type: leading
    default_leader: anthropic  # or specify at runtime with -l
    max_rounds: 4
    prompts:
      round_1: "Initial brainstorming prompt..."
      refinement: "How contributors should respond to synthesis..."
      leader_synthesis: "How leader should synthesize contributions..."
```

## CLI Usage

```bash
# Use default leader from config
conclave run leading-ideator input.md

# Override leader at runtime
conclave run leading-ideator input.md --leader openai
```

## Output Structure

```
.conclave/runs/<run-id>/
├── anthropic.v1.md           # Leader's initial ideation
├── openai.v1.md              # Contributor's initial ideation
├── gemini.v1.md              # Contributor's initial ideation
├── anthropic.synthesis.v2.md # Leader's first synthesis
├── openai.v3.md              # Contributor's response
├── gemini.v3.md              # Contributor's response
└── anthropic.synthesis.v4.md # Leader's final synthesis (recommended output)
```

## Extending This Flow

To modify this flow's behavior, edit `engine.ts`. Key extension points:

- **Change leader selection logic:** Modify `getLeaderProvider()`
- **Add weighted contributions:** Score contributors and weight their input to leader
- **Multiple leaders:** Rotate leadership between synthesis rounds
- **Voting on synthesis:** Have contributors vote before leader finalizes
