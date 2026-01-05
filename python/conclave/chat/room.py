"""ChatRoom - Main orchestrator for interactive multi-LLM chat."""

import asyncio
import re
from typing import TYPE_CHECKING

from rich.console import Console

from ..core.types import ChatConfig, ChatMessage, MessageRole
from ..providers.base import CompletionOptions, Provider
from .commands import CommandHandler
from .prompts import get_system_prompt, make_expand_prompt
from .session import ChatSession
from .ui import ChatDisplay


class ChatRoom:
    """Orchestrates interactive multi-LLM chat sessions."""

    def __init__(
        self,
        providers: list[Provider],
        config: ChatConfig | None = None,
        session: ChatSession | None = None,
        console: Console | None = None,
    ):
        self.providers = providers
        self.config = config or ChatConfig()
        self.session = session or ChatSession(
            active_models=[p.name for p in providers]
        )
        self.display = ChatDisplay(console)
        self.command_handler = CommandHandler(self)

    async def start(self) -> None:
        """Enter the main interactive loop."""
        self.display.show_welcome([p.name for p in self.providers])

        while True:
            try:
                # Get user input
                user_input = self.display.get_input().strip()

                if not user_input:
                    continue

                # Check for command
                command = self.command_handler.parse(user_input)
                if command:
                    result = await self.command_handler.execute(command)
                    if result.message:
                        self.display.show_command_result(result.message)
                    if result.should_exit:
                        break
                    continue

                # Regular message - send to models
                await self.send_message(user_input)

            except KeyboardInterrupt:
                self.display.console.print("\n[dim]Use /quit to exit[/dim]")
            except Exception as e:
                self.display.show_error(str(e))

    async def send_message(
        self,
        content: str,
        target_models: list[str] | None = None,
        expand: bool = False,
    ) -> None:
        """Send user message and collect model responses."""
        # Parse @mentions from content
        mentioned_models, clean_content = self._parse_mentions(content)

        # Determine which models should respond
        if target_models:
            responding = target_models
        elif mentioned_models:
            responding = mentioned_models
        else:
            responding = [p.name.lower() for p in self.providers]

        # Add user message to session (use original content with mentions)
        self.session.add_user_message(content)
        self.display.show_user_message(content)

        # Get responding providers
        responding_providers = [
            p for p in self.providers if p.name.lower() in responding
        ]

        if not responding_providers:
            self.display.show_error("No matching models found.")
            return

        # Show thinking indicator
        self.display.show_thinking([p.name for p in responding_providers])

        # Get responses
        if self.config.parallel_responses:
            tasks = [
                self._get_response(p, clean_content, expand)
                for p in responding_providers
            ]
            responses = await asyncio.gather(*tasks)
        else:
            responses = []
            for p in responding_providers:
                resp = await self._get_response(p, clean_content, expand)
                responses.append(resp)

        # Clear thinking indicator
        self.display.clear_thinking()

        # Display and store responses
        for response in responses:
            if response:
                self.session.add_message(response)
                self.display.show_model_response(response.model, response.content)

    async def _get_response(
        self,
        provider: Provider,
        content: str,
        expand: bool = False,
    ) -> ChatMessage | None:
        """Get a single model's response."""
        try:
            # Build context from conversation history
            context = self.session.format_context()

            # Build the prompt
            if context:
                prompt = f"{context}\n\nUser: {content}"
            else:
                prompt = content

            # Add expand directive if requested
            if expand:
                prompt = make_expand_prompt(prompt)

            # Get system prompt
            all_models = [p.name for p in self.providers]
            system_prompt = get_system_prompt(provider.name, all_models)

            # Call the provider
            options = CompletionOptions(
                system_prompt=system_prompt,
                max_tokens=self.config.expand_max_tokens if expand else self.config.max_response_tokens,
            )

            response_text = await provider.generate(prompt, options)

            # Check for error
            if response_text.startswith("[Error]"):
                self.display.show_error(f"{provider.name}: {response_text}")
                return None

            return ChatMessage(
                role=MessageRole.ASSISTANT,
                content=response_text,
                model=provider.name,
                is_expanded=expand,
            )

        except Exception as e:
            self.display.show_error(f"{provider.name}: {e}")
            return None

    def _parse_mentions(self, content: str) -> tuple[list[str], str]:
        """
        Extract @mentions from message content.

        Returns:
            (mentioned_models, cleaned_content)
        """
        pattern = r"@(\w+)"
        mentions = re.findall(pattern, content)

        # Validate mentions against available models
        valid_mentions = []
        provider_names = [p.name.lower() for p in self.providers]

        for mention in mentions:
            if mention.lower() in provider_names:
                valid_mentions.append(mention.lower())

        # Don't remove mentions from content - keep them for context
        return valid_mentions, content
