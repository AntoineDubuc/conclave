# Tutorial: Leading Flow (Hub-and-Spoke Hierarchical)

**Use Case: Designing Janus's Plugin Architecture**

The leading flow implements a hub-and-spoke pattern where one model acts as the leader, synthesizing contributions from all others into a unified vision. This produces one coherent output rather than multiple perspectives.

---

## How Leading Flow Works

```
┌─────────────────────────────────────────────────────────────┐
│                    STEP 1: IDEATION                         │
│   Input → [Leader] [Contrib1] [Contrib2] [Contrib3]         │
│           All brainstorm independently (parallel)            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    STEP 2: SYNTHESIS                        │
│   Leader reviews ALL contributions                          │
│   Leader creates unified synthesis document                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    STEP 3: RESPONSE                         │
│   Non-leaders review leader's synthesis                     │
│   Each provides feedback, gaps, alternatives                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    STEP 4: FINAL SYNTHESIS                  │
│   Leader incorporates all feedback                          │
│   Produces final unified document                           │
└─────────────────────────────────────────────────────────────┘
```

---

## When to Use Leading Flow

| Good For | Not Ideal For |
|----------|---------------|
| Architecture documents | When you want multiple opinions |
| Project proposals | Brainstorming (use basic flow) |
| Technical specs | When no clear "best" model exists |
| Final documentation | Exploratory research |

---

## Real Example: Designing Plugin Architecture

Let's use the leading flow to design a plugin system for Janus, with Claude as the leader.

### Step 1: Create the Input File

Create `plugin-architecture.md`:

```markdown
# Plugin Architecture Design Request

## Context

Janus is a multi-LLM collaboration CLI. We want to add a plugin system so
users can:

1. Add new flow types without modifying core code
2. Add new providers (LLM integrations)
3. Add custom output formatters
4. Share plugins via npm/pip packages

## Requirements

- Simple to create plugins (< 50 lines for a basic one)
- Type-safe with good IDE support
- Works with both Python and TypeScript implementations
- Plugins can be loaded from local files or packages
- Version compatibility checking
- No security sandbox needed (trust user's plugins)

## Existing Structure

```
janus/
├── flows/          # Flow implementations
├── providers/      # LLM providers
└── utils/          # Utilities
```

## Questions to Answer

1. What's the plugin discovery mechanism?
2. How do plugins register themselves?
3. What's the interface contract for each plugin type?
4. How do we handle plugin dependencies?
5. What's the versioning strategy?

## Deliverable

A comprehensive architecture document with:
- Plugin interface definitions
- Registration and discovery design
- Example plugin code
- Migration path for existing code
```

### Step 2: Run the Leading Flow

```bash
janus run leading-ideator plugin-architecture.md --leader anthropic
```

Or if `anthropic` is the default leader:

```bash
janus run leading-ideator plugin-architecture.md
```

Output:
```
Starting Flow: leading-ideator (Run ID: 20250104-150522)
Leader: Anthropic (CLI)
Contributors: OpenAI, Gemini
Output Directory: .janus/runs/20250104-150522

--- Leading Ideator ---
Pattern: Hub-and-Spoke (Hierarchical)
One model leads and synthesizes, others contribute ideas that the leader
distills into a unified vision.

Step 1: Everyone ideates independently
✓ Step 1 Complete: Everyone has ideated
Step 2: Leader synthesizes
✓ Step 2 Complete: Leader synthesized
Step 3: Contributors respond to leader
✓ Step 3 Complete: Contributors responded
Step 4: Leader synthesizes
✓ Step 4 Complete: Leader synthesized

Flow Complete!
Explore the results in: .janus/runs/20250104-150522
Final synthesis from Anthropic (CLI) is the recommended output.
```

### Step 3: Review the Outputs

```
.janus/runs/20250104-150522/
├── anthropic-round-1.md              # Claude's initial ideas
├── anthropic-round-2-synthesis.md    # Claude's first synthesis
├── anthropic-round-4-synthesis.md    # Claude's FINAL synthesis ⭐
├── openai-round-1.md                 # GPT's initial ideas
├── openai-round-3.md                 # GPT's response to synthesis
├── gemini-round-1.md                 # Gemini's initial ideas
└── gemini-round-3.md                 # Gemini's response to synthesis
```

The **final synthesis** (`anthropic-round-4-synthesis.md`) is the primary output.

---

## Example Outputs

### Step 1: Initial Ideas (All Models)

**anthropic-round-1.md (Leader):**
```markdown
## Plugin Architecture Proposal

### Core Concept: Protocol-Based Plugins

I propose using Python's Protocol (structural subtyping) for plugin interfaces:

```python
from typing import Protocol

