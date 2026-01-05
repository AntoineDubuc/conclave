"""ASCII banner utilities for Janus CLI."""

import pyfiglet
from rich.console import Console


# Gradient colors from yellow to orange
GRADIENT_COLORS = [
    "bright_yellow",
    "yellow",
    "orange1",
    "dark_orange",
    "orange_red1",
]


def print_banner(console: Console | None = None, subtitle: str | None = None) -> None:
    """Print the Janus ASCII art banner with gradient colors.

    Args:
        console: Rich console to print to. Creates new one if not provided.
        subtitle: Optional subtitle to display under the banner.
    """
    if console is None:
        console = Console()

    # Generate ASCII art (banner3 = the # style)
    ascii_art = pyfiglet.figlet_format("JANUS", font="banner3")
    lines = ascii_art.split("\n")

    # Print with gradient effect
    for i, line in enumerate(lines):
        if line.strip():
            color = GRADIENT_COLORS[i % len(GRADIENT_COLORS)]
            console.print(line, style=f"bold {color}")

    # Print subtitle
    if subtitle:
        console.print(f"[dim]{subtitle}[/dim]")
    else:
        console.print("[dim]Multi-LLM collaboration CLI[/dim]")


def get_banner_text() -> str:
    """Get the raw ASCII banner text without colors.

    Returns:
        The ASCII art banner as a string.
    """
    return pyfiglet.figlet_format("JANUS", font="banner3")
