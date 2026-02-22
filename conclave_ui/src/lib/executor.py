"""
Flow execution engine with provider classes.

Implements the base provider interface and concrete providers for each LLM service.
Includes flow execution logic for basic (round-robin) and leading (hub-and-spoke) patterns.
"""

import os
import threading
from abc import ABC, abstractmethod
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Callable

import anthropic
import google.generativeai as genai
import openai


class FlowCancelledError(Exception):
    """Raised when a flow execution is cancelled by the user."""
    pass


# Output directory for markdown files
OUTPUTS_DIR = Path(__file__).parent.parent / "outputs"

# Cancellation flag (thread-safe)
_cancel_flag = threading.Event()


def set_cancel_flag():
    """Signal that the current flow should be cancelled."""
    _cancel_flag.set()


def reset_cancel_flag():
    """Reset the cancellation flag before starting a new flow."""
    _cancel_flag.clear()


def is_cancelled() -> bool:
    """Check if cancellation has been requested."""
    return _cancel_flag.is_set()


# Timeouts for API calls (seconds)
DEFAULT_TIMEOUT = 120.0

# Default system prompt for markdown output formatting
DEFAULT_SYSTEM_PROMPT = """You are a collaborative AI participant in a multi-model discussion.

## Output Format
Structure your response in well-formatted Markdown with:
- Clear headings (##, ###) for major sections
- Bullet points for lists
- **Bold** for key terms or emphasis
- Code blocks with language tags if showing code or technical content
- Numbered lists for sequential steps

Be thorough, specific, and well-organized in your response."""

# Default model configurations (Updated: February 2026)
PROVIDER_MODELS = {
    "anthropic": "claude-sonnet-4-6",
    "openai": "gpt-5.2",
    "google": "gemini-3-pro-preview",
    "xai": "grok-3",
}

# Human-readable model names for display
MODEL_NAMES = {
    "anthropic": "Claude Sonnet 4.6",
    "openai": "GPT-5.2",
    "google": "Gemini 3 Pro",
    "xai": "Grok 3",
}


@dataclass
class ModelInstance:
    """Configuration for a single model instance with persona."""

    provider: str  # e.g., "anthropic", "openai"
    name: str  # User-facing name, e.g., "DevOps Engineer"
    model_id: str = ""  # Specific model ID, e.g., "claude-sonnet-4-6"
    instance_id: str = ""  # Internal slug, auto-generated if empty
    system_prompt: str | None = None

    def __post_init__(self):
        """Auto-generate instance_id from name and set default model if not provided."""
        if not self.instance_id:
            self.instance_id = self.sanitize_id(self.name)
        # Set default model if not provided
        if not self.model_id:
            from .models import get_default_model
            default = get_default_model(self.provider)
            if default:
                self.model_id = default.model_id

    @staticmethod
    def sanitize_id(name: str) -> str:
        """Make a filesystem-safe instance_id from name."""
        return "".join(c if c.isalnum() or c in "-_" else "_" for c in name.lower()).strip("_")


@dataclass
class ModelResponse:
    """Response from a single model."""

    provider: str
    content: str
    error: str | None = None
    instance_id: str | None = None  # Unique identifier for this instance
    display_name: str | None = None  # Human-readable name for display


@dataclass
class RoundResult:
    """Results from a single round."""

    round_number: int
    responses: list[ModelResponse] = field(default_factory=list)


@dataclass
class FlowResults:
    """Complete results from a flow execution."""

    flow_name: str
    flow_type: str
    rounds: list[RoundResult] = field(default_factory=list)
    final_synthesis: str | None = None
    leader: str | None = None
    output_dir: str | None = None  # Path to the output directory with markdown files


@dataclass
class LeadingFlowState:
    """State for step-by-step leading flow execution with human-in-the-loop editing."""

    # Configuration
    flow_config: dict
    task_prompt: str
    leader_instance_id: str  # Unique instance identifier for the leader
    leader_display_name: str  # Human-readable name for display
    max_rounds: int
    temperature: float
    max_tokens: int
    prompts: dict
    system_prompt: str
    display_names: dict  # Mapping of instance_id -> display_name

    # Execution state
    run_dir: Path
    results: FlowResults
    prev_responses: dict = field(default_factory=dict)  # Keyed by instance_id
    leader_synthesis: str = ""
    current_round: int = 0  # 0 = not started, increments after each round

    # Control flags
    is_complete: bool = False
    pending_review: bool = False  # True when waiting for user to review/edit synthesis
    error: str | None = None

    # Backward compatibility property
    @property
    def leader_name(self) -> str:
        """Alias for leader_instance_id for backward compatibility."""
        return self.leader_instance_id


