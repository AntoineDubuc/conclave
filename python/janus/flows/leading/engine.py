"""Leading flow engine - hub-and-spoke pattern."""

import asyncio
from dataclasses import dataclass, field

from rich.console import Console
from rich.status import Status

from ...core.types import FlowConfig
from ...providers.base import CompletionOptions, Provider
from ...utils.output import create_run_context, read_input_file, save_output
from ...utils.prompts import resolve_prompt
from .prompts import get_contributor_system_prompt, get_leader_system_prompt

console = Console()


@dataclass
class RunState:
    """State for a single round."""

    round: int
    outputs: dict[str, str] = field(default_factory=dict)


class LeadingFlowEngine:
    """
    LeadingFlowEngine implements the hub-and-spoke pattern:

    Step 1: Everyone ideates independently (parallel)
    Step 2: LEADER synthesizes all outputs into unified vision
    Step 3: NON-LEADERS respond to leader's synthesis
    Step 4: LEADER synthesizes again from responses
    ... alternating until max_rounds
    """

    def __init__(self, providers: list[Provider], flow: FlowConfig, leader_name: str):
        self.providers = providers
        self.flow = flow
        self.leader_name = leader_name
        ctx = create_run_context()
        self.run_id = ctx.run_id
        self.run_dir = ctx.run_dir

    def _get_leader_provider(self) -> Provider | None:
        """Find the leader provider by name."""
        for p in self.providers:
            if (
                self.leader_name.lower() in p.name.lower()
                or p.name.lower() in self.leader_name.lower()
            ):
                return p
        return None

    def _get_non_leader_providers(self) -> list[Provider]:
        """Get all providers except the leader."""
        leader = self._get_leader_provider()
        return [p for p in self.providers if p != leader]

    async def run(self, input_file: str, initial_prompt_override: str | None = None) -> None:
        """Run the leading flow."""
        leader = self._get_leader_provider()
        if not leader:
            console.print(f"[red]Error: Leader provider '{self.leader_name}' not found.[/red]")
            console.print(f"Available providers: {', '.join(p.name for p in self.providers)}")
            return

        non_leaders = self._get_non_leader_providers()

        console.print(f"\n[green]Starting Flow: {self.flow.name} (Run ID: {self.run_id})[/green]")
        console.print(f"[cyan]Leader: {leader.name}[/cyan]")
        console.print(f"[dim]Contributors: {', '.join(p.name for p in non_leaders)}[/dim]")
        console.print(f"[dim]Output Directory: {self.run_dir}[/dim]\n")

        input_content = read_input_file(input_file)
        history: list[RunState] = []
        current_round = 1

        # --- STEP 1: Everyone ideates independently ---
        with Status("Step 1: Everyone ideates independently", console=console) as status:
            round1_outputs: dict[str, str] = {}

            round1_prompt = initial_prompt_override or resolve_prompt(self.flow.prompts.round_1)
            full_round1_prompt = f"{round1_prompt}\n\n[INPUT FILE START]\n{input_content}\n[INPUT FILE END]"

            all_providers = [leader] + non_leaders
            tasks = [
                self._generate_and_save(provider, full_round1_prompt, 1)
                for provider in all_providers
            ]
            results = await asyncio.gather(*tasks)

            for provider, output in zip(all_providers, results):
                round1_outputs[provider.name] = output

            history.append(RunState(round=1, outputs=round1_outputs))
            status.stop()
            console.print("[green]✓[/green] Step 1 Complete: Everyone has ideated")
            current_round += 1

        # --- ALTERNATING LOOP ---
        while current_round <= self.flow.max_rounds:
            prev_outputs = history[-1].outputs

            # LEADER SYNTHESIS STEP
            with Status(f"Step {current_round}: Leader synthesizes", console=console) as status:
                # Gather all outputs for leader to review
                all_contributions = "\n\n---\n\n".join(
                    f"[CONTRIBUTION FROM {p.name.upper()}]\n{prev_outputs.get(p.name, 'No output')}"
                    for p in [leader] + non_leaders
                )

                leader_prompt_text = self.flow.prompts.leader_synthesis or self.flow.prompts.refinement
                full_leader_prompt = f"""{resolve_prompt(leader_prompt_text)}

[ALL CONTRIBUTIONS]
{all_contributions}

[TASK]
Synthesize a unified v{current_round} plan that incorporates the best ideas from all contributors."""

                options = CompletionOptions(
                    system_prompt=get_leader_system_prompt(current_round, self.flow.max_rounds)
                )
                leader_result = await leader.generate(full_leader_prompt, options)
                save_output(self.run_dir, leader.name, current_round, leader_result, "synthesis")

                leader_outputs = {leader.name: leader_result}
                status.stop()
                console.print(f"[green]✓[/green] Step {current_round} Complete: Leader synthesized")
                current_round += 1

            if current_round > self.flow.max_rounds:
                history.append(RunState(round=current_round - 1, outputs=leader_outputs))
                break

            # NON-LEADERS RESPOND STEP
            with Status(f"Step {current_round}: Contributors respond to leader", console=console) as status:
                refinement_prompt = resolve_prompt(self.flow.prompts.refinement)
                respond_outputs: dict[str, str] = {}

                tasks = []
                for provider in non_leaders:
                    my_prev_output = prev_outputs.get(provider.name, "")

                    full_respond_prompt = f"""{refinement_prompt}

[YOUR PREVIOUS VERSION (v{current_round - 2})]
{my_prev_output}

[LEADER'S SYNTHESIS (v{current_round - 1})]
{leader_result}

[TASK]
Based on the leader's synthesis, provide your v{current_round} response. Identify improvements, gaps, or alternative approaches."""

                    options = CompletionOptions(
                        system_prompt=get_contributor_system_prompt(current_round, self.flow.max_rounds)
                    )
                    tasks.append(self._generate_and_save(provider, full_respond_prompt, current_round, options))

                results = await asyncio.gather(*tasks)
                for provider, output in zip(non_leaders, results):
                    respond_outputs[provider.name] = output

                # Merge leader's synthesis with responses for next round
                merged_outputs = {**respond_outputs, leader.name: leader_result}
                history.append(RunState(round=current_round, outputs=merged_outputs))

                status.stop()
                console.print(f"[green]✓[/green] Step {current_round} Complete: Contributors responded")
                current_round += 1

        console.print(f"\n[bold green]Flow Complete![/bold green]")
        console.print(f"Explore the results in: {self.run_dir}")
        console.print(f"[cyan]Final synthesis from {leader.name} is the recommended output.[/cyan]")

    async def _generate_and_save(
        self,
        provider: Provider,
        prompt: str,
        round_num: int,
        options: CompletionOptions | None = None,
        suffix: str | None = None,
    ) -> str:
        """Generate output and save to file."""
        result = await provider.generate(prompt, options)
        save_output(self.run_dir, provider.name, round_num, result, suffix)
        return result
