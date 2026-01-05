"""Grok (xAI) provider implementation using OpenAI-compatible API."""

import os

from openai import AsyncOpenAI

from ..core.types import ProviderConfig
from .base import CompletionOptions, Provider


# Latest Grok models as of 2025
GROK_MODELS = {
    "grok-4": "Latest flagship reasoning model",
    "grok-4-fast-reasoning": "Fast reasoning variant",
    "grok-3": "Previous generation flagship",
    "grok-3-mini": "Smaller, faster model",
}

DEFAULT_MODEL = "grok-4"


class GrokProvider(Provider):
    """Provider for xAI's Grok API (OpenAI-compatible)."""

    def __init__(self, config: ProviderConfig):
        super().__init__("Grok")
        self.model = config.model or DEFAULT_MODEL

        # Grok uses XAI_API_KEY env var
        api_key = config.api_key or os.environ.get("XAI_API_KEY")
        base_url = config.base_url or "https://api.x.ai/v1"

        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
        )

    async def generate(self, prompt: str, options: CompletionOptions | None = None) -> str:
        """Generate a completion using Grok's API."""
        options = options or CompletionOptions()

        try:
            messages = []
            if options.system_prompt:
                messages.append({"role": "system", "content": options.system_prompt})
            messages.append({"role": "user", "content": prompt})

            # Grok-4 is a reasoning model, similar parameters to GPT-5
            kwargs = {
                "model": self.model,
                "messages": messages,
                "max_completion_tokens": options.max_tokens,
            }

            # Reasoning models may not support temperature
            if options.temperature is not None and not self.model.startswith("grok-4"):
                kwargs["temperature"] = options.temperature

            response = await self.client.chat.completions.create(**kwargs)
            return response.choices[0].message.content or ""

        except Exception as e:
            return f"[Error] Grok failed to generate response: {e}"
