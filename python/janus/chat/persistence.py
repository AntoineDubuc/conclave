"""Session persistence for chat rooms."""

import json
from pathlib import Path

from .session import ChatSession

SESSIONS_DIR = Path.cwd() / ".janus" / "chat_sessions"


def save_session(session: ChatSession, filename: str | None = None) -> Path:
    """Save session to JSON file."""
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

    if not filename:
        timestamp = session.created_at.strftime("%Y%m%d_%H%M%S")
        filename = f"chat_{timestamp}.json"

    if not filename.endswith(".json"):
        filename += ".json"

    filepath = SESSIONS_DIR / filename
    filepath.write_text(json.dumps(session.to_dict(), indent=2))
    return filepath


def load_session(filepath: str | Path) -> ChatSession:
    """Load session from JSON file."""
    path = Path(filepath)

    # Try as absolute path first
    if not path.exists():
        # Try in sessions directory
        path = SESSIONS_DIR / filepath

    if not path.exists():
        # Try adding .json extension
        path = SESSIONS_DIR / f"{filepath}.json"

    if not path.exists():
        raise FileNotFoundError(f"Session file not found: {filepath}")

    data = json.loads(path.read_text())
    return ChatSession.from_dict(data)


def list_sessions() -> list[dict]:
    """List available saved sessions."""
    if not SESSIONS_DIR.exists():
        return []

    sessions = []
    for f in SESSIONS_DIR.glob("*.json"):
        try:
            data = json.loads(f.read_text())
            sessions.append(
                {
                    "filename": f.name,
                    "created": data.get("created_at"),
                    "messages": len(data.get("messages", [])),
                    "models": data.get("active_models", []),
                }
            )
        except Exception:
            continue

    return sorted(sessions, key=lambda x: x.get("created", ""), reverse=True)
