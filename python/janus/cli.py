"""Janus CLI entry point."""

import asyncio
import os
import shutil
import subprocess
from pathlib import Path

import click
from dotenv import load_dotenv
from rich.console import Console
from rich.prompt import Prompt, Confirm
from rich.table import Table

from .core.config import ConfigManager
from .core.types import FlowConfig, FlowPrompts, FlowType
from .flows import create_flow_engine, get_flow_metadata
from .providers.factory import create_providers

# Load .env file
load_dotenv()

console = Console()

# Known models for each provider (2025)
KNOWN_MODELS = {
    "anthropic": [
        "claude-opus-4-5-20251101",
        "claude-sonnet-4-5-20250929",
        "claude-haiku-4-5-20251001",
    ],
    "openai": [
        "gpt-5.2",
        "gpt-5.2-pro",
        "gpt-4.1",
        "gpt-5-mini",
    ],
    "gemini": [
        "gemini-2.0-flash",
        "gemini-2.0-pro",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
    ],
    "grok": [
        "grok-4",
        "grok-4-fast-reasoning",
        "grok-3",
        "grok-3-mini",
    ],
}


@click.group()
@click.version_option(version="0.1.0")
def main():
    """Janus - Multi-LLM collaboration to harvest unique insights."""
    pass


@main.command()
@click.argument("flow_name")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("-p", "--prompt", "prompt_override", help="Override the initial prompt")
@click.option("-l", "--leader", help="Specify the leader provider (for leading flows)")
def run(flow_name: str, file_path: str, prompt_override: str | None, leader: str | None):
    """Run a specific flow on a markdown file."""
    config_manager = ConfigManager()
    config = config_manager.get_config()
    flow = config_manager.get_flow(flow_name)

    if not flow:
        console.print(f"[red]Error: Flow '{flow_name}' not found.[/red]")
        console.print(f"Available flows: {', '.join(config.flows.keys())}")
        raise SystemExit(1)

    providers = create_providers(config)
    flow_type = flow.flow_type.value if isinstance(flow.flow_type, FlowType) else flow.flow_type

    # Show flow explanation from metadata
    metadata = get_flow_metadata(flow_type)
    if metadata:
        console.print(f"\n[cyan bold]--- {metadata['display_name']} ---[/cyan bold]")
        console.print(f"[dim]Pattern: {metadata['pattern']}[/dim]")
        console.print(f"[dim]{metadata['description']}[/dim]")
        console.print()

    # Handle leader selection for leading flows
    leader_name = leader or (flow.default_leader if hasattr(flow, "default_leader") else None)
    if flow_type == "leading" and not leader_name:
        provider_names = [p.name for p in providers]
        console.print("Select the leader provider:")
        for i, name in enumerate(provider_names, 1):
            console.print(f"  {i}. {name}")
        choice = Prompt.ask("Enter number", default="1")
        leader_name = provider_names[int(choice) - 1]

    # Create and run the appropriate engine
    engine = create_flow_engine(flow_type, providers, flow, leader=leader_name)
    asyncio.run(engine.run(file_path, prompt_override))


@main.command("list")
def list_flows():
    """List available flows."""
    config_manager = ConfigManager()
    config = config_manager.get_config()

    console.print("\n[bold]Available Flows:[/bold]\n")
    for key, flow in config.flows.items():
        flow_type = flow.flow_type.value if isinstance(flow.flow_type, FlowType) else flow.flow_type
        type_label = "[yellow][Leading][/yellow]" if flow_type == "leading" else "[blue][Basic][/blue]"

        leader_info = ""
        if flow_type == "leading" and flow.default_leader:
            leader_info = f" [dim](default leader: {flow.default_leader})[/dim]"

        console.print(f"  [cyan bold]{key}[/cyan bold] {type_label}{leader_info}")
        console.print(f"    {flow.description or 'No description'}")
        console.print(f"    Rounds: {flow.max_rounds}\n")


@main.command()
@click.argument("name")
def delete_flow(name: str):
    """Delete an existing flow."""
    config_manager = ConfigManager()
    success = config_manager.remove_flow(name)
    if success:
        console.print(f"[green]Flow '{name}' deleted successfully.[/green]")
    else:
        console.print(f"[red]Flow '{name}' not found.[/red]")


