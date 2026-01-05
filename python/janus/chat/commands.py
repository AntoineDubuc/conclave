"""Command parser and handlers for chat."""

import re
from dataclasses import dataclass
from enum import Enum, auto
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .room import ChatRoom


class CommandType(Enum):
    """Types of chat commands."""

    HELP = auto()
    QUIT = auto()
    CLEAR = auto()
    MODELS = auto()
    EXPAND = auto()
    SAVE = auto()
    LOAD = auto()
    ASK = auto()


@dataclass
class Command:
    """Parsed command."""

    type: CommandType
    args: list[str]
    raw: str


@dataclass
class CommandResult:
    """Result of command execution."""

    success: bool
    message: str = ""
    should_exit: bool = False


class CommandHandler:
    """Parse and execute chat commands."""

    PATTERNS = {
        r"^/help\s*$": CommandType.HELP,
        r"^/(quit|exit)\s*$": CommandType.QUIT,
        r"^/clear\s*$": CommandType.CLEAR,
        r"^/models?\s*$": CommandType.MODELS,
        r"^/expand\s*$": CommandType.EXPAND,
        r"^/save(?:\s+(.+))?$": CommandType.SAVE,
        r"^/load\s+(.+)$": CommandType.LOAD,
        r"^/ask\s+(\w+)\s+(.+)$": CommandType.ASK,
    }

    def __init__(self, room: "ChatRoom"):
        self.room = room

    def parse(self, text: str) -> Command | None:
        """Parse input into a Command if it starts with /."""
        if not text.startswith("/"):
            return None

        for pattern, cmd_type in self.PATTERNS.items():
            match = re.match(pattern, text, re.IGNORECASE)
            if match:
                args = [g for g in match.groups() if g is not None]
                return Command(type=cmd_type, args=args, raw=text)

        # Unknown command - show help
        return Command(type=CommandType.HELP, args=[], raw=text)

    async def execute(self, command: Command) -> CommandResult:
        """Execute a parsed command."""
        handlers = {
            CommandType.HELP: self._handle_help,
            CommandType.QUIT: self._handle_quit,
            CommandType.CLEAR: self._handle_clear,
            CommandType.MODELS: self._handle_models,
            CommandType.EXPAND: self._handle_expand,
            CommandType.SAVE: self._handle_save,
            CommandType.LOAD: self._handle_load,
            CommandType.ASK: self._handle_ask,
        }

        handler = handlers.get(command.type, self._handle_help)
        return await handler(command)

    async def _handle_help(self, cmd: Command) -> CommandResult:
        """Show help."""
        self.room.display.show_help()
        return CommandResult(success=True)

    async def _handle_quit(self, cmd: Command) -> CommandResult:
        """Exit chat."""
        return CommandResult(success=True, message="Goodbye!", should_exit=True)

    async def _handle_clear(self, cmd: Command) -> CommandResult:
        """Clear conversation history."""
        self.room.session.clear()
        return CommandResult(success=True, message="Conversation cleared.")

    async def _handle_models(self, cmd: Command) -> CommandResult:
        """Show active models."""
        models = [p.name for p in self.room.providers]
        return CommandResult(success=True, message=f"Active models: {', '.join(models)}")

    async def _handle_expand(self, cmd: Command) -> CommandResult:
        """Expand last response."""
        last_msg = self.room.session.get_last_user_message()
        if not last_msg:
            return CommandResult(success=False, message="No message to expand.")

        # Re-send with expand flag
        await self.room.send_message(last_msg.content, expand=True)
        return CommandResult(success=True)

    async def _handle_save(self, cmd: Command) -> CommandResult:
        """Save session."""
        filename = cmd.args[0] if cmd.args else None
        try:
            from .persistence import save_session

            path = save_session(self.room.session, filename)
            return CommandResult(success=True, message=f"Session saved to {path}")
        except Exception as e:
            return CommandResult(success=False, message=f"Failed to save: {e}")

    async def _handle_load(self, cmd: Command) -> CommandResult:
        """Load session."""
        if not cmd.args:
            return CommandResult(success=False, message="Usage: /load <filename>")

        try:
            from .persistence import load_session

            self.room.session = load_session(cmd.args[0])
            return CommandResult(
                success=True,
                message=f"Loaded session with {len(self.room.session.messages)} messages.",
            )
        except FileNotFoundError:
            return CommandResult(success=False, message=f"Session not found: {cmd.args[0]}")
        except Exception as e:
            return CommandResult(success=False, message=f"Failed to load: {e}")

    async def _handle_ask(self, cmd: Command) -> CommandResult:
        """Send message to specific model."""
        if len(cmd.args) < 2:
            return CommandResult(success=False, message="Usage: /ask <model> <message>")

        model_name = cmd.args[0].lower()
        message = cmd.args[1]

        # Verify model exists
        available = [p.name.lower() for p in self.room.providers]
        if model_name not in available:
            return CommandResult(
                success=False,
                message=f"Model '{model_name}' not found. Available: {', '.join(available)}",
            )

        await self.room.send_message(message, target_models=[model_name])
        return CommandResult(success=True)
