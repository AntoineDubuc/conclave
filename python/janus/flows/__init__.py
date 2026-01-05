"""Flow registry and factory."""

from typing import Any

from ..core.types import FlowConfig
from ..providers.base import Provider
from . import basic, leading

# Registry of all available flow types
FLOWS = {
    "basic": basic,
    "leading": leading,
}


def get_flow_metadata(flow_type: str) -> dict[str, Any] | None:
    """Get metadata for a flow type."""
    flow_module = FLOWS.get(flow_type)
    return flow_module.metadata if flow_module else None


def get_all_flow_metadata() -> list[dict[str, Any]]:
    """Get all registered flow types and their metadata."""
    return [
        {"type": key, **module.metadata}
        for key, module in FLOWS.items()
    ]


def create_flow_engine(
    flow_type: str,
    providers: list[Provider],
    flow_config: FlowConfig,
    leader: str | None = None,
):
    """Create a flow engine instance for the given flow type."""
    if flow_type not in FLOWS:
        available = ", ".join(FLOWS.keys())
        raise ValueError(f"Unknown flow type: '{flow_type}'. Available types: {available}")

    if flow_type == "leading":
        leader_name = leader or flow_config.default_leader
        if not leader_name:
            raise ValueError("Leading flow requires a leader. Specify --leader or set default_leader in config.")
        return leading.Engine(providers, flow_config, leader_name)

    return basic.Engine(providers, flow_config)


def is_valid_flow_type(flow_type: str) -> bool:
    """Check if a flow type exists in the registry."""
    return flow_type in FLOWS