class BaseProvider(ABC):
    """Base class for LLM providers."""

    def __init__(
        self,
        api_key: str,
        model: str | None = None,
        timeout: float = DEFAULT_TIMEOUT,
        instance_id: str | None = None,
        default_system_prompt: str | None = None,
    ):
        self.api_key = api_key
        self.model = model
        self.timeout = timeout
        self._instance_id = instance_id
        self.default_system_prompt = default_system_prompt

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name (anthropic, openai, etc.)."""
        pass

    @property
    def instance_id(self) -> str:
        """Unique instance identifier. Defaults to provider name if not set."""
        return self._instance_id or self.name

    def get_effective_system_prompt(self, system_prompt: str | None) -> str | None:
        """Get the system prompt to use, applying priority rules."""
        return system_prompt or self.default_system_prompt or DEFAULT_SYSTEM_PROMPT

    @abstractmethod
    def generate(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: str | None = None,
    ) -> str:
        """Generate a response from the model.

        Args:
            prompt: The user prompt/task
            temperature: Sampling temperature
            max_tokens: Maximum tokens in response
            system_prompt: Optional system instructions (for format, behavior)
        """
        pass


class AnthropicProvider(BaseProvider):
    """Anthropic Claude provider."""

    @property
    def name(self) -> str:
        return "anthropic"

    def __init__(
        self,
        api_key: str,
        model: str | None = None,
        timeout: float = DEFAULT_TIMEOUT,
        instance_id: str | None = None,
        default_system_prompt: str | None = None,
    ):
        super().__init__(
            api_key,
            model or PROVIDER_MODELS["anthropic"],
            timeout,
            instance_id,
            default_system_prompt,
        )
        self.client = anthropic.Anthropic(api_key=api_key)

    def generate(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: str | None = None,
    ) -> str:
        effective_system_prompt = self.get_effective_system_prompt(system_prompt)
        kwargs = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
            "timeout": self.timeout,
        }
        if effective_system_prompt:
            kwargs["system"] = effective_system_prompt

        response = self.client.messages.create(**kwargs)
        return response.content[0].text


def _uses_max_completion_tokens(model: str) -> bool:
    """Check if an OpenAI-compatible model uses max_completion_tokens instead of max_tokens.

    Newer OpenAI models (gpt-4o+, gpt-4.1, gpt-5.x, o-series) require
    max_completion_tokens. Legacy models (gpt-3.5, gpt-4, gpt-4-turbo) use max_tokens.
    """
    prefixes = ("gpt-4o", "gpt-4.1", "gpt-5", "o1", "o3", "o4")
    return any(model.startswith(p) for p in prefixes)


class OpenAIProvider(BaseProvider):
    """OpenAI GPT provider."""

    @property
    def name(self) -> str:
        return "openai"

    def __init__(
        self,
        api_key: str,
        model: str | None = None,
        timeout: float = DEFAULT_TIMEOUT,
        instance_id: str | None = None,
        default_system_prompt: str | None = None,
    ):
        super().__init__(
            api_key,
            model or PROVIDER_MODELS["openai"],
            timeout,
            instance_id,
            default_system_prompt,
        )
        self.client = openai.OpenAI(api_key=api_key, timeout=timeout)

    def generate(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: str | None = None,
    ) -> str:
        effective_system_prompt = self.get_effective_system_prompt(system_prompt)
        messages = []
        if effective_system_prompt:
            messages.append({"role": "system", "content": effective_system_prompt})
        messages.append({"role": "user", "content": prompt})

        kwargs = {
            "model": self.model,
            "temperature": temperature,
            "messages": messages,
        }
        if _uses_max_completion_tokens(self.model):
            kwargs["max_completion_tokens"] = max_tokens
        else:
            kwargs["max_tokens"] = max_tokens

        response = self.client.chat.completions.create(**kwargs)
        return response.choices[0].message.content


class GeminiProvider(BaseProvider):
    """Google Gemini provider."""

    @property
    def name(self) -> str:
        return "google"

    def __init__(
        self,
        api_key: str,
        model: str | None = None,
        timeout: float = DEFAULT_TIMEOUT,
        instance_id: str | None = None,
        default_system_prompt: str | None = None,
    ):
        super().__init__(
            api_key,
            model or PROVIDER_MODELS["google"],
            timeout,
            instance_id,
            default_system_prompt,
        )
        genai.configure(api_key=api_key)
        self._model_name = self.model

    def generate(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: str | None = None,
    ) -> str:
        effective_system_prompt = self.get_effective_system_prompt(system_prompt)
        # Create model instance with optional system instruction
        model_kwargs = {}
        if effective_system_prompt:
            model_kwargs["system_instruction"] = effective_system_prompt

        model_instance = genai.GenerativeModel(self._model_name, **model_kwargs)

        generation_config = genai.types.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        response = model_instance.generate_content(
            prompt,
            generation_config=generation_config,
        )
        return response.text


class GrokProvider(BaseProvider):
    """xAI Grok provider (uses OpenAI-compatible API)."""

    @property
    def name(self) -> str:
        return "xai"

    def __init__(
        self,
        api_key: str,
        model: str | None = None,
        timeout: float = DEFAULT_TIMEOUT,
        instance_id: str | None = None,
        default_system_prompt: str | None = None,
    ):
        super().__init__(
            api_key,
            model or PROVIDER_MODELS["xai"],
            timeout,
            instance_id,
            default_system_prompt,
        )
        self.client = openai.OpenAI(
            api_key=api_key,
            base_url="https://api.x.ai/v1",
            timeout=timeout,
        )

    def generate(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: str | None = None,
    ) -> str:
        effective_system_prompt = self.get_effective_system_prompt(system_prompt)
        messages = []
        if effective_system_prompt:
            messages.append({"role": "system", "content": effective_system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = self.client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=messages,
        )
        return response.choices[0].message.content


def convert_legacy_models(models: list[str]) -> list[ModelInstance]:
    """Convert old-style model list to ModelInstance list.

    Args:
        models: List of provider names (e.g., ["anthropic", "openai"])

    Returns:
        List of ModelInstance objects with default names
    """
    return [
        ModelInstance(
            provider=model,
            name=MODEL_NAMES.get(model, model.title()),  # "Claude", "GPT", etc.
            instance_id=model,  # Use provider name as instance_id for legacy
            system_prompt=None,
        )
        for model in models
    ]


def create_providers(
    api_keys: dict, models: list[str] | list[ModelInstance]
) -> dict[str, BaseProvider]:
    """
    Create provider instances for requested models.

    Supports both legacy format (list of provider name strings) and new format
    (list of ModelInstance objects). Legacy format is auto-converted.

    Args:
        api_keys: Dict of provider -> api_key
        models: List of model names (legacy) or ModelInstance objects (new)

    Returns:
        Dict of instance_id -> provider_instance

    Raises:
        ValueError: If required API key is missing or duplicate instance IDs
    """
    # Auto-convert if legacy format (list of strings)
    if models and isinstance(models[0], str):
        model_instances = convert_legacy_models(models)
    else:
        model_instances = models

    # Validate unique instance_ids
    ids = [m.instance_id for m in model_instances]
    if len(ids) != len(set(ids)):
        dupes = [id for id in ids if ids.count(id) > 1]
        raise ValueError(
            f"Duplicate instance IDs: {set(dupes)}. Each instance must have a unique name."
        )

    # Check if using OpenRouter
    if api_keys.get("openrouter"):
        from lib.openrouter import create_openrouter_providers

        return create_openrouter_providers(api_keys["openrouter"], model_instances)

    # Create individual providers
    provider_classes = {
        "anthropic": AnthropicProvider,
        "openai": OpenAIProvider,
        "google": GeminiProvider,
        "xai": GrokProvider,
    }

    providers = {}
    for instance in model_instances:
        if instance.provider not in provider_classes:
            raise ValueError(f"Unknown provider: {instance.provider}")

        api_key = api_keys.get(instance.provider)
        if not api_key:
            raise ValueError(
                f"Missing API key for {instance.provider}. Please add it in the sidebar."
            )

        providers[instance.instance_id] = provider_classes[instance.provider](
            api_key,
            instance_id=instance.instance_id,
            default_system_prompt=instance.system_prompt,
        )

    return providers


def _call_provider(
    provider: BaseProvider,
    prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    system_prompt: str | None = None,
    instance_id: str | None = None,
    display_name: str | None = None,
) -> ModelResponse:
    """Call a provider and return response with error handling.

    Args:
        provider: The provider to call
        prompt: The prompt to send
        temperature: Sampling temperature
        max_tokens: Maximum tokens in response
        system_prompt: Optional system prompt
        instance_id: Unique identifier for this instance (for tracking)
        display_name: Human-readable name for display

    Returns:
        ModelResponse with instance metadata
    """
    # Use provider's instance_id as fallback
    effective_instance_id = instance_id or provider.instance_id
    effective_display_name = display_name or MODEL_NAMES.get(provider.name, provider.name.title())

    try:
        content = provider.generate(prompt, temperature, max_tokens, system_prompt)
        return ModelResponse(
            provider=provider.name,
            content=content,
            instance_id=effective_instance_id,
            display_name=effective_display_name,
        )
    except anthropic.APIConnectionError:
        return ModelResponse(
            provider=provider.name,
            content="",
            error="Cannot connect to Anthropic API. Check your internet connection.",
            instance_id=effective_instance_id,
            display_name=effective_display_name,
        )
    except anthropic.AuthenticationError:
        return ModelResponse(
            provider=provider.name,
            content="",
            error="Invalid Anthropic API key. Please check your key in the sidebar.",
            instance_id=effective_instance_id,
            display_name=effective_display_name,
        )
    except anthropic.RateLimitError:
        return ModelResponse(
            provider=provider.name,
            content="",
            error="Anthropic rate limit exceeded. Please wait and try again.",
            instance_id=effective_instance_id,
            display_name=effective_display_name,
        )
    except openai.APIConnectionError:
        return ModelResponse(
            provider=provider.name,
            content="",
            error=f"Cannot connect to {provider.name} API. Check your internet connection.",
            instance_id=effective_instance_id,
            display_name=effective_display_name,
        )
    except openai.AuthenticationError:
        return ModelResponse(
            provider=provider.name,
            content="",
            error=f"Invalid {provider.name} API key. Please check your key in the sidebar.",
            instance_id=effective_instance_id,
            display_name=effective_display_name,
        )
    except openai.RateLimitError:
        return ModelResponse(
            provider=provider.name,
            content="",
            error=f"{provider.name} rate limit exceeded. Please wait and try again.",
            instance_id=effective_instance_id,
            display_name=effective_display_name,
        )
    except Exception as e:
        return ModelResponse(
            provider=provider.name,
            content="",
            error=str(e),
            instance_id=effective_instance_id,
            display_name=effective_display_name,
        )


def _create_run_directory(flow_name: str) -> Path:
    """Create a timestamped directory for this run's output files."""
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    # Sanitize flow name for use in directory name
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in flow_name)
    run_dir = OUTPUTS_DIR / f"run_{timestamp}_{safe_name}"
    run_dir.mkdir(parents=True, exist_ok=True)

    return run_dir