@main.command()
def doctor():
    """Check connection health and authentication status."""
    config_manager = ConfigManager()
    config = config_manager.get_config()
    providers = create_providers(config)

    console.print("\n[bold]Provider Health Check:[/bold]\n")

    async def check_provider(provider):
        try:
            response = await provider.generate("Say 'OK' if you can hear me.", None)
            if response.startswith("[Error]"):
                return False, response
            return True, "Connected"
        except Exception as e:
            return False, str(e)

    async def check_all():
        for provider in providers:
            console.print(f"  Checking {provider.name}...", end=" ")
            success, message = await check_provider(provider)
            if success:
                console.print("[green]OK[/green]")
            else:
                console.print(f"[red]FAILED[/red] - {message}")

    asyncio.run(check_all())
    console.print()


@main.command()
def models():
    """List and configure active AI models."""
    config_manager = ConfigManager()
    config = config_manager.get_config()

    console.print("\n[bold]AI Model Configuration[/bold]\n")

    # Show current models
    table = Table(title="Current Models")
    table.add_column("Provider", style="cyan")
    table.add_column("Model", style="green")
    table.add_column("Status", style="dim")

    for name, provider_config in config.providers.items():
        status = "active" if name in config.active_providers else "inactive"
        table.add_row(name, provider_config.model or "default", status)

    console.print(table)
    console.print()

    # Ask which provider to configure
    provider_names = list(config.providers.keys())
    console.print("Select a provider to configure (or 'q' to quit):")
    for i, name in enumerate(provider_names, 1):
        console.print(f"  {i}. {name}")

    choice = Prompt.ask("Enter number", default="q")
    if choice == "q":
        return

    try:
        provider_name = provider_names[int(choice) - 1]
    except (ValueError, IndexError):
        console.print("[red]Invalid choice[/red]")
        return

    current_model = config.providers[provider_name].model
    console.print(f"\nCurrent model for [cyan]{provider_name}[/cyan]: [green]{current_model}[/green]")

    # Show available models
    known = KNOWN_MODELS.get(provider_name, [])
    console.print("\nAvailable models:")
    for i, model in enumerate(known, 1):
        marker = " (current)" if model == current_model else ""
        console.print(f"  {i}. {model}{marker}")
    console.print(f"  {len(known) + 1}. Enter custom model ID")

    model_choice = Prompt.ask("Select model", default="1")

    try:
        idx = int(model_choice) - 1
        if idx < len(known):
            new_model = known[idx]
        else:
            new_model = Prompt.ask("Enter custom model ID")
    except ValueError:
        new_model = model_choice

    # Save the new model
    config.providers[provider_name].model = new_model
    config_manager.save_config(config)
    console.print(f"\n[green]Updated {provider_name} to use model: {new_model}[/green]")


@main.command("new-flow")
def new_flow():
    """Wizard to create a new flow."""
    config_manager = ConfigManager()
    config = config_manager.get_config()

    console.print("\n[bold]--- Janus Flow Wizard ---[/bold]\n")

    # Get flow details
    name = Prompt.ask("Flow name (e.g., 'code-audit')")
    if not name:
        console.print("[red]Name cannot be empty[/red]")
        return

    description = Prompt.ask("Description", default="")

    # Select flow type
    console.print("\nFlow type:")
    console.print("  1. basic - Round-robin democratic")
    console.print("  2. leading - Hub-and-spoke with leader")
    flow_type_choice = Prompt.ask("Select type", default="1")
    flow_type = FlowType.LEADING if flow_type_choice == "2" else FlowType.BASIC

    # Leader for leading flows
    default_leader = None
    if flow_type == FlowType.LEADING:
        provider_names = list(config.providers.keys())
        console.print("\nSelect default leader:")
        for i, pname in enumerate(provider_names, 1):
            console.print(f"  {i}. {pname}")
        leader_choice = Prompt.ask("Enter number", default="1")
        try:
            default_leader = provider_names[int(leader_choice) - 1]
        except (ValueError, IndexError):
            default_leader = provider_names[0]

    # Max rounds
    max_rounds = int(Prompt.ask("Max rounds", default="2"))

    # Prompts
    console.print("\nEnter prompts (press Enter for defaults):")
    round_1 = Prompt.ask(
        "Round 1 prompt",
        default="Analyze this and provide a comprehensive plan.",
    )
    refinement = Prompt.ask(
        "Refinement prompt",
        default="Review peer feedback and improve your response.",
    )

    leader_synthesis = None
    if flow_type == FlowType.LEADING:
        leader_synthesis = Prompt.ask(
            "Leader synthesis prompt",
            default="Synthesize all contributions into a unified plan.",
        )

    # Create flow config
    new_flow_config = FlowConfig(
        name=name,
        description=description or None,
        flow_type=flow_type,
        max_rounds=max_rounds,
        default_leader=default_leader,
        prompts=FlowPrompts(
            round_1=round_1,
            refinement=refinement,
            leader_synthesis=leader_synthesis,
        ),
    )

    # Save
    config.flows[name] = new_flow_config
    config_manager.save_config(config)
    console.print(f"\n[green]Flow '{name}' saved successfully![/green]")


