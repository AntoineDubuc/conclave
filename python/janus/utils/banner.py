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

    # Print with left-to-right gradient effect
    from rich.text import Text
    for line in lines:
        if line.strip():
            text = Text()
            line_len = len(line.rstrip())
            for j, char in enumerate(line.rstrip()):
                # Calculate color index based on horizontal position
                color_idx = int(j / max(line_len - 1, 1) * (len(GRADIENT_COLORS) - 1))
                color = GRADIENT_COLORS[color_idx]
                text.append(char, style=f"bold {color}")
            console.print(text)

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