class FlowPlugin(Protocol):
    name: str
    version: str

    def create_engine(self, providers, config) -> FlowEngine: ...
```

### Discovery via Entry Points

Use standard packaging entry points:

```toml
# pyproject.toml
[project.entry-points."janus.flows"]
my-flow = "my_package:MyFlowPlugin"
```

### Key Decisions

1. **No base classes** - Protocols allow duck typing
2. **Entry points** - Standard, pip-installable
3. **Lazy loading** - Only import when used
```

**openai-round-1.md (Contributor):**
```markdown
## Plugin System Thoughts

### Alternative: Decorator-Based Registration

Instead of entry points, consider decorators:

```python
from janus import register_flow

@register_flow("my-flow")
class MyFlow:
    def run(self, input_file): ...
```

### Benefits

- More explicit registration
- Works without packaging
- Better IDE discovery

### Plugin Manifest

Each plugin should have a manifest:

```yaml
# janus-plugin.yaml
name: my-plugin
version: 1.0.0
janus_version: ">=0.2.0"
provides:
  flows:
    - my-custom-flow
  providers:
    - my-llm
```
```

**gemini-round-1.md (Contributor):**
```markdown
## Plugin Architecture Input

### Suggest: Filesystem Discovery

For local development, scan directories:

```python
def discover_plugins(paths: list[Path]) -> list[Plugin]:
    for path in paths:
        if (path / "janus-plugin.yaml").exists():
            yield load_plugin(path)
```

### TypeScript Consideration

For parity, use dynamic imports:

```typescript
const plugin = await import(pluginPath);
```

### Version Compatibility

Use semver ranges:

```python
def check_compatibility(plugin_requires: str, janus_version: str) -> bool:
    return semver.match(janus_version, plugin_requires)
```
```

### Step 2: Leader's First Synthesis

**anthropic-round-2-synthesis.md:**
```markdown
# Janus Plugin Architecture v1

*Synthesized from all contributions*

## Overview

This document defines the plugin architecture for Janus, incorporating
ideas from all contributors.

## Plugin Types

| Type | Interface | Description |
|------|-----------|-------------|
| Flow | `FlowPlugin` | Custom orchestration patterns |
| Provider | `ProviderPlugin` | New LLM integrations |
| Formatter | `FormatterPlugin` | Output formatting |

## Discovery Mechanisms

Combining @OpenAI's decorator approach with @Gemini's filesystem scanning
and my entry points suggestion, we support three discovery methods:

### 1. Entry Points (Recommended for Packages)

```toml
[project.entry-points."janus.flows"]
my-flow = "my_package:MyFlowPlugin"
```

### 2. Decorators (Recommended for Local Development)

```python
from janus.plugins import register_flow

@register_flow("my-flow")
class MyFlow:
    ...
```

### 3. Filesystem (Auto-discovery)

Scan `~/.janus/plugins/` for `janus-plugin.yaml` manifests.

## Plugin Interface

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class FlowPlugin(Protocol):
    """Interface for flow plugins."""

    name: str
    version: str
    janus_version: str  # Semver requirement

    def create_engine(
        self,
        providers: list[Provider],
        config: FlowConfig,
    ) -> FlowEngine: ...
```

## Manifest Format

Following @OpenAI's suggestion with @Gemini's compatibility checking:

```yaml
name: my-plugin
version: 1.0.0
janus_version: ">=0.2.0,<1.0.0"
provides:
  flows:
    - name: my-flow
      description: "My custom flow"
  providers:
    - name: my-llm
      description: "My LLM provider"
```

## Loading Order

1. Built-in plugins (highest priority)
2. Entry point plugins
3. Decorated plugins
4. Filesystem plugins

## Open Questions

- Should plugins be able to depend on other plugins?
- How to handle plugin conflicts (same name)?
- Testing strategy for plugins?
```

### Step 3: Contributors Respond

**openai-round-3.md:**
```markdown
## Response to Leader's Synthesis

### Agreements

- Three-tier discovery is comprehensive
- Protocol-based interface is clean

### Suggested Improvements

1. **Plugin Conflicts**: Add namespace prefixing:
   ```
   janus.flows.official.basic
   janus.flows.community.my-flow
   ```

2. **Testing**: Add a plugin testing harness:
   ```python
   from janus.testing import PluginTestCase

   class TestMyFlow(PluginTestCase):
       plugin = MyFlowPlugin

       def test_basic_run(self):
           self.assert_flow_produces_output("input.md")
   ```

3. **Plugin Dependencies**: Use optional peer dependencies:
   ```yaml
   dependencies:
     - janus-plugin-utils: ">=1.0.0"
   ```

### Missing Piece

