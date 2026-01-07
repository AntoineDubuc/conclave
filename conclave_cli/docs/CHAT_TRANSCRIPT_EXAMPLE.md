# Conclave Chat Room - Feature Brainstorm Transcript

**Date:** January 4, 2025
**Models:** Anthropic (Claude), OpenAI (GPT), Gemini
**Topic:** Next innovative feature for Conclave
**Rounds:** 3 (initial → @mention follow-up → /expand)

---

## Round 1: Initial Brainstorm

### User
> You are brainstorming features for Conclave, a CLI tool that orchestrates multi-LLM collaboration. It currently has: batch flows (basic round-robin, leading with synthesis), and interactive chat rooms. What should be the next innovative feature?

---

### Anthropic (Claude)

I'd suggest **structured debate mode** - where models are explicitly assigned opposing positions on a topic and must defend them across rounds, with a final synthesis by a neutral arbiter model. This surfaces genuine disagreements between models rather than the polite consensus that tends to emerge in open brainstorming.

Another strong candidate: **chain-of-expertise routing** - let models tag which domains they're confident in, then automatically route sub-questions to the most appropriate model rather than asking everyone everything.

What angles are @OpenAI and @Gemini seeing?

---

### OpenAI (GPT)

Add an **"argument graph + adjudication" mode**: Conclave extracts claims, assumptions, and evidence from each model into a shared graph, then runs targeted cross-examination prompts to resolve conflicts and quantify uncertainty (with citations back to each turn). This builds on your synthesis flow by making disagreement explicit and actionable, not just averaged. It also enables a `conclave verify` step that produces a decision plus a traceable rationale and "what would change my mind" queries.

---

### Gemini

I think Conclave could benefit from a feature that allows users to **define custom routing logic** for batch flows. Instead of just round-robin, users could specify rules based on the content of the text, like "@Anthropic, your model is best for creative tasks, so route creative prompts to it". This would enable more intelligent collaboration.

---

## Round 2: Deep Dive with @Mention

### User
> @anthropic that's interesting - can you elaborate on how voting/consensus would work technically?

---

### Anthropic (Claude)

Here's how I'd approach it technically:

**Structured output per model:** Each model responds with JSON containing `{position: "agree"|"disagree"|"nuanced", confidence: 0-1, key_claims: [...], rebuttals_to: {...}}`. This forces explicit stances rather than hedging prose.

**Consensus detection:** After each round, Conclave parses these structured outputs and computes agreement matrices. If >75% converge on a position with high confidence, that branch closes. Persistent disagreements get flagged for deeper examination.

**Arbiter synthesis:** A designated model (or rotating role) receives the full argument graph and produces a final verdict with explicit minority opinion acknowledgment—like a court ruling with dissents.

This pairs well with @OpenAI's argument graph idea—the structured outputs feed directly into that graph for traceability. @Gemini's routing could also help here: route the arbiter role to whichever model has shown least bias on the topic.

---

### OpenAI (GPT)

@Anthropic A clean technical approach is:
1. Normalize outputs into a shared schema (claims + recommendation + confidence + key evidence)
2. Compute pairwise agreement by embedding/LLM-judging claim equivalence
3. Run a "vote" as either weighted-majority (weights = calibrated historical accuracy + self-reported confidence penalties) or Condorcet/Ranked-choice over discrete options

Then add a "consensus builder" round where dissenting models must propose the smallest change that would make them accept the majority, and the arbiter emits the final with a dissent log and thresholds (e.g., require ≥0.7 aggregate confidence).

---

### Gemini

@Anthropic, I'm also interested in how the "structured debate" would work! Could each model be assigned a confidence score, and the final synthesis weighted accordingly? Maybe a "jury" of models could evaluate the debate and influence the outcome.

---

## Round 3: /expand - Detailed Implementation

### User
> /expand

*(Triggered expanded response from all models)*

---

### Anthropic (Claude) - Expanded

#### Voting & Consensus Mechanics for Conclave Debate Mode

**1. Structured Output Schema**

The foundation is forcing models out of their natural "hedge everything" tendency. Each model must respond with machine-parseable structure:

```yaml
position: "agree" | "disagree" | "conditional"
confidence: 0.85
stance_summary: "One sentence crystallizing the position"
key_claims:
  - id: "claim_1"
    text: "LLMs cannot reliably self-evaluate"
    evidence: "Citation or reasoning chain"
    confidence: 0.9
rebuttals:
  - targets: "@OpenAI.claim_3"
    counterargument: "..."
    undermines_confidence_by: 0.2
dependencies:
  - "If claim_1 is false, my position would shift to agree"
```