def _save_response_to_file(
    run_dir: Path,
    round_number: int,
    instance_id: str,
    content: str,
    task_prompt: str,
    is_synthesis: bool = False,
    display_name: str | None = None,
) -> None:
    """Save a model response to a markdown file.

    Args:
        run_dir: Directory to save the file
        round_number: Round number for filename
        instance_id: Unique instance identifier (used in filename)
        content: Response content to save
        task_prompt: Original task prompt
        is_synthesis: Whether this is the final synthesis
        display_name: Human-readable name for the header (defaults to instance_id)
    """
    # Use display_name for header, fallback to instance_id
    header_name = display_name or instance_id

    if is_synthesis:
        filename = "final_synthesis.md"
    else:
        filename = f"round_{round_number}_{instance_id}.md"

    filepath = run_dir / filename

    # Build file content with metadata header
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    header = f"""---
round: {round_number if not is_synthesis else "final"}
provider: {instance_id}
timestamp: {timestamp}
---

# {"Final Synthesis" if is_synthesis else f"Round {round_number} - {header_name}"}

"""

    # Write file
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(header)
        f.write(content)


def run_basic_flow(
    flow: dict,
    task_prompt: str,
    providers: dict[str, BaseProvider],
    progress_callback: Callable[[int, str], None] | None = None,
) -> FlowResults:
    """
    Execute a basic (round-robin) flow.

    All models respond independently in round 1, then see each other's work
    and refine in subsequent rounds.

    Args:
        flow: Flow configuration dict
        task_prompt: User's task/question to send to models
        providers: Dict of instance_id -> provider_instance
        progress_callback: Optional callback(round_number, status_message)

    Returns:
        FlowResults with all rounds
    """
    flow_name = flow.get("name", "Unnamed")
    results = FlowResults(
        flow_name=flow_name,
        flow_type="basic",
    )

    # Create output directory for this run
    run_dir = _create_run_directory(flow_name)
    results.output_dir = str(run_dir)

    max_rounds = flow.get("max_rounds", 2)
    temperature = flow.get("temperature", 0.7)
    max_tokens = flow.get("max_tokens", 2048)
    prompts = flow.get("prompts", {})
    system_prompt = flow.get("system_prompt", DEFAULT_SYSTEM_PROMPT)

    # Previous round responses for refinement (keyed by instance_id)
    prev_responses: dict[str, str] = {}
    # Display names for peer output (keyed by instance_id)
    display_names: dict[str, str] = {}

    # Build display names lookup from providers
    for instance_id, provider in providers.items():
        display_names[instance_id] = MODEL_NAMES.get(provider.name, provider.name.title())

    for round_num in range(1, max_rounds + 1):
        # Check for cancellation before each round
        if is_cancelled():
            raise FlowCancelledError("Flow cancelled by user")

        if progress_callback:
            progress_callback(round_num, f"Round {round_num}: Processing...")

        round_result = RoundResult(round_number=round_num)

        # Build prompts for this round (keyed by instance_id)
        if round_num == 1:
            # First round: initial prompt + task
            base_prompt = prompts.get("round_1", "Please respond to the following task:")
            model_prompts = {
                instance_id: f"{base_prompt}\n\n{task_prompt}"
                for instance_id in providers.keys()
            }
        else:
            # Refinement rounds: include peer responses
            refinement_prompt = prompts.get(
                "refinement",
                "Review peer responses and refine your answer:",
            )

            model_prompts = {}
            for instance_id in providers.keys():
                # Gather peer responses using display names
                peer_outputs = []
                for peer_id, peer_response in prev_responses.items():
                    if peer_id != instance_id:
                        peer_display = display_names.get(peer_id, peer_id)
                        peer_outputs.append(f"**{peer_display}:**\n{peer_response}")

                model_prompts[instance_id] = f"""{refinement_prompt}

**Your previous response:**
{prev_responses.get(instance_id, "(none)")}

**Peer responses:**
{chr(10).join(peer_outputs)}

**Task reminder:**
{task_prompt}

Please provide your refined response:"""

        # Execute all providers in parallel
        with ThreadPoolExecutor(max_workers=len(providers)) as executor:
            futures = {
                executor.submit(
                    _call_provider,
                    provider,
                    model_prompts[instance_id],
                    temperature,
                    max_tokens,
                    system_prompt,
                    instance_id,  # Pass instance_id
                    display_names.get(instance_id),  # Pass display_name
                ): instance_id
                for instance_id, provider in providers.items()
            }

            for future in as_completed(futures):
                instance_id = futures[future]  # Get instance_id from our mapping
                response = future.result()
                round_result.responses.append(response)
                # Store for next round and save to file (keyed by instance_id)
                if not response.error:
                    prev_responses[instance_id] = response.content
                    # Save response to markdown file using instance_id
                    _save_response_to_file(
                        run_dir,
                        round_num,
                        instance_id,
                        response.content,
                        task_prompt,
                        display_name=display_names.get(instance_id),
                    )

        results.rounds.append(round_result)

    return results


