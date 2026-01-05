"""Core types and schemas for Conclave configuration."""

import uuid
from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class AuthMethod(str, Enum):
    CLI = "cli"
    API_KEY = "api_key"
    AUTO = "auto"


class ProviderType(str, Enum):
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    GEMINI = "gemini"
    OPENAI_COMPATIBLE = "openai_compatible"
    GROK = "grok"


class FlowType(str, Enum):
    BASIC = "basic"
    LEADING = "leading"


class MessageRole(str, Enum):
    """Role of a message in chat."""

    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ContextStrategy(str, Enum):
    """Strategy for managing chat context window."""

    SLIDING_WINDOW = "sliding_window"
    SUMMARIZE = "summarize"


class ChatMessage(BaseModel):
    """A single message in chat."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    role: MessageRole
    content: str
    model: str | None = None  # Which model authored this (None for user)
    timestamp: datetime = Field(default_factory=datetime.now)
    is_expanded: bool = False  # Whether this is an expanded response


class ChatConfig(BaseModel):
    """Configuration for chat sessions."""

    # Response length control
    max_response_tokens: int = 300  # Encourages 2-4 sentences
    expand_max_tokens: int = 2000  # For /expand command

    # Context management
    context_strategy: ContextStrategy = ContextStrategy.SLIDING_WINDOW
    max_context_tokens: int = 8000
    max_history_messages: int = 50

    # Behavior
    parallel_responses: bool = True  # Get all model responses in parallel

    # UI
    show_timestamps: bool = False


class ProviderConfig(BaseModel):
    """Configuration for a single provider."""

    type: ProviderType
    model: str | None = None
    auth_method: AuthMethod = AuthMethod.AUTO
    api_key: str | None = None
    endpoint: str | None = None
    base_url: str | None = None


class FlowPrompts(BaseModel):
    """Prompts used in a flow."""

    round_1: str
    refinement: str
    leader_synthesis: str | None = None


class FlowConfig(BaseModel):
    """Configuration for a single flow."""

    name: str
    description: str | None = None
    flow_type: FlowType = FlowType.BASIC
    max_rounds: int = 2
    default_leader: str | None = None
    active_providers: list[str] | None = None
    prompts: FlowPrompts


class ConclaveConfig(BaseModel):
    """Root configuration for Conclave."""

    active_providers: list[str]
    providers: dict[str, ProviderConfig]
    flows: dict[str, FlowConfig]


# Default configuration
DEFAULT_CONFIG = ConclaveConfig(
    active_providers=["anthropic", "openai", "gemini"],
    providers={
        "anthropic": ProviderConfig(
            type=ProviderType.ANTHROPIC,
            model="claude-opus-4-5-20251101",
            auth_method=AuthMethod.AUTO,
        ),
        "openai": ProviderConfig(
            type=ProviderType.OPENAI,
            model="gpt-5.2",
            auth_method=AuthMethod.API_KEY,
        ),
        "gemini": ProviderConfig(
            type=ProviderType.GEMINI,
            model="gemini-2.0-flash",
            auth_method=AuthMethod.API_KEY,
        ),
        "grok": ProviderConfig(
            type=ProviderType.GROK,
            model="grok-4",
            auth_method=AuthMethod.API_KEY,
            base_url="https://api.x.ai/v1",
        ),
    },
    flows={
        "basic-ideator": FlowConfig(
            name="Basic Ideator",
            description="All models brainstorm independently, then everyone sees everyone's work and refines. Democratic round-robin.",
            flow_type=FlowType.BASIC,
            max_rounds=3,
            prompts=FlowPrompts(
                round_1="You are an expert architect. Analyze the user's request and provide a comprehensive, actionable plan. Be creative but grounded.",
                refinement="You are reviewing the work of your peers. Attached are their proposals, along with your original one. Critique their approaches, identify what they did better than you, and synthesize a new, superior version (vNext) of your plan that incorporates their best ideas while maintaining your unique strengths.",
            ),
        ),
        "leading-ideator": FlowConfig(
            name="Leading Ideator",
            description="One model leads and synthesizes. Others contribute ideas, leader distills the best into a unified vision.",
            flow_type=FlowType.LEADING,
            default_leader="anthropic",
            max_rounds=4,
            prompts=FlowPrompts(
                round_1="You are an expert architect. Analyze the user's request and provide a comprehensive, actionable plan. Be creative but grounded.",
                refinement="The lead architect has synthesized a unified plan from all contributions. Review their synthesis below. Identify gaps, improvements, or alternative approaches they may have missed. Provide your refined perspective.",
                leader_synthesis="You are the lead architect synthesizing input from your team. Review all contributions below. Extract the best ideas from each, resolve conflicts, and create a unified, superior plan that represents the best thinking of the group. Be decisive but acknowledge strong alternative viewpoints.",
            ),
        ),
        "audit": FlowConfig(
            name="Code Audit",
            description="Multiple security experts analyze code, then cross-review findings.",
            flow_type=FlowType.BASIC,
            max_rounds=2,
            prompts=FlowPrompts(
                round_1="You are a senior security engineer. Analyze the attached code for vulnerabilities, logical errors, and code smell. Be ruthless.",
                refinement="Review the findings of the other auditors. Did you miss anything they found? Verify their claims. Output a finalized, unified list of critical issues.",
            ),
        ),
    },
)
