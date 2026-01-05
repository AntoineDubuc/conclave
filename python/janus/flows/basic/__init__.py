"""Basic flow - round-robin democratic pattern."""

from .engine import BasicFlowEngine as Engine
from .prompts import default_prompts

metadata = {
    "type": "basic",
    "display_name": "Basic Ideator",
    "description": "Round-robin democratic collaboration. All models brainstorm independently, then everyone sees everyone's work and refines together.",
    "pattern": "Round-Robin (Democratic)",
    "required_config": [],
}

__all__ = ["Engine", "default_prompts", "metadata"]
