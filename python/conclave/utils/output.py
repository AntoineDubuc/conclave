"""Output utilities for saving flow results."""

import uuid
from dataclasses import dataclass
from pathlib import Path


@dataclass
class RunContext:
    """Context for a flow run."""

    run_id: str
    run_dir: Path


def create_run_context() -> RunContext:
    """Create a new run context with unique ID and output directory."""
    run_id = str(uuid.uuid4()).split("-")[0]
    run_dir = Path.cwd() / ".conclave" / "runs" / run_id
    return RunContext(run_id=run_id, run_dir=run_dir)


def save_output(
    run_dir: Path,
    provider: str,
    round: int,
    content: str,
    suffix: str | None = None,
) -> None:
    """Save output content to a file in the run directory."""
    run_dir.mkdir(parents=True, exist_ok=True)

    suffix_part = f".{suffix}" if suffix else ""
    filename = f"{provider.lower()}{suffix_part}.v{round}.md"
    (run_dir / filename).write_text(content)


def read_input_file(input_file: str | Path) -> str:
    """Read input file content."""
    return Path(input_file).read_text()
