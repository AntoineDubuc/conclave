# Research: Phase 0.6 - Flow Execution

## Goal
Execute flows created by the agent against real LLMs using Conclave's engine.

---

## Conclave Flow Architecture

### Key Types (from `conclave/core/types.py`)

```python
class FlowType(str, Enum):
    BASIC = "basic"      # Round-robin democratic
    LEADING = "leading"  # Hub-and-spoke with leader

class FlowPrompts(BaseModel):
    round_1: str
    refinement: str
    leader_synthesis: str | None = None  # Only for leading flows

class FlowConfig(BaseModel):
    name: str
    description: str | None = None
    flow_type: FlowType = FlowType.BASIC
    max_rounds: int = 2
    default_leader: str | None = None
    active_providers: list[str] | None = None
    prompts: FlowPrompts
```

### Flow Engines

**BasicFlowEngine** (`conclave/flows/basic/engine.py`):
- Round 1: All providers brainstorm independently (parallel)
- Round 2+: Each provider sees ALL peer outputs and refines
- Output: One file per provider per round

**LeadingFlowEngine** (`conclave/flows/leading/engine.py`):
- Round 1: All providers ideate independently
- Round 2: Leader synthesizes all contributions
- Round 3: Non-leaders respond to leader's synthesis
- Round 4: Leader final synthesis
- Output: Leader's final synthesis is the primary output

---

## Integration Challenge

The existing engines are designed for CLI use:
- They print to console with Rich
- They save files to disk
- They read input from files

For the UI, we need:
- Return results as data (not files)
- Progress callbacks (not console printing)
- Input from user (not file)

---

## Solution: Wrapper/Adapter

Create `lib/executor.py` that wraps Conclave engines for UI use.

### Option A: Modify Conclave engines
- Pros: Direct integration
- Cons: Changes shared codebase

### Option B: Create UI-specific executor
- Pros: Isolated, doesn't touch Conclave
- Cons: Some duplication

### Option C: Wrapper that captures output
- Pros: Reuses Conclave engines, minimal changes
- Cons: More complex

