"""Google Gemini provider implementation."""

import os

from google import genai
from google.genai.types import GenerateContentConfig

from ..core.types import ProviderConfig
from .base import CompletionOptions, Provider


class GeminiProvider(Provider):
    """Provider for Google's Gemini API."""

    def __init__(self, config: ProviderConfig):
        super().__init__("Gemini")
        self.model_name = config.model or "gemini-2.0-flash"

        # Configure the API key
        api_key = config.api_key or os.environ.get("GEMINI_API_KEY")
        self.client = genai.Client(api_key=api_key)

    async def generate(self, prompt: str, options: CompletionOptions | None = None) -> str:
        """Generate a completion using Gemini's API."""
        options = options or CompletionOptions()

        try:
            # Build configuration
            config_kwargs = {}
            if options.max_tokens:
                config_kwargs["max_output_tokens"] = options.max_tokens
            if options.temperature is not None:
                config_kwargs["temperature"] = options.temperature

            config = GenerateContentConfig(**config_kwargs) if config_kwargs else None

            # Build contents with optional system prompt
            contents = prompt
            if options.system_prompt:
                contents = f"{options.system_prompt}\n\n{prompt}"

            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=config,
            )

            return response.text

        except Exception as e:
            return f"[Error] Gemini failed to generate response: {e}"
