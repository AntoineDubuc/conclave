# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is This?

Conclave UI is a multi-LLM collaboration platform. Users select a flow pattern, choose which models to include, enter a task, and run. The system orchestrates multiple AI models working together on the same problem.

**Flow patterns:**
- **Basic (Round-Robin):** All models respond independently, then see each other's work and refine
- **Leading (Hub-and-Spoke):** One model acts as leader and synthesizes contributions from others

## Architecture

The system consists of four services:

| Service | Port | Tech | Purpose |
|---------|------|------|---------|
| **Executor API** | 8553 | FastAPI | Flow execution engine |
| **Agent Service** | 8554 | Express/TypeScript | Claude Agent SDK integration |
| **Streamlit UI** | 8555 | Python/Streamlit | Original POC interface |
| **Next.js Frontend** | 4100 | Next.js 16/React 19 | Modern web application |

**Note:** Ports 8553-8554 and 4100 are configured in `start_conclave.sh`.

## Development Commands

### Quick Start (Full Stack)
```bash
./start_conclave.sh        # Starts Executor API, Agent Service, and Next.js Frontend
```

Alternatively, start just the Next.js app:
```bash
cd conclave-app && npm run dev:full
```

### Individual Services

**Next.js Frontend** (`conclave-app/`):
```bash
npm run dev              # Start on port 4100
npm run build            # Production build
npm run lint             # ESLint
npm run db:reset         # Reset Supabase database
npm run db:types         # Generate TypeScript types from Supabase
```

**Agent Service** (`agent-service/`):
```bash
npm run dev              # Start with tsx watch
npm run build            # Compile TypeScript
npm run test             # Vitest watch mode
npm run test:run         # Single test run
npm run typecheck        # Type check without emit
```

**Executor API** (`executor_api/`):
```bash
python -m uvicorn api:app --reload --port 8553
pytest test_executor.py
pytest test_api_endpoints.py
```

**Streamlit UI** (`src/`):
```bash
source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

### Health Check
```bash
bash scripts/health_check.sh   # Verify all services running
```

## Mandatory Workflow Rules

**These are non-negotiable. Violating any of these rules is a critical failure.**

### 1. Never Write Code Without Approval and a Plan

Do NOT write, edit, or modify any code without:
1. A written implementation plan (based on `_implementation_plan_template_v4.md`)
2. Explicit user approval of that plan

**No exceptions.** Not even "quick fixes." Not even "obvious one-liners." Plan first, get approval, then implement.

### 2. Ask Questions — Don't Assume

When you need clarification or face a decision:
1. **Ask the user.** Don't guess.
2. **Provide context.** Be descriptive about what you found and why it matters.
3. **Provide options.** List the choices available.
4. **Lead with your recommendation.** Start with the option you think is best and explain why.
5. **Explain why alternatives were not chosen.** Briefly cover why the other options are weaker.

### 3. Bug Investigation Workflow

When a bug or issue is found:

1. **Create a QA folder** under `__QA__/` with a descriptive name (e.g., `__QA__/invalid-anthropic-model-ids/`)
2. **Create `notebook.md`** — Running log of findings as you go. Timestamped, append-only. This is compaction insurance — if context compresses mid-session, re-read this to pick up where you left off.
3. **Create `research.md`** — Structured research document. Write your findings on how to fix the bug. Include verified facts, open questions, and remaining research needed.
4. **Verify all assumptions.** Every claim must be backed by actual code inspection or live API testing. No "should work" or "probably."
5. **Only after all assumptions are verified** — no remaining open questions — create an implementation plan using the v4 template at `_implementation_plan_template_v4.md`.
6. **Get user approval** on the implementation plan before writing any code.

### 4. Implementation Plan Template

All implementation plans must follow the v4 template at:
```
conclave_ui/_implementation_plan_template_v4.md
```

This includes the 7-pass review process, inline QA protocol, split-agent verification, and evidence generation.

---

## Definition of Success

**CRITICAL: Success is measured from the CUSTOMER'S perspective, not technical completion.**

Before claiming something works or is successful:

1. **Ask: "Did the customer get the value they expected?"**
   - A working API call is NOT success
   - A tool executing without errors is NOT success
   - Logs showing completion is NOT success
   - **Success = The customer received the expected outcome**

2. **Example of WRONG thinking:**
   - User asks for: "Perspective Analysis flow with Claude (risks) + GPT (opportunities) + Gemini (synthesis)"
   - I test: A simple "summarize this sentence" flow with one model
   - I claim: "It works! The logs prove the tool executed!"
   - Reality: The customer got NOTHING they asked for. This is NOT success.

3. **Example of CORRECT thinking:**
   - User asks for: "Perspective Analysis flow with Claude (risks) + GPT (opportunities) + Gemini (synthesis)"
   - I test: The exact multi-model flow with a real business decision
   - I verify: Claude identified risks, GPT identified opportunities, Gemini synthesized
   - I confirm: The customer can use this to make decisions
   - THEN: It works.

**Infrastructure working ≠ Customer value delivered**

## No Shortcuts Policy

**CRITICAL: Do not take shortcuts when testing or claiming success.**

1. **Test with REAL data, REAL use cases**
   - Not toy examples or trivial inputs
   - Use actual customer scenarios
   - If testing a "Haiku Battle" flow, use a real topic and verify real haikus come back
   - If testing multi-model collaboration, verify EACH model actually contributed

2. **No bullshitting**
   - Don't claim "it works" based on logs or status codes
   - Don't use simplified test cases and extrapolate to complex ones
   - Don't skip steps because "it should work the same way"
   - If you haven't verified it end-to-end with real data, say so

3. **API testing is valid, but must be thorough**
   - Testing via API (bypassing UI) is acceptable for speed
   - But the test must use realistic inputs and verify realistic outputs
   - Check that multi-phase flows actually pass context between phases
   - Verify that different providers (Claude, GPT, Gemini) each produce distinct outputs

4. **What counts as verification**
   - Seeing the actual LLM outputs in the response
   - Confirming the outputs make sense for the inputs given
   - Verifying all phases executed and context was passed
   - Checking that the customer could actually USE this result

**If you haven't proven it works with real data, you haven't proven it works.**

## Testing Rules

**CRITICAL: Never claim something works without verification.**

Before saying a feature or fix works:
1. **Test via Playwright** - Use headless browser to interact with the UI
2. **Take screenshots** - Capture before/after states to verify visual changes
3. **Check console/logs** - Verify no JavaScript errors or Python exceptions
4. **Test the actual interaction** - Click buttons, fill forms, verify state changes

```bash
# Take screenshot (Streamlit POC)
npx playwright screenshot --wait-for-timeout=3000 http://localhost:8555 /tmp/test.png

