"""Basic flow engine - round-robin democratic pattern."""

import asyncio
from pathlib import Path
from dataclasses import dataclass, field

from rich.console import Console
from rich.status import Status

from ...core.types import FlowConfig
from ...providers.base import CompletionOptions, Provider
from ...utils.output import create_run_context, read_input_file, save_output
from ...utils.prompts import resolve_prompt
from .prompts import get_refinement_system_prompt

console = Console()


@dataclass
class RunState:
    """State for a single round."""

    round: int
    outputs: dict[str, str] = field(default_factory=dict)


class BasicFlowEngine:
    """
    BasicFlowEngine implements the round-robin democratic pattern:

    Round 1 (Divergence): Everyone brainstorms independently
    Round 2+ (Convergence): Everyone sees ALL peer outputs and refines

    This is a democratic flow - all providers are equal participants.
    """

    def __init__(self, providers: list[Provider], flow: FlowConfig):
        self.providers = providers
        self.flow = flow
        ctx = create_run_context()
        self.run_id = ctx.run_id
        self.run_dir = ctx.run_dir

    async def run(self, input_file: str, initial_prompt_override: str | None = None) -> None:
        """Run the basic flow."""
        console.print(f"\n[green]Starting Flow: {self.flow.name} (Run ID: {self.run_id})[/green]")
        console.print(f"[dim]Output Directory: {self.run_dir}[/dim]\n")

        history: list[RunState] = []
        input_content = read_input_file(input_file)

        # Filter providers if flow defines specific ones
        active_providers = self.providers
        if self.flow.active_providers:
            active_providers = [
                p for p in self.providers
                if p.name.lower() in [ap.lower() for ap in self.flow.active_providers]
            ]

        if not active_providers:
            console.print("[red]No active providers found for this flow configuration.[/red]")
            return

        # --- Round 1: Divergence ---
        with Status("Round 1: Divergence (Brainstorming)", console=console) as status:
            round1_outputs: dict[str, str] = {}

            round1_prompt = initial_prompt_override or resolve_prompt(self.flow.prompts.round_1)
            full_round1_prompt = f"{round1_prompt}\n\n[INPUT FILE START]\n{input_content}\n[INPUT FILE END]"

            # Run all providers in parallel
            tasks = [
                self._generate_and_save(provider, full_round1_prompt, 1)
                for provider in active_providers
            ]
            results = await asyncio.gather(*tasks)

            for provider, output in zip(active_providers, results):
                round1_outputs[provider.name] = output

            history.append(RunState(round=1, outputs=round1_outputs))
            status.stop()
            console.print("[green]✓[/green] Round 1 Complete")

        # --- Convergence Rounds (2..N) ---
        for round_num in range(2, self.flow.max_rounds + 1):
            with Status(f"Round {round_num}: Convergence (Refinement)", console=console) as status:
                prev_outputs = history[-1].outputs
                round_outputs: dict[str, str] = {}

                tasks = []
                for provider in active_providers:
                    previous_output = prev_outputs.get(provider.name, "")

                    # Get other providers' outputs
                    other_outputs = "\n\n".join(
                        f"[PEER REVIEW FROM {p.name.upper()}]\n{prev_outputs.get(p.name, 'No output')}"
                        for p in active_providers
                        if p.name != provider.name
                    )

                    refinement_prompt = resolve_prompt(self.flow.prompts.refinement)
                    full_prompt = f"""{refinement_prompt}

[YOUR PREVIOUS VERSION (v{round_num - 1})]
{previous_output}

[PEER REVIEWS]
{other_outputs}

[TASK]
Based on the critiques and ideas from your peers, output the v{round_num} version of the plan."""

                    options = CompletionOptions(
                        system_prompt=get_refinement_system_prompt(round_num, self.flow.max_rounds)
                    )
                    tasks.append(
                        self._generate_and_save(provider, full_prompt, round_num, options)
                    )

                results = await asyncio.gather(*tasks)
                for provider, output in zip(active_providers, results):
                    round_outputs[provider.name] = output

                history.append(RunState(round=round_num, outputs=round_outputs))
                status.stop()
                console.print(f"[green]✓[/green] Round {round_num} Complete")

        console.print(f"\n[bold green]Flow Complete![/bold green]")
        console.print(f"Explore the results in: {self.run_dir}")

    async def _generate_and_save(
        self,
        provider: Provider,
        prompt: str,
        round_num: int,
        options: CompletionOptions | None = None,
    ) -> str:
        """Generate output and save to file."""
        result = await provider.generate(prompt, options)
        save_output(self.run_dir, provider.name, round_num, result)
        return result
