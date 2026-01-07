# Research: Phase 0.1 - Project Setup

## Goal
Set up Docker + Streamlit project that can import Conclave Python modules.

---

## Key Questions to Answer

### 1. How to structure Docker to access Conclave code?

**Option A: Volume mount**
```yaml
volumes:
  - ../conclave_cli/python/conclave:/app/conclave
```
- Pros: Live updates, no copy needed
- Cons: Path dependency

**Option B: Copy into image**
```dockerfile
COPY ../conclave_cli/python/conclave /app/conclave
```
- Pros: Self-contained
- Cons: Rebuild on changes

**Option C: Install as package**
```dockerfile
RUN pip install -e /conclave
```
- Pros: Proper Python package
- Cons: More setup

**Decision:** Start with **Option A (volume mount)** for development speed.

---

### 2. What Conclave modules do we need?

Looking at `/Users/cg-adubuc/Desktop/Antoine/Shaareable Apps/conclave_cli/python/conclave/`:

```
conclave/
├── __init__.py
├── cli.py              # Don't need - CLI entry point
├── core/
│   ├── types.py        # NEED - FlowConfig, ProviderConfig types
│   └── config.py       # NEED - Config loading
├── providers/
│   ├── base.py         # NEED - Provider interface
│   ├── factory.py      # NEED - Create providers
│   ├── anthropic.py    # NEED
│   ├── openai.py       # NEED
│   ├── gemini.py       # NEED
│   └── grok.py         # NEED
├── flows/
│   ├── __init__.py     # NEED - Flow registry
│   ├── basic/          # NEED - Basic flow engine
│   └── leading/        # NEED - Leading flow engine
└── utils/
    ├── output.py       # Maybe - For saving results
    └── prompts.py      # Maybe - Prompt resolution
```

**Minimal imports needed:**
```python
from conclave.core.types import FlowConfig
from conclave.providers.factory import create_providers
from conclave.flows.basic.engine import BasicEngine
from conclave.flows.leading.engine import LeadingEngine
```

---

### 3. Streamlit requirements

```
streamlit>=1.30.0
```

Key features we'll use:
- `st.chat_message()` - Display chat bubbles
- `st.chat_input()` - Chat input box
- `st.session_state` - Persist state across reruns
- `st.columns()` - Layout
- `st.expander()` - Collapsible sections
- `st.spinner()` - Loading indicator

---

### 4. Docker Compose structure

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8501:8501"
    volumes:
      # Hot reload for development
      - .:/app
      # Mount Conclave for imports
      - ../../conclave_cli/python/conclave:/app/conclave
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    env_file:
      - .env
    # Streamlit specific
    command: streamlit run app.py --server.address 0.0.0.0 --server.runOnSave true
```

---

### 5. Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# System dependencies (if needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Streamlit port
EXPOSE 8501

# Health check
HEALTHCHECK CMD curl --fail http://localhost:8501/_stcore/health

# Run
CMD ["streamlit", "run", "app.py", "--server.address", "0.0.0.0"]
```

---

### 6. requirements.txt

```
# Core
streamlit>=1.30.0
anthropic>=0.40.0

# LLM providers (for flow execution)
openai>=1.0.0
google-generativeai>=0.3.0

# Utilities
python-dotenv>=1.0.0
pydantic>=2.0.0
pyyaml>=6.0

# Conclave dependencies (check their requirements.txt)
rich>=13.0.0
click>=8.0.0
```

---

### 7. File structure

```
conclave_ui/poc/phase_0/
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── .env.example
├── .gitignore
├── README.md
│
├── app.py                      # Main Streamlit app
│
├── lib/
│   ├── __init__.py
│   ├── agent.py                # FlowArchitectAgent
│   ├── tools.py                # Tool definitions & handlers
│   ├── executor.py             # Flow execution wrapper
│   └── openrouter.py           # OpenRouter provider
│
├── components/
│   ├── __init__.py
│   ├── chat.py
│   ├── flow_display.py
│   ├── results.py
│   └── sidebar.py
│
└── research/                   # This folder
    ├── 00_SDK_DECISION.md
    ├── 01_PROJECT_SETUP.md
    └── ...
```

---

## Verification Steps

After setup, verify:

1. **Docker builds:**
   ```bash
   docker-compose build
   ```

2. **App starts:**
   ```bash
   docker-compose up
   # Open http://localhost:8501
   ```

3. **Conclave imports work:**
   ```python
   # In app.py or Python shell
   from conclave.core.types import FlowConfig
   print("Conclave imported successfully!")
   ```

4. **Hot reload works:**
   - Edit app.py
   - Browser should auto-refresh

---

## Tasks Checklist

- [ ] Create directory structure
- [ ] Create requirements.txt
- [ ] Create Dockerfile
- [ ] Create docker-compose.yml
- [ ] Create .env.example
- [ ] Create .gitignore
- [ ] Create minimal app.py
- [ ] Build and test Docker
- [ ] Verify Conclave imports
- [ ] Verify hot reload
