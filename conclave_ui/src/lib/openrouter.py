"""
OpenRouter provider for unified API access to multiple LLM providers.

OpenRouter provides a single API key that can access multiple models including:
- Premium providers (Anthropic, OpenAI, Google, xAI)
- Open source providers (DeepSeek, Meta, Mistral, Qwen)
- Other models (Microsoft, NVIDIA)

API Documentation: https://openrouter.ai/docs
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING

import openai

from lib.executor import BaseProvider, DEFAULT_TIMEOUT, MODEL_NAMES

if TYPE_CHECKING:
    from lib.executor import ModelInstance


# =============================================================================
# OpenRouter Model Mappings
# =============================================================================

# Maps our internal provider names to default OpenRouter model IDs
# Used when provider is selected but no specific model is chosen
OPENROUTER_DEFAULT_MODELS = {
    # Premium providers
    "anthropic": "anthropic/claude-sonnet-4-6",
    "openai": "openai/gpt-5.2",
    "google": "google/gemini-3-pro-preview",
    "xai": "x-ai/grok-3",

    # Open source providers
    "deepseek": "deepseek/deepseek-r1",
    "meta": "meta-llama/llama-4-scout",
    "mistral": "mistralai/mistral-large-2411",
    "qwen": "qwen/qwen3-235b-a22b",

    # Other providers
    "microsoft": "microsoft/phi-4",
    "nvidia": "nvidia/nemotron-3-nano-30b-a3b:free",
}


# Maps specific model IDs to OpenRouter format
# Format: "our-model-id" -> "openrouter/model-id"
OPENROUTER_MODEL_ID_MAP = {
    # ==========================================================================
    # Premium Providers
    # ==========================================================================

    # Anthropic Claude
    "claude-opus-4-6": "anthropic/claude-opus-4-6",
    "claude-sonnet-4-6": "anthropic/claude-sonnet-4-6",
    "claude-haiku-4-5-20251001": "anthropic/claude-haiku-4-5-20251001",
    "claude-opus-4-5-20251101": "anthropic/claude-opus-4-5-20251101",
    "claude-opus-4-20250514": "anthropic/claude-opus-4-20250514",
    "claude-sonnet-4-20250514": "anthropic/claude-sonnet-4-20250514",

    # OpenAI
    "gpt-5.2": "openai/gpt-5.2",
    "gpt-5.1": "openai/gpt-5.1",
    "gpt-5": "openai/gpt-5",
    "gpt-5-mini": "openai/gpt-5-mini",
    "gpt-5-nano": "openai/gpt-5-nano",
    "gpt-4.1": "openai/gpt-4.1",
    "gpt-4.1-mini": "openai/gpt-4.1-mini",
    "gpt-4.1-nano": "openai/gpt-4.1-nano",
    "o3": "openai/o3",
    "o4-mini": "openai/o4-mini",

    # Google Gemini
    "gemini-3-pro-preview": "google/gemini-3-pro-preview",
    "gemini-3-flash-preview": "google/gemini-3-flash-preview",
    "gemini-2.5-pro": "google/gemini-2.5-pro-preview-05-06",
    "gemini-2.5-flash": "google/gemini-2.5-flash-preview-05-20",
    "gemini-2.5-flash-lite": "google/gemini-2.5-flash-lite-preview",

    # xAI Grok
    "grok-3": "x-ai/grok-3",
    "grok-3-fast": "x-ai/grok-3-fast",
    "grok-3-mini": "x-ai/grok-3-mini",
    "grok-3-mini-fast": "x-ai/grok-3-mini-fast",

    # ==========================================================================
    # Open Source Providers (via OpenRouter)
    # ==========================================================================

    # DeepSeek
    "deepseek-r1": "deepseek/deepseek-r1",
    "deepseek-chat-v3": "deepseek/deepseek-chat",
    "deepseek-r1-free": "deepseek/deepseek-r1-0528:free",

    # Meta (Llama)
    "llama-4-scout": "meta-llama/llama-4-scout",
    "llama-4-maverick": "meta-llama/llama-4-maverick",

    # Mistral
    "mistral-large-2411": "mistralai/mistral-large-2411",
    "mistral-small-3.1-24b": "mistralai/mistral-small-3.1-24b-instruct",
    "codestral-2508": "mistralai/codestral-2508",

    # Qwen
    "qwen3-235b-a22b": "qwen/qwen3-235b-a22b",
    "qwen3-32b": "qwen/qwen3-32b",
    "qwq-32b": "qwen/qwq-32b",

    # Microsoft
    "phi-4": "microsoft/phi-4",

    # NVIDIA
    "nemotron-30b-free": "nvidia/nemotron-3-nano-30b-a3b:free",
}


# Provider display names
OPENROUTER_PROVIDER_NAMES = {
    "anthropic": "Claude",
    "openai": "GPT",
    "google": "Gemini",
    "xai": "Grok",
    "deepseek": "DeepSeek",
    "meta": "Llama",
    "mistral": "Mistral",
    "qwen": "Qwen",
    "microsoft": "Phi",
    "nvidia": "Nemotron",
}


# Rate limit configuration
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 2


# =============================================================================
# Helper Functions
# =============================================================================

def get_openrouter_model_id(model_id: str, provider: str | None = None) -> str:
    """
    Convert Conclave model ID to OpenRouter model ID.

    Args:
        model_id: Conclave model ID (e.g., "deepseek-r1")
        provider: Optional provider name for fallback

    Returns:
        OpenRouter model ID (e.g., "deepseek/deepseek-r1")
    """
    # First check explicit model ID map
    if model_id in OPENROUTER_MODEL_ID_MAP:
        return OPENROUTER_MODEL_ID_MAP[model_id]

    # If model_id already contains "/", assume it's already in OpenRouter format
    if "/" in model_id:
        return model_id

    # Fall back to provider's default model
    if provider and provider in OPENROUTER_DEFAULT_MODELS:
        return OPENROUTER_DEFAULT_MODELS[provider]

    # Last resort: assume it's a valid OpenRouter model ID
    return model_id


def is_openrouter_provider(provider: str) -> bool:
    """Check if a provider should be routed through OpenRouter."""
    return provider in OPENROUTER_DEFAULT_MODELS


def is_open_source_provider(provider: str) -> bool:
    """Check if a provider is an open source model (requires OpenRouter)."""
    open_source = {"deepseek", "meta", "mistral", "qwen", "microsoft", "nvidia"}
    return provider.lower() in open_source


# =============================================================================
# OpenRouter Provider Class
# =============================================================================

class OpenRouterProvider(BaseProvider):
    """
    Provider that routes requests through OpenRouter's unified API.

    Uses OpenAI-compatible SDK with OpenRouter's base URL.
    Supports all models in OPENROUTER_MODEL_ID_MAP.
    """

    def __init__(
        self,
        api_key: str,
        provider_name: str,
        model: str | None = None,
        timeout: float = DEFAULT_TIMEOUT,
        instance_id: str | None = None,
        default_system_prompt: str | None = None,
    ):
        """
        Initialize OpenRouter provider.

        Args:
            api_key: OpenRouter API key
            provider_name: Internal provider name (anthropic, openai, deepseek, etc.)
            model: Optional specific model ID
            timeout: Request timeout in seconds
            instance_id: Unique identifier for this instance
            default_system_prompt: Default system prompt for this instance
        """
        # Get the OpenRouter model ID
        if model:
            openrouter_model = get_openrouter_model_id(model, provider_name)
        else:
            openrouter_model = OPENROUTER_DEFAULT_MODELS.get(provider_name)
            if not openrouter_model:
                raise ValueError(f"Unknown provider for OpenRouter: {provider_name}")

        super().__init__(
            api_key,
            openrouter_model,
            timeout,
            instance_id,
            default_system_prompt,
        )
        self._provider_name = provider_name

        # Create OpenAI client with OpenRouter base URL
        self.client = openai.OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            timeout=timeout,
            default_headers={
                "HTTP-Referer": "https://conclave.ai",
                "X-Title": "Conclave",
            },
        )

    @property
    def name(self) -> str:
        """Provider name (e.g., 'deepseek', 'meta')."""
        return self._provider_name

    def generate(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: str | None = None,
    ) -> str:
        """
        Generate a response using OpenRouter.

        Includes retry logic for rate limits with exponential backoff.

        Args:
            prompt: The user prompt/task
            temperature: Sampling temperature
            max_tokens: Maximum tokens in response
            system_prompt: Optional system instructions

        Returns:
            Generated text content

        Raises:
            openai.APIConnectionError: Connection issues
            openai.AuthenticationError: Invalid API key
            openai.RateLimitError: Rate limit exceeded after retries
        """
        effective_system_prompt = self.get_effective_system_prompt(system_prompt)
        messages = []
        if effective_system_prompt:
            messages.append({"role": "system", "content": effective_system_prompt})
        messages.append({"role": "user", "content": prompt})

        # Retry logic for rate limits
        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    messages=messages,
                )
                return response.choices[0].message.content

            except openai.RateLimitError as e:
                last_error = e
                if attempt < MAX_RETRIES - 1:
                    # Exponential backoff
                    wait_time = RETRY_DELAY_SECONDS * (2 ** attempt)
                    time.sleep(wait_time)
                continue

        # All retries exhausted
        if last_error:
            raise last_error

        raise RuntimeError("Failed to generate response after retries")


# =============================================================================
# Factory Functions
# =============================================================================

def create_openrouter_providers(
    api_key: str,
    models: list[str] | list[ModelInstance],
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, OpenRouterProvider]:
    """
    Create OpenRouter providers for all requested models.

    Supports both legacy format (list of provider name strings) and new format
    (list of ModelInstance objects). Legacy format is auto-converted.

    Args:
        api_key: OpenRouter API key
        models: List of provider names (legacy) or ModelInstance objects (new)
        timeout: Request timeout in seconds

    Returns:
        Dict of instance_id -> OpenRouterProvider
    """
    from lib.executor import ModelInstance

    # Auto-convert if legacy format (list of strings)
    if models and isinstance(models[0], str):
        model_instances = [
            ModelInstance(
                provider=model,
                name=MODEL_NAMES.get(model, OPENROUTER_PROVIDER_NAMES.get(model, model.title())),
                instance_id=model,
                system_prompt=None,
            )
            for model in models
        ]
    else:
        model_instances = models

    providers = {}

    for instance in model_instances:
        # Check if provider is supported
        if instance.provider not in OPENROUTER_DEFAULT_MODELS:
            raise ValueError(
                f"Unknown provider for OpenRouter: {instance.provider}. "
                f"Available: {list(OPENROUTER_DEFAULT_MODELS.keys())}"
            )

        # Get model ID - prefer explicit model_id, fall back to default
        model_id = instance.model_id if instance.model_id else None

        providers[instance.instance_id] = OpenRouterProvider(
            api_key,
            instance.provider,
            model=model_id,
            timeout=timeout,
            instance_id=instance.instance_id,
            default_system_prompt=instance.system_prompt,
        )

    return providers


def create_single_openrouter_provider(
    api_key: str,
    model_id: str,
    provider_name: str,
    instance_id: str | None = None,
    system_prompt: str | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> OpenRouterProvider:
    """
    Create a single OpenRouter provider for a specific model.

    Args:
        api_key: OpenRouter API key
        model_id: Conclave model ID
        provider_name: Original provider name
        instance_id: Optional instance identifier
        system_prompt: Optional default system prompt
        timeout: Request timeout

    Returns:
        Configured OpenRouterProvider instance
    """
    return OpenRouterProvider(
        api_key=api_key,
        provider_name=provider_name,
        model=model_id,
        timeout=timeout,
        instance_id=instance_id,
        default_system_prompt=system_prompt,
    )
