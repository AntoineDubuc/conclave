"""Base provider interface."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class CompletionOptions:
    """Options for completion requests."""

    system_prompt: str | None = None
    max_tokens: int = 8192
    temperature: float | None = None


class Provider(ABC):
    """Abstract base class for LLM providers."""

    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    async def generate(self, prompt: str, options: CompletionOptions | None = None) -> str:
        """Generate a completion for the given prompt."""
        pass
