"""OpenAI provider implementation."""

import os

from openai import AsyncOpenAI

from ..core.types import ProviderConfig
from .base import CompletionOptions, Provider


class OpenAIProvider(Provider):
    """Provider for OpenAI's API."""

    def __init__(self, config: ProviderConfig, name: str = "OpenAI"):
        super().__init__(name)
        self.model = config.model or "gpt-5.2"
        self.client = AsyncOpenAI(
            api_key=config.api_key or os.environ.get("OPENAI_API_KEY"),
            base_url=config.base_url,
        )

    async def generate(self, prompt: str, options: CompletionOptions | None = None) -> str:
        """Generate a completion using OpenAI's API."""
        options = options or CompletionOptions()

        try:
            messages = []
            if options.system_prompt:
                messages.append({"role": "system", "content": options.system_prompt})
            messages.append({"role": "user", "content": prompt})

            # GPT-5.x and o1/o3 models use different parameters
            is_new_model = any(
                self.model.startswith(prefix) for prefix in ("gpt-5", "o1", "o3")
            )

            kwargs = {
                "model": self.model,
                "messages": messages,
            }

            if is_new_model:
                kwargs["max_completion_tokens"] = options.max_tokens
                # New models don't support temperature
            else:
                kwargs["max_tokens"] = options.max_tokens
                if options.temperature is not None:
                    kwargs["temperature"] = options.temperature

            response = await self.client.chat.completions.create(**kwargs)
            return response.choices[0].message.content or ""

        except Exception as e:
            return f"[Error] {self.name} failed to generate response: {e}"
