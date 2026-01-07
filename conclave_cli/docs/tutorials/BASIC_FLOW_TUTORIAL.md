# Tutorial: Basic Flow (Round-Robin Democratic)

**Use Case: Security Audit of Conclave's Provider Factory**

The basic flow implements a democratic round-robin pattern where all models brainstorm independently, then refine their ideas based on peer feedback. No single model leads - all are equal contributors.

---

## How Basic Flow Works

```
┌─────────────────────────────────────────────────────────────┐
│                    ROUND 1: DIVERGENCE                      │
│   Input → [Claude] [GPT] [Gemini] [Grok]                    │
│           Each brainstorms independently (parallel)          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    ROUND 2: CONVERGENCE                     │
│   Each model sees ALL peer outputs                          │
│   [Claude sees GPT+Gemini+Grok feedback]                    │
│   [GPT sees Claude+Gemini+Grok feedback]                    │
│   Each refines their response                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    ROUND N: FINAL                           │
│   Further refinement until max_rounds reached               │
│   Output: Multiple refined perspectives saved to files      │
└─────────────────────────────────────────────────────────────┘
```

---

## When to Use Basic Flow

| Good For | Not Ideal For |
|----------|---------------|
| Getting diverse perspectives | When you need one unified answer |
| Security audits (cross-validation) | Simple questions |
| Creative brainstorming | Time-critical tasks |
| Identifying blind spots | When one expert is enough |

---

## Real Example: Auditing Conclave's Code

Let's audit the provider factory code in Conclave itself for security issues.

### Step 1: Create the Input File

Create `audit-factory.md`:

```markdown
# Security Audit Request

## Target Code

```python
# conclave/providers/factory.py
def create_providers(config: ConclaveConfig) -> list[Provider]:
    """Create provider instances based on configuration."""
    providers = []

    for name in config.active_providers:
        provider_config = config.providers.get(name)
        if not provider_config:
            continue

        provider_type = provider_config.type

        if provider_type == "anthropic":
            api_key = os.environ.get("ANTHROPIC_API_KEY")
            if api_key and not api_key.startswith("sk-ant-..."):
                providers.append(AnthropicProvider(provider_config, api_key))
            elif shutil.which("claude"):
                providers.append(ClaudeCliProvider(provider_config))
        elif provider_type == "openai":
            api_key = os.environ.get("OPENAI_API_KEY")
            if api_key:
                providers.append(OpenAIProvider(provider_config, api_key))
        # ... more providers

    return providers
```

## Audit Focus

1. Input validation vulnerabilities
2. API key handling security
3. Error handling gaps
4. Potential injection vectors
5. Configuration parsing risks
```

### Step 2: Run the Basic Flow

```bash
conclave run basic-ideator audit-factory.md
```

Output:
```
Starting Flow: basic-ideator (Run ID: 20250104-143022)
Output Directory: .conclave/runs/20250104-143022

--- Basic Ideator ---
Pattern: Round-Robin (Democratic)
Round-robin democratic collaboration. All models brainstorm independently,
then everyone sees everyone's work and refines together.

Round 1: Divergence (Brainstorming)
✓ Round 1 Complete
Round 2: Convergence (Refinement)
✓ Round 2 Complete

Flow Complete!
Explore the results in: .conclave/runs/20250104-143022
```

### Step 3: Review the Outputs

```
.conclave/runs/20250104-143022/
├── anthropic-round-1.md
├── anthropic-round-2.md
├── openai-round-1.md
├── openai-round-2.md
├── gemini-round-1.md
└── gemini-round-2.md
```

---

## Example Outputs

### Round 1: Independent Analysis

**anthropic-round-1.md:**
```markdown
## Security Findings

### High Priority

1. **API Key Logging Risk**: No sanitization before the key is used.
   If debug logging is enabled elsewhere, keys could leak.

2. **TOCTOU Race Condition**: `shutil.which("claude")` check and
   subsequent execution aren't atomic. Malicious PATH manipulation
   could inject a fake binary between check and use.

### Medium Priority

3. **No API Key Validation**: Keys are used directly without format
   validation. Malformed keys could cause unclear errors downstream.

### Recommendations

- Add API key format validation before use
- Consider credential caching with secure storage
- Add explicit error messages for missing credentials
```

**openai-round-1.md:**
```markdown
## Security Analysis

### Critical Issues

1. **Environment Variable Trust**: Direct `os.environ.get()` trusts
   the environment entirely. In containerized deployments, env vars
   can be inspected by other processes.

2. **No Rate Limiting**: Provider creation has no guards against
   resource exhaustion if called repeatedly.

### Moderate Issues

3. **Silent Failures**: Missing providers are silently skipped with
   `continue`. This could mask configuration errors.

4. **Type Confusion**: `provider_type` string comparison without
   normalization could miss "Anthropic" vs "anthropic".

### Suggestions

- Use a secrets manager for production
- Add explicit logging for skipped providers
- Normalize provider type strings
```

