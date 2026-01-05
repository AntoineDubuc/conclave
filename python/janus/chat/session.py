"""Chat session state management."""

import uuid
from datetime import datetime

from ..core.types import ChatMessage, MessageRole


class ChatSession:
    """Manages conversation state and history."""

    def __init__(
        self,
        session_id: str | None = None,
        active_models: list[str] | None = None,
    ):
        self.session_id = session_id or str(uuid.uuid4())[:8]
        self.messages: list[ChatMessage] = []
        self.active_models = active_models or []
        self.created_at = datetime.now()

    def add_message(self, message: ChatMessage) -> None:
        """Add a message to the session."""
        self.messages.append(message)

    def add_user_message(self, content: str) -> ChatMessage:
        """Add a user message and return it."""
        msg = ChatMessage(
            role=MessageRole.USER,
            content=content,
        )
        self.add_message(msg)
        return msg

    def add_assistant_message(
        self, content: str, model: str, is_expanded: bool = False
    ) -> ChatMessage:
        """Add an assistant message and return it."""
        msg = ChatMessage(
            role=MessageRole.ASSISTANT,
            content=content,
            model=model,
            is_expanded=is_expanded,
        )
        self.add_message(msg)
        return msg

    def get_last_user_message(self) -> ChatMessage | None:
        """Get the most recent user message."""
        for msg in reversed(self.messages):
            if msg.role == MessageRole.USER:
                return msg
        return None

    def clear(self) -> None:
        """Clear all messages."""
        self.messages = []

    def format_context(self) -> str:
        """Format messages as context string for LLM."""
        lines = []
        for msg in self.messages:
            if msg.role == MessageRole.USER:
                lines.append(f"User: {msg.content}")
            elif msg.role == MessageRole.ASSISTANT:
                lines.append(f"{msg.model}: {msg.content}")
        return "\n\n".join(lines)

    def to_dict(self) -> dict:
        """Serialize session for persistence."""
        return {
            "session_id": self.session_id,
            "created_at": self.created_at.isoformat(),
            "active_models": self.active_models,
            "messages": [
                {
                    "id": m.id,
                    "role": m.role.value,
                    "content": m.content,
                    "model": m.model,
                    "timestamp": m.timestamp.isoformat(),
                    "is_expanded": m.is_expanded,
                }
                for m in self.messages
            ],
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ChatSession":
        """Deserialize session from saved state."""
        session = cls(
            session_id=data["session_id"],
            active_models=data.get("active_models", []),
        )
        session.created_at = datetime.fromisoformat(data["created_at"])
        session.messages = [
            ChatMessage(
                id=m["id"],
                role=MessageRole(m["role"]),
                content=m["content"],
                model=m.get("model"),
                timestamp=datetime.fromisoformat(m["timestamp"]),
                is_expanded=m.get("is_expanded", False),
            )
            for m in data.get("messages", [])
        ]
        return session
