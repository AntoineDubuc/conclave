"""Leading flow - hub-and-spoke pattern."""

from .engine import LeadingFlowEngine as Engine
from .prompts import default_prompts

metadata = {
    "type": "leading",
    "display_name": "Leading Ideator",
    "description": "Hub-and-spoke pattern. One model leads and synthesizes, others contribute ideas that the leader distills into a unified vision.",
    "pattern": "Hub-and-Spoke (Hierarchical)",
    "required_config": ["default_leader"],
}

__all__ = ["Engine", "default_prompts", "metadata"]