**gemini-round-1.md:**
```markdown
## Code Review: Security Perspective

### Observations

1. **Fallback Logic Risk**: The Claude CLI fallback could execute
   unintended binaries if PATH is compromised.

2. **Configuration Injection**: If `config.providers` comes from
   user input (YAML file), provider names could contain path
   traversal or special characters.

3. **No Credential Rotation**: Static environment variables don't
   support key rotation without restart.

### Positive Notes

- Good separation between config and instantiation
- Clear provider type dispatching
```

### Round 2: Refined After Peer Review

**anthropic-round-2.md:**
```markdown
## Consolidated Security Analysis (v2)

After reviewing peer findings, I'm updating my assessment:

### Critical (Elevated from @OpenAI's analysis)

1. **Environment Trust Model**: Agreed with @OpenAI that env vars
   are insufficient for production. However, for a CLI tool meant
   for local development, this is acceptable with documentation.

2. **TOCTOU on CLI Path** (original finding, reinforced by @Gemini):
   This is more serious than initially rated. Recommend:
   ```python
   # Resolve and cache path once at startup
   _claude_path = shutil.which("claude")

   def get_claude_path() -> str | None:
       return _claude_path
   ```

### High

3. **Silent Failures** (@OpenAI): Agree. Change to explicit logging:
   ```python
   if not provider_config:
       logger.warning(f"Provider '{name}' in active_providers but not configured")
       continue
   ```

4. **Input Validation** (@Gemini): Provider names from YAML should be
   validated against an allowlist:
   ```python
   VALID_PROVIDERS = {"anthropic", "openai", "gemini", "grok"}
   if name.lower() not in VALID_PROVIDERS:
       raise ConfigError(f"Unknown provider: {name}")
   ```

### Consensus Points

All reviewers agree on:
- Need for better error messaging
- CLI path resolution needs hardening
- API key handling is acceptable for CLI tooling
```

---

## Understanding the Value

### Cross-Validation Benefits

| Model | Unique Contribution |
|-------|---------------------|
| Claude | TOCTOU race condition, API key logging |
| GPT | Rate limiting, silent failures, type normalization |
| Gemini | Configuration injection, PATH compromise |

Each model caught issues the others missed. The final round synthesizes these into a comprehensive security assessment.

### Refinement Improvements

In Round 2, models:
- Elevated priority of issues based on peer input
- Added code examples to fix identified problems
- Reached consensus on acceptable tradeoffs
- Explicitly credited peer contributions with @mentions

---

## Customizing the Flow

### Adjust Rounds

More rounds = more refinement, but diminishing returns after 3:

```bash
conclave new-flow
# Set max_rounds: 3
```

### Custom Prompts

Edit `conclave.config.yaml`:

```yaml
flows:
  security-audit:
    flow_type: basic
    max_rounds: 3
    prompts:
      round_1: |
        You are a security researcher. Analyze the following code for:
        - OWASP Top 10 vulnerabilities
        - Cryptographic weaknesses
        - Input validation gaps
        - Authentication/authorization issues
        Be specific and cite line numbers.
      refinement: |
        Review peer security findings. For each:
        1. Confirm or dispute with evidence
        2. Add any missed vulnerabilities
        3. Prioritize by exploitability
        4. Suggest specific fixes with code
```

---

## Output Structure

Each run creates a timestamped directory:

```
.conclave/runs/20250104-143022/
├── anthropic-round-1.md   # Claude's initial analysis
├── anthropic-round-2.md   # Claude's refined analysis
├── openai-round-1.md      # GPT's initial analysis
├── openai-round-2.md      # GPT's refined analysis
├── gemini-round-1.md      # Gemini's initial analysis
└── gemini-round-2.md      # Gemini's refined analysis
```

You get **N models × M rounds** output files, each showing the evolution of that model's thinking.

---

## Tips for Effective Basic Flows

### 1. Be Specific in Round 1 Prompt

Vague prompts produce vague results. Include:
- Specific aspects to analyze
- Output format expectations
- Relevant context

### 2. Review All Final Rounds

Don't just read one model's output. The value is in the diversity - each final round file incorporates different peer perspectives.

### 3. Look for Disagreements

When models disagree in final rounds, that's signal. It often indicates genuine ambiguity worth investigating.

### 4. Use for High-Stakes Decisions

Basic flow is ideal when you need multiple expert opinions with cross-validation - security audits, architecture reviews, critical bug analysis.

---

## Comparison: Basic vs Leading

| Aspect | Basic Flow | Leading Flow |
|--------|------------|--------------|
| Structure | Democratic (all equal) | Hierarchical (leader synthesizes) |
| Output | Multiple perspectives | One unified document |
| Best for | Diversity of views | Coherent final product |
| Round pattern | All see all | Contributors → Leader |

---

*Next: Try [Leading Flow Tutorial](LEADING_FLOW_TUTORIAL.md) for hierarchical synthesis.*
