"""Prompt utilities."""

from pathlib import Path

from rich.console import Console

console = Console()


def resolve_prompt(prompt_or_path: str) -> str:
    """
    Resolve a prompt that could be either a string or a file path.
    If it looks like a file path (.md or .txt) and exists, reads the file.
    Otherwise returns the string as-is.
    """
    # If it has newlines, it's definitely a prompt string, not a path
    if "\n" in prompt_or_path:
        return prompt_or_path

    # Check if it looks like a file path and exists
    if prompt_or_path.endswith((".md", ".txt")):
        path = Path(prompt_or_path)
        if path.exists():
            try:
                console.print(f"[dim]Loading prompt from file: {prompt_or_path}[/dim]")
                return path.read_text().strip()
            except Exception:
                console.print(
                    f"[yellow]Failed to read prompt file {prompt_or_path}, using as string.[/yellow]"
                )

    return prompt_or_path
