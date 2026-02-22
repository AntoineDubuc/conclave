# Research: Invalid Model IDs Across All Providers

## Problem Statement

Multiple model IDs in the app's model registry (`lib/models/index.ts`) and legacy mapping (`lib/flows/config.ts`) are invalid, causing flow execution failures when users select those models.

The initial discovery was Anthropic models failing with 404, but investigation revealed issues across Anthropic, OpenAI, and OpenRouter providers.

---

## Complete Validation Results

### Anthropic — 2 broken, 3 valid, 2 missing latest models

| Registry ID | API Result | Issue |
|---|---|---|
| `claude-opus-4-5-20251101` | 200 OK | VALID |
| `claude-sonnet-4-5-20250514` | **404 Not Found** | Model doesn't exist. No "Sonnet 4.5" was ever released. |
| `claude-haiku-4-5-20250514` | **404 Not Found** | Wrong date suffix. Correct: `claude-haiku-4-5-20251001` |
| `claude-opus-4-20250514` | 200 OK | VALID (legacy) |
| `claude-sonnet-4-20250514` | 200 OK | VALID (legacy) |

**Missing from registry (latest generation, confirmed valid):**
| Model ID | Name | Pricing (input/output per MTok) |
|---|---|---|
| `claude-opus-4-6` | Claude Opus 4.6 | $5 / $25 |
| `claude-sonnet-4-6` | Claude Sonnet 4.6 | $3 / $15 |