**2. Pairwise Agreement Computation**

After each round, Conclave builds an agreement matrix:

- **Claim equivalence detection:** Use embedding similarity (cosine > 0.85) or an LLM judge to determine when two models are making the same claim in different words
- **Agreement scoring:** `agreement(A, B) = Σ (shared_claims × min(conf_A, conf_B)) / total_claims`

```
           Anthropic  OpenAI  Gemini
Anthropic     1.0      0.72    0.45
OpenAI        0.72     1.0     0.68
Gemini        0.45     0.68    1.0
```

**3. Voting Mechanisms**

- **Weighted majority:** `vote_weight(model) = base_weight × confidence × historical_calibration`
- **Condorcet/Ranked-choice:** For multi-option decisions
- **Confidence-weighted Borda count:** `score(option) = Σ (rank_points × voter_confidence)`

**4. Consensus Thresholds**

| Outcome Type | Criteria | Action |
|--------------|----------|--------|
| Strong consensus | ≥80% agreement, avg confidence ≥0.8 | Close branch, proceed |
| Weak consensus | ≥60% agreement | Flag uncertainty, proceed with caveats |
| Contested | <60% agreement | Escalate to deeper examination |
| Irreconcilable | Persistent split after N rounds | Surface as genuine uncertainty |

**5. Arbiter Synthesis**

Output follows a judicial format:
- **Majority Opinion** - Synthesized consensus with evidence
- **Concurrences** - Models that agreed for different reasons
- **Dissents** - Minority positions with strongest arguments
- **Confidence Assessment** - Overall confidence + "what would change this verdict"

**6. Implementation in Conclave**

```python
# conclave/flows/debate/engine.py
class DebateEngine:
    def run(self, topic: str, positions: list[str], rounds: int = 3):
        # Round 1: Position assignment and initial arguments
        assignments = self.assign_positions(positions)
        responses = await self.parallel_generate(assignments)

        # Rounds 2-N: Cross-examination
        for round in range(2, rounds + 1):
            graph = self.build_argument_graph(responses)
            consensus = self.compute_consensus(graph)

            if consensus.strength >= 0.8:
                break

            responses = await self.cross_examine(graph, consensus.contested_claims)

        # Final: Arbiter synthesis
        return await self.arbiter_synthesize(graph, consensus)
```

> *The key insight is treating model disagreement as signal, not noise. When Claude and GPT genuinely disagree, that's valuable information about the problem's difficulty or ambiguity—worth preserving rather than averaging away.*

---

## Summary: Feature Ideas Generated

| Feature | Proposed By | Description |
|---------|-------------|-------------|
| **Structured Debate Mode** | Claude | Assign opposing positions, track claims, arbiter synthesizes |
| **Argument Graph + Adjudication** | GPT | Extract claims into graph, cross-examine, quantify uncertainty |
| **Chain-of-Expertise Routing** | Claude | Route sub-questions to domain-confident models |
| **Custom Routing Logic** | Gemini | User-defined rules for intelligent prompt routing |
| **Voting/Consensus System** | All | Structured outputs, agreement matrices, confidence weighting |

## Key Technical Insights

1. **Force structured outputs** - JSON schemas prevent hedging prose
2. **Claim deduplication** - Embedding similarity to recognize equivalent claims
3. **Confidence calibration** - Weight votes by historical accuracy
4. **"Smallest change" protocol** - Dissenters propose minimal acceptable modifications
5. **Judicial output format** - Preserve minority opinions, don't average away disagreement

## Cross-References Between Models

- Claude referenced @OpenAI's argument graph idea for traceability
- Claude suggested @Gemini's routing could select neutral arbiters
- GPT built on Claude's schema with explicit acceptance criteria
- Gemini asked Claude about confidence scoring and jury evaluation

---

## Chat Features Demonstrated

| Feature | Example |
|---------|---------|
| Multi-model response | All 3 models answered initial question |
| @mention targeting | `@anthropic` got only Claude to elaborate |
| /expand command | Triggered detailed 1000+ word response |
| Cross-model references | Models used @mentions to build on each other |
| Brief default responses | Initial responses were 2-4 sentences |

---

*Generated with `conclave chat -m anthropic -m openai -m gemini`*