No mention of plugin lifecycle hooks (init, shutdown).
```

**gemini-round-3.md:**
```markdown
## Feedback on Synthesis

### Strong Points

- Manifest format is clear
- Multiple discovery mechanisms cover all use cases

### Additions

1. **Hot Reloading** for development:
   ```python
   janus plugins --watch  # Reload on file changes
   ```

2. **Plugin Templates**:
   ```bash
   janus plugin new my-flow --type flow
   ```

3. **TypeScript Equivalent**: Add types file:
   ```typescript
   // janus-plugin.d.ts
   export interface FlowPlugin {
     name: string;
     version: string;
     createEngine(providers: Provider[], config: FlowConfig): FlowEngine;
   }
   ```

### Concern

Loading order should be configurable per-project, not global.
```

### Step 4: Final Synthesis

**anthropic-round-4-synthesis.md:**
```markdown
# Janus Plugin Architecture - Final Specification

*Version 1.0 | Synthesized from multi-model collaboration*

## Executive Summary

This specification defines a plugin system for Janus that enables
extensibility through flows, providers, and formatters. It incorporates
feedback from GPT (conflict resolution, testing, lifecycle) and Gemini
(hot reloading, templates, TypeScript parity).

---

## 1. Plugin Types

| Type | Interface | Purpose |
|------|-----------|---------|
| `FlowPlugin` | Custom orchestration patterns |
| `ProviderPlugin` | New LLM integrations |
| `FormatterPlugin` | Output formatting |

---

## 2. Plugin Interface (Python)

```python
from typing import Protocol, runtime_checkable
from abc import abstractmethod

@runtime_checkable
class FlowPlugin(Protocol):
    """Interface for flow plugins."""

    name: str
    version: str
    janus_version: str  # Semver requirement

    def on_load(self) -> None:
        """Called when plugin is loaded."""
        ...

    def on_unload(self) -> None:
        """Called when plugin is unloaded."""
        ...

    @abstractmethod
    def create_engine(
        self,
        providers: list[Provider],
        config: FlowConfig,
    ) -> FlowEngine: ...
```

---

## 3. Plugin Interface (TypeScript)

```typescript
// @janus/plugin-types
export interface FlowPlugin {
  readonly name: string;
  readonly version: string;
  readonly janusVersion: string;

  onLoad?(): Promise<void>;
  onUnload?(): Promise<void>;

  createEngine(
    providers: Provider[],
    config: FlowConfig
  ): FlowEngine;
}
```

---

## 4. Discovery Mechanisms

### Priority Order (Configurable)

```yaml
# janus.config.yaml
plugin_priority:
  - builtin
  - entrypoints
  - decorated
  - filesystem
```

### 4.1 Entry Points

```toml
[project.entry-points."janus.flows"]
acme-flow = "acme_janus:AcmeFlowPlugin"
```

### 4.2 Decorators

```python
from janus.plugins import register_flow

@register_flow("my-flow")
class MyFlow:
    name = "my-flow"
    version = "1.0.0"
    janus_version = ">=0.2.0"

    def create_engine(self, providers, config):
        return MyFlowEngine(providers, config)
```

### 4.3 Filesystem

```
~/.janus/plugins/
└── my-plugin/
    ├── janus-plugin.yaml
    └── plugin.py
```

---

## 5. Manifest Format

```yaml
name: acme-flows
version: 1.0.0
janus_version: ">=0.2.0,<1.0.0"

provides:
  flows:
    - name: acme-brainstorm
      module: acme_flows.brainstorm:BrainstormPlugin
      description: "ACME's brainstorming flow"

dependencies:  # Optional peer plugins
  - janus-utils: ">=1.0.0"
```

---

## 6. Conflict Resolution

Namespaced with source prefix:

```
janus.flows.builtin.basic
janus.flows.entrypoint.acme-flow
janus.flows.local.my-flow
```

User can override in config:

```yaml
flow_aliases:
  brainstorm: janus.flows.entrypoint.acme-flow
```

---

## 7. Development Tools

### Plugin Generator

```bash
janus plugin new my-flow --type flow
# Creates scaffold with manifest, tests, example
```

### Hot Reload (Dev Mode)

```bash
janus plugins --watch
# Reloads plugins on file changes
```

### Testing Harness

```python
from janus.testing import PluginTestCase

class TestMyFlow(PluginTestCase):
    plugin_class = MyFlowPlugin

    def test_produces_output(self):
        result = self.run_flow("fixtures/input.md")
        self.assertOutputContains(result, "expected content")

    def test_handles_errors(self):
        with self.assertRaises(FlowError):
            self.run_flow("fixtures/invalid.md")
```

---

## 8. Migration Path

Existing flows become builtin plugins:

