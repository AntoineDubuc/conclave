# Research: Phase 0.5 - API Key Management

## Goal
Allow users to enter API keys for LLM providers, stored in session (not persisted).

---

## Sidebar Layout

```python
def render_sidebar() -> dict:
    """Render sidebar with API key inputs. Returns dict of keys."""

    st.sidebar.title("⚙️ Settings")

    # API Keys section
    st.sidebar.header("API Keys")

    api_keys = {}

    # OpenRouter option (single key for all)
    use_openrouter = st.sidebar.checkbox(
        "Use OpenRouter (single key for all models)",
        value=False,
        help="OpenRouter provides access to multiple models with one API key"
    )

    if use_openrouter:
        api_keys["openrouter"] = st.sidebar.text_input(
            "OpenRouter API Key",
            type="password",
            key="key_openrouter"
        )
        st.sidebar.caption("Get a key at [openrouter.ai](https://openrouter.ai)")
    else:
        # Individual provider keys
        with st.sidebar.expander("Provider Keys", expanded=True):
            api_keys["anthropic"] = st.text_input(
                "Anthropic",
                type="password",
                key="key_anthropic",
                placeholder="sk-ant-..."
            )
            api_keys["openai"] = st.text_input(
                "OpenAI",
                type="password",
                key="key_openai",
                placeholder="sk-..."
            )
            api_keys["gemini"] = st.text_input(
                "Google Gemini",
                type="password",
                key="key_gemini",
                placeholder="AI..."
            )
            api_keys["grok"] = st.text_input(
                "xAI (Grok)",
                type="password",
                key="key_grok",
                placeholder="xai-..."
            )

    # Show status
    st.sidebar.markdown("---")
    st.sidebar.subheader("Status")

    if use_openrouter and api_keys.get("openrouter"):
        st.sidebar.success("✅ OpenRouter configured")
    else:
        configured = [k for k, v in api_keys.items() if v and k != "openrouter"]
        if configured:
            st.sidebar.success(f"✅ {', '.join(configured)}")
        else:
            st.sidebar.warning("⚠️ No API keys configured")

    return api_keys
```

---

## Environment Variable Fallback

Also check environment variables:

```python
import os

def get_api_keys_with_env_fallback(user_keys: dict) -> dict:
    """Merge user-provided keys with environment variables."""

    final_keys = {}

    # Priority: User input > Environment variable
    mappings = {
        "anthropic": "ANTHROPIC_API_KEY",
        "openai": "OPENAI_API_KEY",
        "gemini": "GEMINI_API_KEY",
        "grok": "XAI_API_KEY",
        "openrouter": "OPENROUTER_API_KEY",
    }

    for key_name, env_var in mappings.items():
        user_value = user_keys.get(key_name)
        env_value = os.environ.get(env_var)

        if user_value:
            final_keys[key_name] = user_value
        elif env_value:
            final_keys[key_name] = env_value

    return final_keys
```

---

## Key Validation (Optional)

Quick validation before running flows:

```python
async def validate_api_key(provider: str, key: str) -> bool:
    """Quick check if an API key works."""

    try:
        if provider == "anthropic":
            client = anthropic.Anthropic(api_key=key)
            # Minimal API call
            client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=10,
                messages=[{"role": "user", "content": "Hi"}]
            )
            return True
        elif provider == "openai":
            client = openai.OpenAI(api_key=key)
            client.models.list()
            return True
        # ... etc
    except Exception:
        return False
```

---

## Security Notes

**Phase Zero only** - keys stored in `st.session_state`:
- Not persisted to disk
- Lost on page refresh
- Not sent to our backend (only to LLM providers)

**Phase 1+** considerations:
- Encrypt at rest
- Use secrets manager
- Never log keys
- Consider OAuth for some providers

---

## Tasks Checklist

- [ ] Create `components/sidebar.py`
- [ ] Implement `render_sidebar()` function
- [ ] Add OpenRouter toggle
- [ ] Add individual provider key inputs
- [ ] Add status display
- [ ] Implement env var fallback
- [ ] Test keys are correctly passed to executor