def run_leading_flow(
    flow: dict,
    task_prompt: str,
    providers: dict[str, BaseProvider],
    progress_callback: Callable[[int, str], None] | None = None,
) -> FlowResults:
    """
    Execute a leading (hub-and-spoke) flow.

    One model acts as leader and synthesizes contributions from all others.

    Args:
        flow: Flow configuration dict
        task_prompt: User's task/question to send to models
        providers: Dict of instance_id -> provider_instance
        progress_callback: Optional callback(round_number, status_message)

    Returns:
        FlowResults with all rounds and final synthesis
    """
    leader_instance_id = flow.get("default_leader", list(providers.keys())[0])
    if leader_instance_id not in providers:
        raise ValueError(f"Leader {leader_instance_id} not in providers")

    flow_name = flow.get("name", "Unnamed")
    results = FlowResults(
        flow_name=flow_name,
        flow_type="leading",
        leader=leader_instance_id,
    )

    # Create output directory for this run
    run_dir = _create_run_directory(flow_name)
    results.output_dir = str(run_dir)

    max_rounds = flow.get("max_rounds", 2)
    temperature = flow.get("temperature", 0.7)
    max_tokens = flow.get("max_tokens", 2048)
    prompts = flow.get("prompts", {})
    system_prompt = flow.get("system_prompt", DEFAULT_SYSTEM_PROMPT)

    # Build display names lookup from providers
    display_names: dict[str, str] = {}
    for instance_id, provider in providers.items():
        display_names[instance_id] = MODEL_NAMES.get(provider.name, provider.name.title())

    # Separate leader and contributors (by instance_id)
    leader_provider = providers[leader_instance_id]
    leader_display_name = display_names[leader_instance_id]
    contributor_providers = {k: v for k, v in providers.items() if k != leader_instance_id}

    # Previous responses keyed by instance_id
    prev_responses: dict[str, str] = {}
    leader_synthesis = ""

    for round_num in range(1, max_rounds + 1):
        # Check for cancellation before each round
        if is_cancelled():
            raise FlowCancelledError("Flow cancelled by user")

        if progress_callback:
            progress_callback(round_num, f"Round {round_num}: Processing...")

        round_result = RoundResult(round_number=round_num)

        if round_num == 1:
            # Round 1: All ideate independently (including leader)
            base_prompt = prompts.get("round_1", "Please respond to the following task:")
            full_prompt = f"{base_prompt}\n\n{task_prompt}"

            with ThreadPoolExecutor(max_workers=len(providers)) as executor:
                futures = {
                    executor.submit(
                        _call_provider,
                        provider,
                        full_prompt,
                        temperature,
                        max_tokens,
                        system_prompt,
                        instance_id,  # Pass instance_id
                        display_names.get(instance_id),  # Pass display_name
                    ): instance_id
                    for instance_id, provider in providers.items()
                }

                for future in as_completed(futures):
                    instance_id = futures[future]  # Get instance_id from our mapping
                    response = future.result()
                    round_result.responses.append(response)
                    if not response.error:
                        prev_responses[instance_id] = response.content
                        _save_response_to_file(
                            run_dir,
                            round_num,
                            instance_id,
                            response.content,
                            task_prompt,
                            display_name=display_names.get(instance_id),
                        )

        elif round_num % 2 == 0:
            # Even rounds: Leader synthesizes
            synthesis_prompt = prompts.get(
                "leader_synthesis",
                "Synthesize all contributions into a unified response:",
            )

            # Use display names for contribution output
            all_contributions = []
            for inst_id, content in prev_responses.items():
                contrib_display = display_names.get(inst_id, inst_id)
                all_contributions.append(f"**{contrib_display}:**\n{content}")

            leader_prompt = f"""{synthesis_prompt}

**Contributions:**
{chr(10).join(all_contributions)}

**Task:**
{task_prompt}

Please provide your synthesis:"""

            response = _call_provider(
                leader_provider,
                leader_prompt,
                temperature,
                max_tokens,
                system_prompt,
                leader_instance_id,  # Pass instance_id
                leader_display_name,  # Pass display_name
            )
            round_result.responses.append(response)
            if not response.error:
                leader_synthesis = response.content
                prev_responses[leader_instance_id] = response.content
                _save_response_to_file(
                    run_dir,
                    round_num,
                    leader_instance_id,
                    response.content,
                    task_prompt,
                    display_name=leader_display_name,
                )

        else:
            # Odd rounds (after 1): Contributors respond to leader's synthesis
            refinement_prompt = prompts.get(
                "refinement",
                "Review the leader's synthesis and provide your refined perspective:",
            )

            contributor_prompt = f"""{refinement_prompt}

**Leader's synthesis:**
{leader_synthesis}

**Your previous response:**
{{prev_response}}

**Task:**
{task_prompt}

Please provide your refined perspective:"""

            with ThreadPoolExecutor(max_workers=len(contributor_providers)) as executor:
                futures = {
                    executor.submit(
                        _call_provider,
                        provider,
                        contributor_prompt.format(prev_response=prev_responses.get(instance_id, "(none)")),
                        temperature,
                        max_tokens,
                        system_prompt,
                        instance_id,  # Pass instance_id
                        display_names.get(instance_id),  # Pass display_name
                    ): instance_id
                    for instance_id, provider in contributor_providers.items()
                }

                for future in as_completed(futures):
                    instance_id = futures[future]  # Get instance_id from our mapping
                    response = future.result()
                    round_result.responses.append(response)
                    if not response.error:
                        prev_responses[instance_id] = response.content
                        _save_response_to_file(
                            run_dir,
                            round_num,
                            instance_id,
                            response.content,
                            task_prompt,
                            display_name=display_names.get(instance_id),
                        )

        results.rounds.append(round_result)

    # Check for cancellation before final synthesis
    if is_cancelled():
        raise FlowCancelledError("Flow cancelled by user")

    # Final synthesis by leader
    if progress_callback:
        progress_callback(max_rounds + 1, "Final synthesis...")

    final_prompt = prompts.get(
        "leader_synthesis",
        "Provide the final, comprehensive synthesis:",
    )

    # Use display names for contribution output
    all_contributions = []
    for inst_id, content in prev_responses.items():
        contrib_display = display_names.get(inst_id, inst_id)
        all_contributions.append(f"**{contrib_display}:**\n{content}")

    final_leader_prompt = f"""{final_prompt}

This is the final round. Please provide a comprehensive synthesis that:
1. Integrates the best insights from all contributors
2. Resolves any conflicting perspectives
3. Provides a clear, actionable conclusion

**All contributions:**
{chr(10).join(all_contributions)}

**Original task:**
{task_prompt}

**Your final synthesis:**"""

    final_response = _call_provider(
        leader_provider,
        final_leader_prompt,
        temperature,
        max_tokens,
        system_prompt,
        leader_instance_id,  # Pass instance_id
        leader_display_name,  # Pass display_name
    )

    if not final_response.error:
        results.final_synthesis = final_response.content
        # Save final synthesis to file
        _save_response_to_file(
            run_dir,
            max_rounds + 1,
            leader_instance_id,
            final_response.content,
            task_prompt,
            is_synthesis=True,
            display_name=leader_display_name,
        )
    else:
        results.final_synthesis = f"Error generating final synthesis: {final_response.error}"

    return results