```python
# janus/flows/basic/__init__.py
from janus.plugins import register_flow

@register_flow("basic", builtin=True)
class BasicFlowPlugin:
    ...
```

No breaking changes to CLI or config.

---

## 9. Security Considerations

- Plugins run with full user permissions (no sandbox)
- Entry point plugins are pip-auditable
- Filesystem plugins require explicit trust

---

## 10. Implementation Phases

| Phase | Deliverable |
|-------|-------------|
| 1 | Plugin interfaces and loading |
| 2 | Entry point discovery |
| 3 | Decorator registration |
| 4 | Filesystem discovery |
| 5 | Development tools |
| 6 | TypeScript parity |

---

## Appendix: Example Plugin

```python
# my_plugin/flow.py
from janus.plugins import register_flow, FlowEngine
from janus.core.types import FlowConfig
from janus.providers.base import Provider

@register_flow("round-robin-v2")
class RoundRobinV2Plugin:
    name = "round-robin-v2"
    version = "1.0.0"
    janus_version = ">=0.2.0"

    def on_load(self):
        print("Round Robin V2 loaded!")

    def create_engine(
        self,
        providers: list[Provider],
        config: FlowConfig,
    ) -> FlowEngine:
        return RoundRobinV2Engine(providers, config)
```

---

*Generated with Janus leading flow | Leader: Claude | Contributors: GPT, Gemini*
```

---

## Understanding the Value

### What the Leader Brought

| Contribution | Result |
|--------------|--------|
| Initial Protocol-based design | Core architecture |
| Synthesis skill | Unified document |
| Integration of peer ideas | Comprehensive spec |

### What Contributors Brought

| Model | Unique Contribution |
|-------|---------------------|
| GPT | Conflict resolution, testing harness, lifecycle hooks |
| Gemini | Hot reloading, TypeScript parity, plugin templates |

### Final Document Quality

The leader's synthesis:
- Credits contributor ideas explicitly
- Resolves conflicts between approaches
- Adds implementation phases
- Includes practical examples
- Provides migration path

---

## Choosing the Right Leader

| Model | Best As Leader For |
|-------|-------------------|
| Claude | Architecture, specifications, nuanced decisions |
| GPT | Broad technical docs, API design |
| Gemini | Analytical reports, data-heavy specs |

---

## Customizing the Flow

### Set Default Leader

```yaml
flows:
  architecture:
    flow_type: leading
    default_leader: anthropic
    max_rounds: 4
```

### Override at Runtime

```bash
janus run architecture spec.md --leader openai
```

### Custom Prompts

```yaml
flows:
  architecture:
    flow_type: leading
    prompts:
      round_1: |
        You are a software architect. Propose a design for the following:
      refinement: |
        Review the leader's synthesis. Identify:
        1. Gaps or missing considerations
        2. Alternative approaches worth considering
        3. Potential risks or concerns
      leader_synthesis: |
        As the lead architect, synthesize all contributions into a
        unified specification. Credit contributors for their ideas.
        Resolve any conflicts with clear rationale.
```

---

## Output Structure

Leading flow produces synthesis-tagged files:

```
.janus/runs/20250104-150522/
├── anthropic-round-1.md              # Leader's initial ideas
├── anthropic-round-2-synthesis.md    # First synthesis
├── anthropic-round-4-synthesis.md    # FINAL SYNTHESIS ⭐
├── openai-round-1.md                 # Contributor ideas
├── openai-round-3.md                 # Response to synthesis
├── gemini-round-1.md                 # Contributor ideas
└── gemini-round-3.md                 # Response to synthesis
```

The **final synthesis** is always the highest-numbered `*-synthesis.md` file.

---

## Tips for Effective Leading Flows

### 1. Choose Leader Based on Task

Not all models are equal leaders. Match the leader to the task type.

### 2. More Rounds = More Refinement

Default is 4 rounds. For complex specs, try 6:

```yaml
max_rounds: 6
```

### 3. Review Contributor Responses

Even though the synthesis is the output, contributor responses in round 3+ often contain valuable dissenting opinions.

### 4. Use for Final Deliverables

Leading flow is ideal when you need **one document** to share, not multiple perspectives.

---

## Comparison: Leading vs Basic

| Aspect | Leading Flow | Basic Flow |
|--------|--------------|------------|
| Output | One unified document | Multiple perspectives |
| Structure | Hub-and-spoke | Round-robin |
| Leader role | Synthesizes all | None (democratic) |
| Best for | Final specs, proposals | Audits, brainstorming |
| File count | Fewer (synthesis focused) | More (all perspectives) |

---

*See also: [Basic Flow Tutorial](BASIC_FLOW_TUTORIAL.md) | [Chat Tutorial](CHAT_TUTORIAL.md)*
