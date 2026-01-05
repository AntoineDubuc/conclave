"""Claude CLI provider for subscription users."""

import asyncio
import shutil

from ..core.types import ProviderConfig
from .base import CompletionOptions, Provider


class ClaudeCliProvider(Provider):
    """Provider that uses the Claude CLI binary (for subscription auth)."""

    def __init__(self, config: ProviderConfig):
        super().__init__("Anthropic (CLI)")
        self.model = config.model or "claude-opus-4-5-20251101"

    async def generate(self, prompt: str, options: CompletionOptions | None = None) -> str:
        """Generate a completion using the Claude CLI."""
        options = options or CompletionOptions()

        # Check if claude is available
        claude_path = shutil.which("claude")
        if not claude_path:
            return "[Error] Claude CLI not found. Install it or use API key auth."

        try:
            # Build command
            cmd = [
                claude_path,
                "-p", prompt,
                "--dangerously-skip-permissions",
            ]

            if options.system_prompt:
                cmd.extend(["--system", options.system_prompt])

            # Run the process
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown error"
                return f"[Error] Claude CLI failed: {error_msg}"

            return stdout.decode()

        except Exception as e:
            return f"[Error] Claude CLI failed: {e}"