def init_leading_flow_state(
    flow: dict,
    task_prompt: str,
    providers: dict[str, BaseProvider],
) -> LeadingFlowState:
    """
    Initialize state for step-by-step leading flow execution.

    Args:
        flow: Flow configuration dict
        task_prompt: User's task/question
        providers: Dict of instance_id -> provider_instance

    Returns:
        LeadingFlowState ready for step-by-step execution
    """
    leader_instance_id = flow.get("default_leader", list(providers.keys())[0])
    if leader_instance_id not in providers:
        raise ValueError(f"Leader {leader_instance_id} not in providers")

    flow_name = flow.get("name", "Unnamed")
    run_dir = _create_run_directory(flow_name)

    # Build display names lookup from providers
    display_names: dict[str, str] = {}
    for instance_id, provider in providers.items():
        display_names[instance_id] = MODEL_NAMES.get(provider.name, provider.name.title())

    leader_display_name = display_names[leader_instance_id]

    results = FlowResults(
        flow_name=flow_name,
        flow_type="leading",
        leader=leader_instance_id,
        output_dir=str(run_dir),
    )

    return LeadingFlowState(
        flow_config=flow,
        task_prompt=task_prompt,
        leader_instance_id=leader_instance_id,
        leader_display_name=leader_display_name,
        max_rounds=flow.get("max_rounds", 2),
        temperature=flow.get("temperature", 0.7),
        max_tokens=flow.get("max_tokens", 2048),
        prompts=flow.get("prompts", {}),
        system_prompt=flow.get("system_prompt", DEFAULT_SYSTEM_PROMPT),
        display_names=display_names,
        run_dir=run_dir,
        results=results,
    )