**Decision: Option B** - Create a simplified executor for Phase Zero that:
1. Uses Conclave's provider factory
2. Implements flow logic directly (it's not that complex)
3. Returns structured results

---

## Simplified Executor Design

```python
# lib/executor.py

from dataclasses import dataclass
from conclave.providers.factory import ProviderFactory
from conclave.core.types import FlowConfig, FlowType

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
    final_synthesis: str | None = None  # For leading flows

async def execute_flow(
    flow_config: dict,
    api_keys: dict,
    progress_callback: callable = None
) -> FlowResults:
    """
    Execute a flow and return results.

    Args:
        flow_config: Flow configuration from agent
        api_keys: Dict of provider -> api_key
        progress_callback: Optional callback for progress updates

    Returns:
        FlowResults with all outputs
    """
    # Convert dict to FlowConfig
    flow = FlowConfig(**flow_config)

    # Create providers with user's API keys
    providers = create_providers_from_keys(flow.models, api_keys)

    if flow.flow_type == FlowType.BASIC:
        return await run_basic_flow(flow, providers, progress_callback)
    else:
        return await run_leading_flow(flow, providers, progress_callback)
```

---

## Provider Creation with User Keys

```python
def create_providers_from_keys(
    model_names: list[str],
    api_keys: dict
) -> list[Provider]:
    """Create provider instances from user-provided API keys."""

    providers = []

    for name in model_names:
        name_lower = name.lower()

        # Check for OpenRouter first
        if "openrouter" in api_keys and api_keys["openrouter"]:
            providers.append(OpenRouterProvider(
                name=name,
                api_key=api_keys["openrouter"]
            ))
            continue

        # Otherwise use direct provider
        if name_lower == "anthropic" and api_keys.get("anthropic"):
            from conclave.providers.anthropic import AnthropicProvider
            providers.append(AnthropicProvider(
                config=ProviderConfig(type="anthropic"),
                api_key=api_keys["anthropic"]
            ))
        elif name_lower == "openai" and api_keys.get("openai"):
            from conclave.providers.openai import OpenAIProvider
            providers.append(OpenAIProvider(
                config=ProviderConfig(type="openai"),
                api_key=api_keys["openai"]
            ))
        # ... etc

    return providers
```

---

## Basic Flow Implementation

```python
async def run_basic_flow(
    flow: FlowConfig,
    providers: list[Provider],
    progress_callback: callable = None
) -> FlowResults:
    """Run basic (round-robin) flow."""

    results = FlowResults(
        flow_name=flow.name,
        flow_type="basic",
        rounds=[]
    )

    # Track outputs by round
    round_outputs: dict[int, dict[str, str]] = {}

    # Round 1: Independent brainstorming
    if progress_callback:
        progress_callback("Round 1: Brainstorming...")

    round_outputs[1] = {}
    tasks = [
        provider.generate(flow.prompts.round_1)
        for provider in providers
    ]
    outputs = await asyncio.gather(*tasks)

    for provider, output in zip(providers, outputs):
        round_outputs[1][provider.name] = output
        results.rounds.append(RoundResult(
            round_num=1,
            model=provider.name,
            content=output
        ))

    # Rounds 2+: Refinement with peer review
    for round_num in range(2, flow.max_rounds + 1):
        if progress_callback:
            progress_callback(f"Round {round_num}: Refinement...")

        round_outputs[round_num] = {}
        prev = round_outputs[round_num - 1]

        tasks = []
        for provider in providers:
            # Build prompt with peer outputs
            peer_outputs = "\n\n".join(
                f"[{p.name}]\n{prev[p.name]}"
                for p in providers if p.name != provider.name
            )

            prompt = f"""{flow.prompts.refinement}

Your previous version:
{prev[provider.name]}

Peer outputs:
{peer_outputs}

Create your refined version:"""

            tasks.append(provider.generate(prompt))

        outputs = await asyncio.gather(*tasks)

        for provider, output in zip(providers, outputs):
            round_outputs[round_num][provider.name] = output
            results.rounds.append(RoundResult(
                round_num=round_num,
                model=provider.name,
                content=output
            ))

    return results
```

---

## OpenRouter Provider

```python
# lib/openrouter.py

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

    async def generate(self, prompt: str, options=None) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content
```

---

## Streamlit Integration

```python
# In app.py

if st.button("🚀 Run Flow", type="primary"):
    if not st.session_state.current_flow:
        st.error("No flow configured")
    elif not any(api_keys.values()):
        st.error("Please provide at least one API key")
    else:
        progress_placeholder = st.empty()

        def update_progress(msg):
            progress_placeholder.info(msg)

        with st.spinner("Executing flow..."):
            results = asyncio.run(execute_flow(
                st.session_state.current_flow,
                api_keys,
                progress_callback=update_progress
            ))

        st.session_state.results = results
        progress_placeholder.success("Flow complete!")
```

---

## Error Handling

```python
async def execute_flow(...) -> FlowResults:
    try:
        # ... execution logic
    except anthropic.AuthenticationError:
        raise ExecutionError("Invalid Anthropic API key")
    except openai.AuthenticationError:
        raise ExecutionError("Invalid OpenAI API key")
    except Exception as e:
        raise ExecutionError(f"Flow execution failed: {str(e)}")

class ExecutionError(Exception):
    """Flow execution error with user-friendly message."""
    pass
```

---

## Tasks Checklist

- [ ] Create `lib/executor.py`
- [ ] Implement `create_providers_from_keys()`
- [ ] Implement `run_basic_flow()`
- [ ] Implement `run_leading_flow()`
- [ ] Create `lib/openrouter.py`
- [ ] Add progress callback support
- [ ] Add error handling
- [ ] Test with real API keys
- [ ] Integrate with Streamlit UI
