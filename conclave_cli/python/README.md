# Conclave

Multi-LLM collaboration CLI. Harvests unique insights from each model through structured flows.

## Installation

```bash
pip install -e .
```

## Usage

```bash
conclave run basic-ideator input.md
conclave run leading-ideator input.md --leader openai
conclave list
conclave doctor
```

## Flows

- **basic-ideator**: Round-robin democratic collaboration
- **leading-ideator**: Hub-and-spoke with designated leader
- **audit**: Security code review

## Configuration

Create `conclave.config.yaml` in your project:

```yaml
active_providers:
  - anthropic
  - openai
  - gemini
```

Set API keys as environment variables:
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
