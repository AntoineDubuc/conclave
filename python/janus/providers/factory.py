"""Provider factory for creating provider instances."""

import os
import shutil

from rich.console import Console

from ..core.types import AuthMethod, JanusConfig, ProviderConfig, ProviderType
from .anthropic import AnthropicProvider
from .base import Provider
from .claude_cli import ClaudeCliProvider
from .gemini import GeminiProvider
from .grok import GrokProvider
from .openai import OpenAIProvider

console = Console()


def _resolve_anthropic_auth_method(config: ProviderConfig) -> AuthMethod:
    """Determine which auth method to use for Anthropic."""
    # If explicitly set (not auto), use that
    if config.auth_method != AuthMethod.AUTO:
        return config.auth_method

    # Auto-detect: check for API key first
    api_key = config.api_key or os.environ.get("ANTHROPIC_API_KEY", "")

    # Check if it's a real key (not a placeholder)
    if api_key and not api_key.startswith("sk-ant-..."):
        return AuthMethod.API_KEY

    # Fall back to CLI if available
    if shutil.which("claude"):
        return AuthMethod.CLI

    # Default to API key (will fail if not configured)
    return AuthMethod.API_KEY


def create_providers(config: JanusConfig) -> list[Provider]:
    """Create provider instances based on configuration."""
    providers: list[Provider] = []

    for provider_name in config.active_providers:
        provider_config = config.providers.get(provider_name)
        if not provider_config:
            console.print(f"[yellow]Warning: Provider '{provider_name}' not configured[/yellow]")
            continue

        try:
            provider = _create_provider(provider_name, provider_config)
            if provider:
                providers.append(provider)
        except Exception as e:
            console.print(f"[red]Error creating provider '{provider_name}': {e}[/red]")

    return providers


def _create_provider(name: str, config: ProviderConfig) -> Provider | None:
    """Create a single provider instance."""
    match config.type:
        case ProviderType.ANTHROPIC:
            auth_method = _resolve_anthropic_auth_method(config)
            if auth_method == AuthMethod.CLI:
                console.print("[dim]Using Claude CLI (subscription mode)[/dim]")
                return ClaudeCliProvider(config)
            return AnthropicProvider(config)

        case ProviderType.OPENAI:
            return OpenAIProvider(config)

        case ProviderType.GEMINI:
            return GeminiProvider(config)

        case ProviderType.GROK:
            return GrokProvider(config)

        case ProviderType.OPENAI_COMPATIBLE:
            return OpenAIProvider(config, name=name.title())

        case _:
            console.print(f"[yellow]Unknown provider type: {config.type}[/yellow]")
            return None
