"""Configuration management for Conclave."""

from pathlib import Path

import yaml
from rich.console import Console

from .types import DEFAULT_CONFIG, ConclaveConfig, FlowConfig

console = Console()

CONFIG_FILENAME = "conclave.config.yaml"


class ConfigManager:
    """Manages Conclave configuration - local-first approach."""

    def __init__(self):
        self.config_path = Path.cwd() / CONFIG_FILENAME
        self.config = self._load_config()

    def _load_config(self) -> ConclaveConfig:
        """Load config from local file or use defaults."""
        if self.config_path.exists():
            console.print(f"[dim]Loaded config from: {self.config_path}[/dim]")
            return self._parse_config_file()
        return DEFAULT_CONFIG

    def _parse_config_file(self) -> ConclaveConfig:
        """Parse and validate config file."""
        try:
            with open(self.config_path) as f:
                raw = yaml.safe_load(f)

            # Merge with defaults to ensure new providers/flows appear
            config = ConclaveConfig.model_validate(raw)

            # Deep merge providers
            merged_providers = {**DEFAULT_CONFIG.providers, **config.providers}
            config.providers = merged_providers

            return config
        except Exception as e:
            console.print(f"[yellow]Warning: Config file invalid, using defaults. {e}[/yellow]")
            return DEFAULT_CONFIG

    def get_config(self) -> ConclaveConfig:
        """Get the current configuration."""
        return self.config

    def get_flow(self, name: str) -> FlowConfig | None:
        """Get a specific flow by name."""
        return self.config.flows.get(name)

    def save_config(self, config: ConclaveConfig | None = None) -> None:
        """Save configuration to file."""
        if config:
            self.config = config

        # Convert to dict for YAML serialization
        config_dict = self.config.model_dump(mode="json")

        with open(self.config_path, "w") as f:
            yaml.dump(config_dict, f, default_flow_style=False, sort_keys=False)

        console.print(f"[dim]Saved config to: {self.config_path}[/dim]")

    def ensure_config(self) -> None:
        """Ensure config file exists on disk."""
        if not self.config_path.exists():
            self.save_config(DEFAULT_CONFIG)

    def remove_flow(self, name: str) -> bool:
        """Remove a flow from config."""
        if name in self.config.flows:
            del self.config.flows[name]
            self.save_config()
            return True
        return False