@main.command("auth-claude")
def auth_claude():
    """Manage Claude Code authentication."""
    console.print("\n[bold]Claude Code Authentication Manager[/bold]\n")

    # Check for API key conflict
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    is_placeholder = not api_key or api_key.startswith("sk-ant-...")

    if api_key and not is_placeholder:
        console.print("[yellow]Warning: ANTHROPIC_API_KEY is present in environment.[/yellow]")
        console.print("Janus prioritizes this over Claude Code CLI.\n")

    # Check Claude CLI status
    console.print("Checking Claude Code status...")
    claude_path = shutil.which("claude")

    if not claude_path:
        console.print("[red]Claude CLI not found.[/red]")
        console.print("Install with: npm i -g @anthropic-ai/claude-code")
        return

    # Try to run a quick test
    try:
        result = subprocess.run(
            [claude_path, "-p", "hi", "--dangerously-skip-permissions"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0:
            console.print("[green]Claude CLI is accessible and responding.[/green]")
            is_authenticated = True
        else:
            console.print("[red]Claude CLI returned an error. May not be authenticated.[/red]")
            is_authenticated = False
    except subprocess.TimeoutExpired:
        console.print("[red]Claude CLI timed out.[/red]")
        is_authenticated = False
    except Exception as e:
        console.print(f"[red]Error checking Claude CLI: {e}[/red]")
        is_authenticated = False

    console.print()

    if not is_authenticated:
        console.print("[cyan]To login to Claude Code:[/cyan]")
        console.print("1. Open a new terminal window")
        console.print("2. Run: [bold]claude[/bold]")
        console.print("3. Follow the authentication flow")
        console.print("4. Run [bold]janus auth-claude[/bold] again")


@main.command()
def init():
    """Run the setup wizard to configure providers."""
    config_manager = ConfigManager()
    config_manager.ensure_config()
    console.print("[green]Configuration initialized.[/green]")
    console.print(f"Edit {config_manager.config_path} to configure providers and flows.")


@main.command()
@click.option("-m", "--model", "models", multiple=True, help="Models to include (default: all active)")
@click.option("-s", "--session", "session_file", help="Load existing session file")
def chat(models: tuple[str], session_file: str | None):
    """Start an interactive multi-LLM chat room."""
    from .chat import ChatRoom, ChatSession
    from .chat.persistence import load_session
    from .core.types import ChatConfig

    config_manager = ConfigManager()
    config = config_manager.get_config()

    # Filter providers based on --model flag
    if models:
        active = [m.lower() for m in models]
        config.active_providers = [p for p in config.active_providers if p.lower() in active]

    providers = create_providers(config)

    if not providers:
        console.print("[red]No providers available. Run `janus doctor` to check.[/red]")
        raise SystemExit(1)

    # Load existing session if specified
    session = None
    if session_file:
        try:
            session = load_session(session_file)
            console.print(f"[dim]Resumed session from {session_file}[/dim]")
        except FileNotFoundError:
            console.print(f"[red]Session file not found: {session_file}[/red]")
            raise SystemExit(1)

    # Create chat config and room
    chat_config = ChatConfig()
    room = ChatRoom(providers, chat_config, session, console)

    # Run the chat
    asyncio.run(room.start())


if __name__ == "__main__":
    main()