Sources: [Anthropic Pricing Docs](https://platform.claude.com/docs/en/about-claude/pricing), [MetaCTO Pricing Breakdown](https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration)

### OpenAI — 3 incompatible (v1/responses only), all others valid

| Registry ID | API Result | Issue |
|---|---|---|
| `gpt-5.2-pro` | **v1/responses only** | Not supported on v1/chat/completions (executor's endpoint) |
| `gpt-5-pro` | **v1/responses only** | Same issue |
| `gpt-5-codex` | **v1/responses only** | Same issue |
| `gpt-5.2` | 200 OK | VALID (uses `max_completion_tokens`) |
| `gpt-5.1` | 200 OK | VALID |
| `gpt-5` | 200 OK | VALID |
| `gpt-5-mini` | 200 OK | VALID |
| `gpt-5-nano` | 200 OK | VALID |
| `gpt-4.1` | 200 OK | VALID |
| `gpt-4.1-mini` | 200 OK | VALID |
| `gpt-4.1-nano` | 200 OK | VALID |
| `o3` | 200 OK | VALID (uses `max_completion_tokens`) |
| `o4-mini` | 200 OK | VALID |

**Note:** The executor already handles `max_completion_tokens` vs `max_tokens` correctly (see `_uses_max_completion_tokens()` in `src/lib/executor.py`). The v1/responses issue is a separate, deeper problem — the executor only supports v1/chat/completions.

### Google Gemini — All 5 valid

| Registry ID | API Result |
|---|---|
| `gemini-3-pro-preview` | 200 OK (in API model list, confirmed) |
| `gemini-3-flash-preview` | 200 OK (in API model list, confirmed) |
| `gemini-2.5-pro` | 200 OK |
| `gemini-2.5-flash` | 200 OK |
| `gemini-2.5-flash-lite` | 200 OK (listed as `gemini-2.5-flash-lite` in API) |

### xAI/Grok — UNTESTABLE

`XAI_API_KEY=""` in `.env.local`. Cannot validate. Model IDs assumed correct but unverified:
- `grok-3`, `grok-3-fast`, `grok-3-mini`, `grok-3-mini-fast`

### OpenRouter (Open Source Providers) — 4 broken, 10 valid

| Registry ID (openRouterId) | API Result | Issue | Replacement |
|---|---|---|---|
| `deepseek/deepseek-r1` | 200 OK | VALID | — |
| `deepseek/deepseek-chat` | 200 OK | VALID | — |
| `deepseek/deepseek-r1:free` | **No endpoints found** | Removed from OpenRouter | `deepseek/deepseek-r1-0528:free` (HTTP 200) |
| `meta-llama/llama-4-scout` | 200 OK | VALID | — |
| `meta-llama/llama-4-maverick` | 200 OK | VALID | — |
| `meta-llama/llama-4-scout:free` | **No endpoints found** | No free variant available | None — remove or find alternative |
| `mistralai/mistral-large-2411` | 200 OK | VALID | — |
| `mistralai/mistral-small-3.1-24b-instruct` | 200 OK | VALID | — |
| `mistralai/codestral-2501` | **No endpoints found** | Replaced on OpenRouter | `mistralai/codestral-2508` (confirmed OK) |
| `qwen/qwen3-235b-a22b` | 200 OK | VALID | — |
| `qwen/qwen3-32b` | 200 OK | VALID | — |
| `qwen/qwq-32b` | 200 OK | VALID | — |
| `microsoft/phi-4` | 200 OK | VALID | — |
| `nvidia/llama-3.1-nemotron-70b-instruct:free` | **No endpoints found** | Removed from OpenRouter | `nvidia/nemotron-3-nano-30b-a3b:free` (confirmed OK) |

### Legacy Mapping (config.ts line 94-99)

`"claude"` → `claude-sonnet-4-5-20250514` — **BROKEN** (points to non-existent model)

---

## Files Requiring Changes

### 1. `conclave-app/lib/models/index.ts`

**Anthropic models (lines 190-244):**
- Replace `claude-sonnet-4-5-20250514` → valid replacement (see Q1 below)
- Replace `claude-haiku-4-5-20250514` → `claude-haiku-4-5-20251001`
- Add Claude Opus 4.6 and Sonnet 4.6 entries (see Q2 below)
- Mark or remove `gpt-5.2-pro`, `gpt-5-pro`, `gpt-5-codex` (see Q3 below)

**OpenRouter models (lines 482-686):**
- Replace `deepseek/deepseek-r1:free` → `deepseek/deepseek-r1-0528:free`
- Handle `meta-llama/llama-4-scout:free` removal (no replacement)
- Replace `mistralai/codestral-2501` → `mistralai/codestral-2508`
- Replace `nvidia/llama-3.1-nemotron-70b-instruct:free` → `nvidia/nemotron-3-nano-30b-a3b:free`

### 2. `conclave-app/lib/flows/config.ts`

**Legacy mapping (line 94-99):**
- Replace `claude-sonnet-4-5-20250514` → valid model ID

---

## Resolved Questions

### Q1: What should replace `claude-sonnet-4-5-20250514`?

**Recommended: `claude-sonnet-4-6`** (Claude Sonnet 4.6)
- This is the current latest Sonnet model, confirmed valid via API
- Same pricing as the intended Sonnet 4.5 would have had ($3/$15 per MTok)
- Since Sonnet 4.5 never existed, the next valid Sonnet after 4 is 4.6

Alternatives considered:
- `claude-sonnet-4-20250514` (Sonnet 4, legacy) — downgrade from what was intended
- Remove entry entirely — reduces options for users

### Q2: Should we add Claude Opus 4.6 and Sonnet 4.6 as new entries?

**Recommended: Yes** — replace the "4.5" entries with "4.6" equivalents
- Opus 4.6: `claude-opus-4-6`, $5/$25 per MTok (same price as Opus 4.5)
- Sonnet 4.6: `claude-sonnet-4-6`, $3/$15 per MTok
- Mark the current Opus 4.5 as legacy, make Opus 4.6 the new `isBest`

Alternatives considered:
- Keep Opus 4.5 as best — it works, but 4.6 is newer and same price
- Add 4.6 without marking 4.5 as legacy — clutters the model picker

### Q3: What to do about OpenAI v1/responses-only models?

**Recommended: Mark as unsupported/remove from picker for now**
- `gpt-5.2-pro`, `gpt-5-pro`, `gpt-5-codex` require the v1/responses endpoint
- The executor only supports v1/chat/completions
- Adding v1/responses support is a larger architecture change (separate task)
- Users selecting these will get confusing errors

Alternatives considered:
- Add v1/responses support to executor — significant work, separate scope
- Keep them but add a "requires v1/responses" warning — confusing UX

### Q4: Legacy mapping — what should `"claude"` default to?

**Recommended: `claude-sonnet-4-6`** — standard workhorse tier, same as how GPT-5.2 (not Pro) is the default OpenAI model. Sonnet is the balanced choice between capability and cost.

---

## Summary of All Invalid IDs

| Provider | Invalid ID | Replacement | Verified |
|---|---|---|---|
| Anthropic | `claude-sonnet-4-5-20250514` | `claude-sonnet-4-6` | Yes (API 200) |
| Anthropic | `claude-haiku-4-5-20250514` | `claude-haiku-4-5-20251001` | Yes (API 200) |
| OpenAI | `gpt-5.2-pro` | Remove/mark unsupported | Yes (v1/responses only) |
| OpenAI | `gpt-5-pro` | Remove/mark unsupported | Yes (v1/responses only) |
| OpenAI | `gpt-5-codex` | Remove/mark unsupported | Yes (v1/responses only) |
| OpenRouter | `deepseek/deepseek-r1:free` | `deepseek/deepseek-r1-0528:free` | Yes (HTTP 200) |
| OpenRouter | `meta-llama/llama-4-scout:free` | Remove (no replacement) | Yes (confirmed absent) |
| OpenRouter | `mistralai/codestral-2501` | `mistralai/codestral-2508` | Yes (confirmed OK) |
| OpenRouter | `nvidia/llama-3.1-nemotron-70b-instruct:free` | `nvidia/nemotron-3-nano-30b-a3b:free` | Yes (confirmed OK) |
| Config.ts | `"claude"` → `claude-sonnet-4-5-20250514` | → `claude-sonnet-4-6` | Yes |

**Total: 10 invalid/incompatible model IDs across 3 providers + 1 legacy mapping.**

---

## Remaining Unknowns

1. **xAI/Grok models** — No API key to test with. Cannot verify `grok-3`, `grok-3-fast`, `grok-3-mini`, `grok-3-mini-fast`.
2. **NVIDIA free model naming** — `nvidia/nemotron-3-nano-30b-a3b:free` is a different model than the original `nvidia/llama-3.1-nemotron-70b-instruct` (30B vs 70B, different architecture). Need to decide if this is an acceptable replacement or if we should use a different NVIDIA model.
3. **Meta free tier** — No free Llama 4 model on OpenRouter. Options: remove the free entry, or find an alternative free Meta model.

---

## Ready for Implementation Plan?

**All critical assumptions are verified.** The remaining unknowns (Grok, NVIDIA model size, Meta free tier) are edge cases that can be noted in the plan as decisions.

Next step: Create implementation plan using v4 template after user approval of the approach.