def run_leading_flow_step(
    state: LeadingFlowState,
    providers: dict[str, BaseProvider],
    edited_synthesis: str | None = None,
) -> LeadingFlowState:
    """
    Execute one step of the leading flow.

    After leader synthesis rounds (even rounds), sets pending_review=True
    to pause for user review. Call again with edited_synthesis to continue.

    Args:
        state: Current flow state
        providers: Dict of instance_id -> provider_instance
        edited_synthesis: Optional edited synthesis from user review

    Returns:
        Updated LeadingFlowState
    """
    # Check for cancellation
    if is_cancelled():
        state.error = "Flow cancelled by user"
        return state

    # If we were pending review and got edited synthesis, apply it
    if state.pending_review and edited_synthesis is not None:
        state.leader_synthesis = edited_synthesis
        state.prev_responses[state.leader_instance_id] = edited_synthesis
        state.pending_review = False
        # Don't increment round - we already did when we set pending_review

    # If still pending review (no edit provided), just return
    if state.pending_review:
        return state

    # Increment round
    state.current_round += 1
    round_num = state.current_round

    # Check if we've exceeded max rounds
    if round_num > state.max_rounds:
        # Do final synthesis
        return _do_final_synthesis(state, providers)

    leader_provider = providers[state.leader_instance_id]
    contributor_providers = {k: v for k, v in providers.items() if k != state.leader_instance_id}

    round_result = RoundResult(round_number=round_num)

    try:
        if round_num == 1:
            # Round 1: All ideate independently (including leader)
            base_prompt = state.prompts.get("round_1", "Please respond to the following task:")
            full_prompt = f"{base_prompt}\n\n{state.task_prompt}"

            with ThreadPoolExecutor(max_workers=len(providers)) as executor:
                futures = {
                    executor.submit(
                        _call_provider,
                        provider,
                        full_prompt,
                        state.temperature,
                        state.max_tokens,
                        state.system_prompt,
                        instance_id,  # Pass instance_id
                        state.display_names.get(instance_id),  # Pass display_name
                    ): instance_id
                    for instance_id, provider in providers.items()
                }

                for future in as_completed(futures):
                    instance_id = futures[future]  # Get instance_id from our mapping
                    response = future.result()
                    round_result.responses.append(response)
                    if not response.error:
                        state.prev_responses[instance_id] = response.content
                        _save_response_to_file(
                            state.run_dir,
                            round_num,
                            instance_id,
                            response.content,
                            state.task_prompt,
                            display_name=state.display_names.get(instance_id),
                        )

        elif round_num % 2 == 0:
            # Even rounds: Leader synthesizes
            synthesis_prompt = state.prompts.get(
                "leader_synthesis",
                "Synthesize all contributions into a unified response:",
            )

            # Use display names for contribution output
            all_contributions = []
            for inst_id, content in state.prev_responses.items():
                contrib_display = state.display_names.get(inst_id, inst_id)
                all_contributions.append(f"**{contrib_display}:**\n{content}")

            leader_prompt = f"""{synthesis_prompt}

**Contributions:**
{chr(10).join(all_contributions)}

**Task:**
{state.task_prompt}

Please provide your synthesis:"""

            response = _call_provider(
                leader_provider,
                leader_prompt,
                state.temperature,
                state.max_tokens,
                state.system_prompt,
                state.leader_instance_id,  # Pass instance_id
                state.leader_display_name,  # Pass display_name
            )
            round_result.responses.append(response)
            if not response.error:
                state.leader_synthesis = response.content
                state.prev_responses[state.leader_instance_id] = response.content
                _save_response_to_file(
                    state.run_dir,
                    round_num,
                    state.leader_instance_id,
                    response.content,
                    state.task_prompt,
                    display_name=state.leader_display_name,
                )
                # Pause for user review after leader synthesis
                state.pending_review = True
            else:
                state.error = f"Leader synthesis error: {response.error}"

        else:
            # Odd rounds (after 1): Contributors respond to leader's synthesis
            refinement_prompt = state.prompts.get(
                "refinement",
                "Review the leader's synthesis and provide your refined perspective:",
            )

            contributor_prompt = f"""{refinement_prompt}

**Leader's synthesis:**
{state.leader_synthesis}

**Your previous response:**
{{prev_response}}

**Task:**
{state.task_prompt}

Please provide your refined perspective:"""

            with ThreadPoolExecutor(max_workers=len(contributor_providers)) as executor:
                futures = {
                    executor.submit(
                        _call_provider,
                        provider,
                        contributor_prompt.format(prev_response=state.prev_responses.get(instance_id, "(none)")),
                        state.temperature,
                        state.max_tokens,
                        state.system_prompt,
                        instance_id,  # Pass instance_id
                        state.display_names.get(instance_id),  # Pass display_name
                    ): instance_id
                    for instance_id, provider in contributor_providers.items()
                }

                for future in as_completed(futures):
                    instance_id = futures[future]  # Get instance_id from our mapping
                    response = future.result()
                    round_result.responses.append(response)
                    if not response.error:
                        state.prev_responses[instance_id] = response.content
                        _save_response_to_file(
                            state.run_dir,
                            round_num,
                            instance_id,
                            response.content,
                            state.task_prompt,
                            display_name=state.display_names.get(instance_id),
                        )

        state.results.rounds.append(round_result)

    except Exception as e:
        state.error = str(e)

    return state


