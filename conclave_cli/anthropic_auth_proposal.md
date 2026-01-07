# Using Anthropic Models Without an API Key: A Technical Proposal

## Executive Summary

This document explores how Conclave users with a **Claude Code Max subscription** ($100-200/month) can leverage their subscription for Anthropic model access without paying for separate API credits. The key finding: **Anthropic explicitly prohibits third-party apps from using subscription authentication via their SDK**, but the **CLI-based approach Conclave already implements is the officially supported workaround**.

---

## 1. The Authentication Landscape

### 1.1 Two Separate Worlds

Anthropic maintains two distinct authentication systems:

| System | Authentication | Billing | Programmatic Use |
|--------|---------------|---------|------------------|
| **Claude.ai Subscription** (Pro/Max) | OAuth via browser | Monthly flat rate | CLI only |
| **Anthropic Console API** | API Keys (`sk-ant-...`) | Pay-per-token | SDK + CLI |

### 1.2 The Critical Limitation

From the [official Agent SDK documentation](https://platform.claude.com/docs/en/agent-sdk/overview):

> **"Unless previously approved, we do not allow third party developers to offer Claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK. Please use the API key authentication methods described in this document instead."**

This means:
- The `@anthropic-ai/claude-agent-sdk` (TypeScript/Python) **requires API keys**
- Direct OAuth token usage is **server-side blocked** by Anthropic
- Subscription tokens work **only** with whitelisted clients (Claude CLI, OpenCode)

---

## 2. Available Authentication Methods

### 2.1 Method Comparison

| Method | Works with Max Sub? | Programmatic? | Complexity | Notes |
|--------|---------------------|---------------|------------|-------|
| **Claude CLI Spawn** | Yes | Yes (via subprocess) | Low | Current Conclave approach |
| **Claude Agent SDK** | No (API key only) | Yes (native) | Medium | More features, but costs extra |
| **OpenCode Proxy** | Yes | Yes (via subprocess) | Medium | Alternative whitelisted client |
| **Direct OAuth** | No | N/A | N/A | Server rejects non-whitelisted clients |

### 2.2 Why CLI Spawning Works

The `claude` binary is a **whitelisted OAuth client**. When you authenticate via `claude login`:
1. OAuth flow completes in browser
2. Token stored in macOS Keychain (or equivalent)
3. CLI can make authenticated requests to Anthropic

Conclave can spawn this binary and capture output, effectively "borrowing" the subscription authentication.

---

## 3. Current Conclave Implementation Analysis

### 3.1 What Works

The `ClaudeBinaryProvider` in `src/providers/claude_binary.ts`:

```typescript
// Current implementation spawns claude CLI
const child = spawn('claude', ['-p', prompt, '--dangerously-skip-permissions']);
```

**Strengths:**
- Falls back automatically when `ANTHROPIC_API_KEY` is missing
- Passes through stderr for real-time status
- Captures stdout as the response
- Works with user's existing Claude Code authentication

### 3.2 Current Gaps

1. **No Authentication Validation**: Doesn't check if user is actually logged in before running
2. **Limited Error Handling**: Generic error messages don't distinguish auth failures from other errors
3. **No Model Selection via CLI**: The `--model` flag may not work for all subscription tiers
4. **Missing Structured Output**: CLI output isn't parsed for token usage or metadata
5. **No Rate Limit Awareness**: Max plan has limits (50-200 msgs/5hrs) that aren't tracked

---

## 4. Recommended Improvements

### 4.1 Enhanced Authentication Detection

```typescript
// Proposed: Check auth status before running
async function checkClaudeAuth(): Promise<{
  authenticated: boolean;
  method: 'subscription' | 'api_key' | 'none';
  plan?: 'pro' | 'max' | 'team' | 'enterprise';
}> {
  // Run a minimal health check
  const result = await runCommand('claude', ['-p', 'hi', '--output-format', 'json']);
  // Parse response for auth metadata
}
```

### 4.2 Dual-Mode Provider Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AnthropicProvider                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   API Key Mode      │    │   Subscription Mode         │ │
│  │   (Claude Agent SDK)│    │   (Claude CLI Spawn)        │ │
│  │                     │    │                             │ │
│  │  - Full SDK features│    │  - Uses Max/Pro plan        │ │
│  │  - Pay-per-token    │    │  - Subprocess overhead      │ │
│  │  - Structured output│    │  - Text-only output         │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Improved CLI Provider Implementation

```typescript
// Proposed enhanced ClaudeBinaryProvider

export class ClaudeBinaryProvider implements Provider {
  async generate(prompt: string, options?: CompletionOptions): Promise<string> {
    const args = [
      '-p', prompt,
      '--dangerously-skip-permissions',
      '--output-format', 'stream-json', // Structured output
      '--max-tokens', String(options?.maxTokens || 16384),
    ];

    if (options?.systemPrompt) {
      args.push('--system-prompt', options.systemPrompt);
    }

    // Use spawn with proper error handling
    return new Promise((resolve, reject) => {
      const child = spawn('claude', args, {
        env: {
          ...process.env,
          // Ensure CLI uses subscription, not env API key
          ANTHROPIC_API_KEY: undefined,
        }
      });

      // ... enhanced error handling and output parsing
    });
  }
}
```

### 4.4 User-Friendly Auth Flow

```
┌────────────────────────────────────────────────────────────┐
│                    conclave doctor                             │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Anthropic Authentication:                                 │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✓ Claude CLI: Installed (v2.0.76)                  │   │
│  │ ✓ Authentication: Max Plan (OAuth)                  │   │
│  │ ✓ Rate Limits: 180/200 messages remaining          │   │
│  │ ℹ Using: Subscription (no API charges)             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  To use API key instead: export ANTHROPIC_API_KEY=...      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 5. Alternative Approaches Investigated

### 5.1 OpenCode Integration

The [claude-max-access-sdk](https://github.com/parkertoddbrooks/claude-max-access-sdk) project routes requests through OpenCode (another whitelisted OAuth client):

```javascript
const sdk = new ClaudeSDK({ method: 'opencode' });
```

**Pros:**
- Works with Max subscription
- Community-maintained SDK wrapper

**Cons:**
- Adds another dependency (OpenCode binary)
- Unofficial, could break
- Same subprocess overhead as CLI

**Recommendation:** Not worth the additional complexity over direct CLI spawning.

### 5.2 Roo Code / Kilo Code Approach

These tools use the same pattern as Conclave:
1. Check for CLI installation
2. Spawn `claude` with prompts
3. Parse JSON output

This validates that Conclave's approach is the industry standard.

### 5.3 Vercel AI SDK Community Provider

The [ai-sdk-provider-claude-code](https://github.com/ben-vargas/ai-sdk-provider-claude-code) package wraps Claude CLI for Vercel AI SDK:

```typescript
import { claudeCode } from 'ai-sdk-provider-claude-code';
const result = streamText({ model: claudeCode('sonnet'), prompt: '...' });
```

**Insight:** Could be useful if Conclave ever integrates with Vercel AI SDK ecosystem.

---

## 6. Implementation Roadmap

### Phase 1: Improve Current CLI Provider (Low Effort, High Impact)

1. Add pre-flight authentication check
2. Implement `--output-format stream-json` parsing
3. Better error messages for auth failures
4. Track and display rate limit status

### Phase 2: Unified Provider Interface (Medium Effort)

1. Create `AnthropicUnifiedProvider` that auto-selects:
   - API Key mode (if `ANTHROPIC_API_KEY` is set and valid)
   - CLI mode (if authenticated via subscription)
2. Expose auth method in `conclave doctor` output
3. Add config option to force one mode

### Phase 3: Claude Agent SDK Integration (Optional, API Key Only)

1. Add optional `@anthropic-ai/claude-agent-sdk` dependency
2. Use SDK features (hooks, subagents) when API key is available
3. Graceful fallback to CLI for subscription users

---

## 7. Key Takeaways

1. **Conclave's current approach is correct** - spawning the CLI is the officially supported way to use Max subscriptions programmatically

2. **The Agent SDK cannot use subscriptions** - this is an explicit Anthropic policy, not a bug

3. **Improvements are possible** - better error handling, structured output parsing, and rate limit awareness would enhance the UX

4. **No magic workaround exists** - OAuth tokens are server-side locked to approved clients

---

## Sources

- [Using Claude Code with Pro/Max Plan](https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan)
- [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [SDK OAuth Token Discussion - GitHub Issue #6536](https://github.com/anthropics/claude-code/issues/6536)
- [Documentation Inconsistency - GitHub Issue #5891](https://github.com/anthropics/claude-code/issues/5891)
- [Roo Code Claude Code Provider Docs](https://docs.roocode.com/providers/claude-code)
- [AI SDK Provider for Claude Code](https://github.com/ben-vargas/ai-sdk-provider-claude-code)
- [claude-max-access-sdk Investigation](https://github.com/parkertoddbrooks/claude-max-access-sdk)
- [Claude Code Identity and Access Management](https://code.claude.com/docs/en/iam)
