"""Prompt utilities for the leading flow."""

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

    @property
    def leader_synthesis(self) -> str:
        return load_prompt("leader-synthesis")


default_prompts = DefaultPrompts()


def get_leader_system_prompt(round: int, max_rounds: int) -> str:
    """System prompt for the leader during synthesis rounds."""
    return f"You are the lead architect (Round {round} of {max_rounds}). Your role is to synthesize the best ideas from your team into a cohesive plan."


def get_contributor_system_prompt(round: int, max_rounds: int) -> str:
    """System prompt for contributors responding to leader's synthesis."""
    return f"You are a contributing architect (Round {round} of {max_rounds}). Review the leader's synthesis and provide your refined perspective."