# Take screenshot (Next.js app)
npx playwright screenshot --wait-for-timeout=3000 http://localhost:4100 /tmp/test.png

# Test a click interaction
npx playwright eval "page.click('button:has-text(\"Run\")')" http://localhost:8555
```

**Never say "should work" or "this will work" - either verify it works or say "I need to test this".**

## API Keys

Set in `.env` files in each service directory:

| Provider | Variable |
|----------|----------|
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Google | `GEMINI_API_KEY` |
| xAI | `XAI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Stripe | `STRIPE_SECRET_KEY` |

## Key Directories

| Path | Purpose |
|------|---------|
| `conclave-app/` | Next.js frontend with Supabase auth, Stripe payments |
| `agent-service/` | Express server with Claude Agent SDK, MCP tools |
| `executor_api/` | FastAPI backend for flow execution |
| `src/` | Original Streamlit POC |
| `flows/` | Flow templates and user flows |
| `docs/poc/phase_3/` | Current implementation plans |

## Streamlit Notes

- Use `width="stretch"` instead of deprecated `use_container_width=True`
- Sidebar starts collapsed by default
- Custom HTML/CSS requires `unsafe_allow_html=True`
- State persists in `st.session_state` - be careful with key names

## Startup Troubleshooting

The `start_conclave.sh` script checks prerequisites, installs dependencies, and starts all three services. If it fails, check these common issues:

### 0-byte binaries in venv or node_modules
If macOS file sync (iCloud, migration, or restore) corrupts installed dependencies, binaries in `.venv/bin/` or `node_modules/.bin/` may become 0-byte empty files. Symptoms: commands like `pip`, `tsx`, or `next` silently produce no output.

**Fix — Python venv** (`src/.venv`):
```bash
rm -rf src/.venv
python3.14 -m venv src/.venv    # Use Homebrew Python, not system /usr/bin/python3
```

**Fix — Node modules** (agent-service and/or conclave-app):
```bash
rm -rf agent-service/node_modules && npm install --prefix agent-service
rm -rf conclave-app/node_modules && npm install --prefix conclave-app
```

### Turbopack "Permission denied (os error 13)"
Usually caused by a stale `.next` cache directory. Fix:
```bash
rm -rf conclave-app/.next
```

### Agent Service fails silently
The Agent Service requires `ANTHROPIC_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in `agent-service/.env`. If these are missing, the process exits immediately with no log output.

### Stopping services
```bash
kill $(cat logs/*.pid)
```

### Python version note
The project venv should be created with **Python 3.14** (`/opt/homebrew/bin/python3.14`), not the macOS system Python 3.9 (`/usr/bin/python3`). The `start_conclave.sh` script uses whichever `python3` is first on PATH — if that resolves to the system Python 3.9, the venv will work but may lack compatibility with newer dependencies.

## Output Files

Flow runs save markdown files to `src/outputs/`:
```
outputs/run_YYYY-MM-DD_HH-MM-SS_{flow_name}/
├── round_1_anthropic.md
├── round_1_openai.md
├── round_2_anthropic.md
└── final_synthesis.md  (for leading flows)
```
