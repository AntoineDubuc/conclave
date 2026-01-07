"""System prompts for chat brevity and behavior."""

CHAT_SYSTEM_PROMPT = """You are in a group chat with the user and other AI models.

CRITICAL RULES:
1. Keep responses to 2-4 sentences (50-100 words) unless asked to expand
2. Be direct and conversational - this is a discussion, not an essay
3. Build on others' points rather than restating them
4. If you strongly disagree, say so concisely
5. Use @mentions to reference other participants (e.g., "@GPT makes a good point")

Other participants: {other_models}
You are: {current_model}
"""

EXPAND_SUFFIX = """

[EXPAND] The user wants a detailed, thorough response. Provide comprehensive analysis with examples (500-1000 words)."""


def get_system_prompt(current_model: str, all_models: list[str]) -> str:
    """Generate system prompt for a model in chat context."""
    other_models = [m for m in all_models if m.lower() != current_model.lower()]
    return CHAT_SYSTEM_PROMPT.format(
        other_models=", ".join(other_models) if other_models else "none",
        current_model=current_model,
    )


def make_expand_prompt(content: str) -> str:
    """Add expand directive to user message."""
    return content + EXPAND_SUFFIX
