"""Rich-based terminal UI for chat display."""

from rich.console import Console
from rich.live import Live
from rich.markdown import Markdown
from rich.panel import Panel
from rich.spinner import Spinner
from rich.table import Table

# Model color mapping
MODEL_COLORS = {
    "anthropic": "magenta",
    "openai": "green",
    "gemini": "blue",
    "grok": "red",
}


class ChatDisplay:
    """Handles all terminal rendering for chat."""

    def __init__(self, console: Console | None = None):
        self.console = console or Console()

    def show_welcome(self, models: list[str]) -> None:
        """Display welcome message and available models."""
        self.console.print()
        self.console.print("[bold cyan]━━━ Janus Chat Room ━━━[/bold cyan]")
        self.console.print(f"[dim]Models: {', '.join(models)}[/dim]")
        self.console.print("[dim]Type /help for commands, /quit to exit[/dim]")
        self.console.print()

    def show_user_message(self, content: str) -> None:
        """Display user's message."""
        self.console.print(
            Panel(
                content,
                title="[cyan bold]You[/cyan bold]",
                border_style="cyan",
                padding=(0, 1),
            )
        )

    def show_model_response(self, model: str, content: str) -> None:
        """Display a model's response."""
        color = MODEL_COLORS.get(model.lower(), "white")

        # Render as markdown
        rendered = Markdown(content)

        self.console.print(
            Panel(
                rendered,
                title=f"[{color} bold]{model}[/{color} bold]",
                border_style=color,
                padding=(0, 1),
            )
        )

    def show_thinking(self, models: list[str]) -> None:
        """Show thinking indicator for models."""
        names = ", ".join(models)
        self.console.print(f"[dim]  {names} thinking...[/dim]", end="\r")

    def clear_thinking(self) -> None:
        """Clear the thinking indicator."""
        self.console.print(" " * 60, end="\r")

    def show_command_result(self, message: str) -> None:
        """Display command execution result."""
        self.console.print(f"[yellow]{message}[/yellow]")

    def show_error(self, error: str) -> None:
        """Display error message."""
        self.console.print(f"[red bold]Error:[/red bold] {error}")

    def show_help(self) -> None:
        """Display help message."""
        help_text = """
[bold]Commands:[/bold]
  [cyan]/help[/cyan]              Show this help
  [cyan]/quit[/cyan] or [cyan]/exit[/cyan]   Exit chat
  [cyan]/clear[/cyan]             Clear conversation history
  [cyan]/models[/cyan]            Show active models
  [cyan]/expand[/cyan]            Get detailed response to last message
  [cyan]/save[/cyan] [file]       Save session to file
  [cyan]/load[/cyan] <file>       Load previous session

[bold]Tips:[/bold]
  - @anthropic, @openai etc. addresses specific models
  - Responses are kept brief (2-4 sentences) by default
  - Use /expand for detailed explanations
"""
        self.console.print(help_text)

    def get_input(self) -> str:
        """Get input from user with styled prompt."""
        try:
            return self.console.input("[cyan bold]You:[/cyan bold] ")
        except EOFError:
            return "/quit"
        except KeyboardInterrupt:
            self.console.print()
            return "/quit"
