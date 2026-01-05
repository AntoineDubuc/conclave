"""Prompt utilities for the basic flow."""

from pathlib import Path


FLOW_DIR = Path(__file__).parent


def load_prompt(name: str) -> str:
    """Load a prompt from a markdown file in this flow's folder."""
    prompt_path = FLOW_DIR / f"{name}.md"
    if prompt_path.exists():
        return prompt_path.read_text().strip()
    raise FileNotFoundError(f"Prompt file not found: {prompt_path}")


class DefaultPrompts:
    """Default prompts loaded from markdown files."""

    @property
    def round_1(self) -> str:
        return load_prompt("round-1")

    @property
    def refinement(self) -> str:
        return load_prompt("refinement")


default_prompts = DefaultPrompts()


def get_refinement_system_prompt(round: int, max_rounds: int) -> str:
    """System prompt used during refinement rounds."""
    return f"You are participating in a refinement loop (Round {round} of {max_rounds}). Critically analyze peer feedback and improve your work."