def _do_final_synthesis(
    state: LeadingFlowState,
    providers: dict[str, BaseProvider],
) -> LeadingFlowState:
    """Generate final synthesis and mark flow complete."""
    leader_provider = providers[state.leader_instance_id]

    final_prompt = state.prompts.get(
        "leader_synthesis",
        "Provide the final, comprehensive synthesis:",
    )

    # Use display names for contribution output
    all_contributions = []
    for inst_id, content in state.prev_responses.items():
        contrib_display = state.display_names.get(inst_id, inst_id)
        all_contributions.append(f"**{contrib_display}:**\n{content}")

    final_leader_prompt = f"""{final_prompt}

This is the final round. Please provide a comprehensive synthesis that:
1. Integrates the best insights from all contributors
2. Resolves any conflicting perspectives
3. Provides a clear, actionable conclusion

**All contributions:**
{chr(10).join(all_contributions)}

**Original task:**
{state.task_prompt}

**Your final synthesis:**"""

    final_response = _call_provider(
        leader_provider,
        final_leader_prompt,
        state.temperature,
        state.max_tokens,
        state.system_prompt,
        state.leader_instance_id,  # Pass instance_id
        state.leader_display_name,  # Pass display_name
    )

    if not final_response.error:
        state.results.final_synthesis = final_response.content
        _save_response_to_file(
            state.run_dir,
            state.max_rounds + 1,
            state.leader_instance_id,
            final_response.content,
            state.task_prompt,
            is_synthesis=True,
            display_name=state.leader_display_name,
        )
    else:
        state.results.final_synthesis = f"Error generating final synthesis: {final_response.error}"
        state.error = final_response.error

    state.is_complete = True
    return state
