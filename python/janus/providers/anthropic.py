"""Anthropic provider implementation."""

import os

from anthropic import AsyncAnthropic

from ..core.types import ProviderConfig
from .base import CompletionOptions, Provider


class AnthropicProvider(Provider):
    """Provider for Anthropic's Claude API."""

    def __init__(self, config: ProviderConfig):
        super().__init__("Anthropic")
        self.model = config.model or "claude-opus-4-5-20251101"
        self.client = AsyncAnthropic(
            api_key=config.api_key or os.environ.get("ANTHROPIC_API_KEY")
        )

    async def generate(self, prompt: str, options: CompletionOptions | None = None) -> str:
        """Generate a completion using Anthropic's API."""
        options = options or CompletionOptions()

        try:
            kwargs = {
                "model": self.model,
                "max_tokens": options.max_tokens,
                "messages": [{"role": "user", "content": prompt}],
            }

            if options.system_prompt:
                kwargs["system"] = options.system_prompt

            if options.temperature is not None:
                kwargs["temperature"] = options.temperature

            response = await self.client.messages.create(**kwargs)

            # Extract text from response
            return "".join(
                block.text for block in response.content if hasattr(block, "text")
            )
        except Exception as e:
            return f"[Error] Anthropic failed to generate response: {e}"
