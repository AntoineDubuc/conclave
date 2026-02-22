# Implementation Plan: Fix Invalid Model IDs

---

## Executive Summary

The model registry (`lib/models/index.ts`) and legacy mapping (`lib/flows/config.ts`) contain 10 invalid or incompatible model IDs across Anthropic, OpenAI, and OpenRouter providers. These cause flow execution failures — users select a model, click Run, and get errors or hangs instead of results. This plan fixes all invalid IDs with verified replacements.

**Key Outcomes:**
- All model IDs in the registry resolve to working API endpoints
- End-to-end flow execution succeeds with Anthropic + OpenAI models
- Free-tier and open-source models point to valid OpenRouter endpoints
- Legacy `"claude"` shorthand maps to a working model

---

## Project Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| `{EVIDENCE_ROOT}` | `__QA__/invalid-anthropic-model-ids/evidence` | Root directory for all evidence artifacts |
| `{STATIC_ANALYSIS_CMD}` | `cd conclave-app && npx next lint` | ESLint for Next.js |
| `{DEV_SERVER_CMD}` | `cd conclave-app && npm run dev` | Start on port 4100 |
| `{TEST_CMD}` | `cd conclave-app && npx tsc --noEmit` | TypeScript type check (no test suite exists) |
| `{RUNTIME_LOGS_CMD}` | `Playwright console listener + executor API logs` | Runtime error capture |
| `{BUILD_CMD}` | `cd conclave-app && npx next build` | Production build |
| `{VERIFICATION_AGENT}` | `Playwright Node.js scripts + curl` | Headless browser + direct API calls |
| `{SCREENSHOT_TOOL}` | `npx playwright screenshot` | Playwright CLI |
| `{MAX_RETRIES}` | `3` | Max verification failures before escalating |

---

## Product Manager Review

### Feature Overview

This is a bug fix, not a feature. Users cannot run flows with certain Anthropic, OpenAI, or OpenRouter models because the model IDs in the registry don't match what the provider APIs accept.

### Bug 1: Anthropic Model IDs Return 404

**What it is:** Two Anthropic model IDs (`claude-sonnet-4-5-20250514` and `claude-haiku-4-5-20250514`) don't exist in the Anthropic API.

**Why it matters:** Users selecting Sonnet 4.5 or Haiku 4.5 in the model picker get flow execution failures. The legacy `"claude"` shorthand is also broken.

**User perspective:** User picks Anthropic models, enters a task, clicks Run Flow. Execution hangs or shows partial failure. User has no idea why.

### Bug 2: OpenAI Models Require Different Endpoint

**What it is:** Three OpenAI models (`gpt-5.2-pro`, `gpt-5-pro`, `gpt-5-codex`) require the v1/responses API endpoint, but the executor only supports v1/chat/completions.

**Why it matters:** Users selecting these models get execution errors.

**User perspective:** Same as Bug 1 — user picks a model, runs flow, gets an error.

### Bug 3: OpenRouter Models Removed from Platform

**What it is:** Four OpenRouter model IDs no longer exist on the platform (deprecated or renamed).

**Why it matters:** Users selecting these open-source models get "No endpoints found" errors.

**User perspective:** Free-tier models don't work at all.

---

## Pre-Flight Readiness

- [ ] **Dependencies installed** — `npm run build` succeeds in conclave-app/
- [ ] **Environment configured** — `.env.local` has API keys for Anthropic, OpenAI, Google, OpenRouter
- [ ] **Dev server starts** — `npm run dev` on port 4100
- [ ] **Static analysis baseline** — `npx next lint` passes
- [ ] **Test suite baseline** — `npx tsc --noEmit` passes
- [ ] **Evidence directory exists** — `__QA__/invalid-anthropic-model-ids/evidence/assets/` created
- [ ] **Mock/seed data ready** — Test user `test@conclave.dev` exists in local Supabase
- [ ] **Git branch created** — Working on correct branch

---

## Plan Review — 7-Pass Process

> Passes 1-3 (Elderly User, Family Caregiver, Nurse) are **N/A** for Conclave — this is a developer-facing multi-LLM platform, not a healthcare application. Passes 4-7 apply.

### Pass 1-3 — N/A (Conclave is not a healthcare product)

**Verdict: N/A — Skip to Pass 4.**

---

### Pass 4 — Senior Engineer

#### 4.1 File Path Verification

| # | Plan Reference | Actual | Verdict |
|---|---------------|--------|---------|
| 1 | `conclave-app/lib/models/index.ts` | Exists, 845 lines | CONFIRMED |
| 2 | `conclave-app/lib/flows/config.ts` | Exists, 449 lines | CONFIRMED |

#### 4.2 Line Number Verification

| # | File | Lines | BEFORE (plan) | Actual | Verdict |
|---|------|-------|---------------|--------|---------|
| 1 | models/index.ts | 92-96 | `FREE_MODEL_IDS` with 3 entries | Matches | CONFIRMED |
| 2 | models/index.ts | 191-201 | Opus 4.5 entry with `isBest: true` | Matches | CONFIRMED |
| 3 | models/index.ts | 202-211 | Sonnet 4.5 with `claude-sonnet-4-5-20250514` | Matches | CONFIRMED |
| 4 | models/index.ts | 212-221 | Haiku 4.5 with `claude-haiku-4-5-20250514` | Matches | CONFIRMED |
| 5 | models/index.ts | 247-257 | GPT-5.2 Pro with `isBest: true` | Matches | CONFIRMED |
| 6 | models/index.ts | 268-277 | GPT-5 Pro | Matches | CONFIRMED |
| 7 | models/index.ts | 298-307 | GPT-5 Codex | Matches | CONFIRMED |
| 8 | models/index.ts | 510-522 | DeepSeek R1 Free with `deepseek/deepseek-r1:free` | Matches | CONFIRMED |
| 9 | models/index.ts | 553-565 | Llama 4 Scout Free with `meta-llama/llama-4-scout:free` | Matches | CONFIRMED |
| 10 | models/index.ts | 596-608 | Codestral 2501 with `mistralai/codestral-2501` | Matches | CONFIRMED |
| 11 | models/index.ts | 671-686 | NVIDIA Nemotron with `nvidia/llama-3.1-nemotron-70b-instruct:free` | Matches | CONFIRMED |
| 12 | config.ts | 94-99 | Legacy `claude` mapping to `claude-sonnet-4-5-20250514` | Matches | CONFIRMED |

#### 4.3 API Signature Verification

No new functions or endpoints are being added. Only data changes (model ID strings, pricing numbers).

#### 4.4 Import Path Verification

No new imports are being added.

#### 4.5 Verdict

**PASS:** All file paths, line numbers, and BEFORE blocks verified.

---

### Pass 5 — Integration Architect

#### 5.1 Shared File Conflicts

| File | Tasks That Touch It | Lines Modified | Compatible? |
|------|---------------------|----------------|-------------|
| `models/index.ts` | Task 1 (Anthropic), Task 2 (OpenAI), Task 3 (OpenRouter) | Task 1: 190-244, Task 2: 247-307, Task 3: 510-686 | YES — completely different sections |
| `config.ts` | Task 4 (legacy mapping) | 94-99 only | YES — no other task touches this file |

#### 5.2 Cross-Plan Dependencies

No cross-task dependencies. All tasks modify independent sections.

#### 5.3 Shared Data Contracts

The `ModelInfo` interface is unchanged. Only the values within existing fields change.

`FREE_MODEL_IDS` array (line 92-96) references model `id` fields that change in Task 3. Task 3 must update both the model entry AND the `FREE_MODEL_IDS` array consistently.

#### 5.4 Import Collision Check

No imports are being added or modified.

#### 5.5 Verdict

**PASS:** No conflicts. Tasks can be implemented in any order.

---

### Pass 6 — Demo Director

N/A — no demo script for a bug fix. Verification is via direct API testing and flow execution.

---

### Pass 7 — Pre-Flight Director

#### 7.1 Backend Deploy Required?

NO. All changes are in the Next.js frontend. The Executor API and Agent Service are unchanged.

#### 7.2 Build Order

| Order | Task | Files Modified | Verify After |
|-------|------|----------------|--------------|
| 1 | Fix Anthropic model IDs | `models/index.ts` lines 190-244 | `npx tsc --noEmit` |
| 2 | Fix OpenAI model entries | `models/index.ts` lines 247-307 | `npx tsc --noEmit` |
| 3 | Fix OpenRouter model IDs + FREE_MODEL_IDS | `models/index.ts` lines 92-96, 510-686 | `npx tsc --noEmit` |
| 4 | Fix legacy mapping | `config.ts` lines 94-99 | `npx tsc --noEmit` |
| 5 | End-to-end verification | None (testing only) | Flow execution via curl + Playwright |

#### 7.3 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Model ID typo in replacement | Low | High — flow execution fails | Every replacement was tested against live API |
| Breaking model picker UI | Low | Medium — models don't appear | TypeScript compiler catches missing fields |
| Other code references old model IDs by string | Low | Low — only affects edge cases | Grep for old IDs after changes |

#### 7.4 Rollback Plan

Revert two files: `models/index.ts` and `config.ts`. No database or backend changes to undo.

```bash
git checkout HEAD -- conclave-app/lib/models/index.ts conclave-app/lib/flows/config.ts
```

#### 7.5 Go / No-Go Checklist

- [x] All plans passed Passes 4-5.
- [x] Build order verified (no circular dependencies).
- [x] Backend deploy NOT required.
- [x] Rollback plan exists (revert 2 files).

#### 7.6 Verdict

**GO:** Cleared for implementation.

---

## Master Checklist

### Progress Dashboard

| Done | # | Task Name | Risk | Start | End | Total (min) | Human Est. (min) | Multiplier | Status | Attempts | Evidence | Blocker |
|:----:|:-:|-----------|:----:|:-----:|:---:|:-----------:|:----------------:|:----------:|:------:|:--------:|:--------:|:-------:|
| ⬜ | 1 | Implement: Fix Anthropic model IDs | L | | | | 15 | | pending | — | — | |
| ⬜ | 1v | Verify: Fix Anthropic model IDs | | | | | 10 | | pending | 0 | | |
| ⬜ | 2 | Implement: Fix OpenAI model entries | L | | | | 10 | | pending | — | — | |
| ⬜ | 2v | Verify: Fix OpenAI model entries | | | | | 10 | | pending | 0 | | |
| ⬜ | 3 | Implement: Fix OpenRouter model IDs | L | | | | 15 | | pending | — | — | |
| ⬜ | 3v | Verify: Fix OpenRouter model IDs | | | | | 10 | | pending | 0 | | |
| ⬜ | 4 | Implement: Fix legacy mapping | L | | | | 5 | | pending | — | — | |
| ⬜ | 4v | Verify: Fix legacy mapping | | | | | 5 | | pending | 0 | | |
| ⬜ | 5 | Implement: End-to-end flow test | M | | | | 20 | | pending | — | — | |
| ⬜ | 5v | Verify: End-to-end flow test | | | | | 15 | | pending | 0 | | |

**Summary:**
- Total tasks: 5 (implementation) + 5 (verification) = 10 total
- Completed: 0
- Total human estimate: 115 minutes

---

## Task Descriptions

---

### Task 1: Fix Anthropic Model IDs

**Risk:** L

**Intent:** Replace the 2 invalid Anthropic model IDs with verified working ones, and add the latest Claude 4.6 generation models.

**Context:** `claude-sonnet-4-5-20250514` returns 404 (model never existed), `claude-haiku-4-5-20250514` returns 404 (wrong date). Confirmed via direct Anthropic API testing.

**Expected behavior:** All Anthropic models in the picker should resolve to valid API model IDs when sent to the executor.

**Key components:**
- `conclave-app/lib/models/index.ts` — ANTHROPIC_MODELS array (lines 190-244)

**Changes:**

**Change 1a: Replace Sonnet 4.5 entry with Sonnet 4.6 (lines 202-211)**

BEFORE:
```typescript
  {
    id: "claude-sonnet-4-5-20250514",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    inputPrice: 3.0,
    outputPrice: 15.0,
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    description: "Best for agentic workflows",
  },
```

AFTER:
```typescript
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    inputPrice: 3.0,
    outputPrice: 15.0,
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    description: "Best for agentic workflows",
  },
```

**Change 1b: Fix Haiku 4.5 date (lines 212-221)**

BEFORE:
```typescript
  {
    id: "claude-haiku-4-5-20250514",
    name: "Claude Haiku 4.5",
```

AFTER:
```typescript
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
```

**Change 1c: Add Claude Opus 4.6 as new best model, demote Opus 4.5**

BEFORE (lines 190-201):
```typescript
export const ANTHROPIC_MODELS: ModelInfo[] = [
  {
    id: "claude-opus-4-5-20251101",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    inputPrice: 5.0,
    outputPrice: 25.0,
    contextWindow: 200_000,
    maxOutput: 32_000,
    isBest: true,
    description: "Frontier reasoning, most capable",
  },
```

AFTER:
```typescript
export const ANTHROPIC_MODELS: ModelInfo[] = [
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    inputPrice: 5.0,
    outputPrice: 25.0,
    contextWindow: 200_000,
    maxOutput: 32_000,
    isBest: true,
    description: "Newest flagship, most capable",
  },
  {
    id: "claude-opus-4-5-20251101",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    inputPrice: 5.0,
    outputPrice: 25.0,
    contextWindow: 200_000,
    maxOutput: 32_000,
    description: "Frontier reasoning",
  },
```

**Acceptance criteria:**
- [ ] `claude-sonnet-4-5-20250514` no longer appears anywhere in the file
- [ ] `claude-haiku-4-5-20250514` no longer appears anywhere in the file
- [ ] `claude-sonnet-4-6` entry exists with correct pricing ($3/$15)
- [ ] `claude-haiku-4-5-20251001` entry exists with correct pricing ($1/$5)
- [ ] `claude-opus-4-6` entry exists as first in array with `isBest: true`
- [ ] `claude-opus-4-5-20251101` entry still exists but without `isBest`
- [ ] TypeScript compiles: `npx tsc --noEmit` passes

**Negative tests:**
- [ ] Grep for `claude-sonnet-4-5-20250514` returns 0 results across entire codebase
- [ ] Grep for `claude-haiku-4-5-20250514` returns 0 results across entire codebase

**Evidence requirements:**
- [ ] Static analysis output with 0 errors
- [ ] TypeScript compilation passes
- [ ] grep output showing old IDs are gone

**Rollback plan:** `git checkout HEAD -- conclave-app/lib/models/index.ts`

---

### Task 2: Fix OpenAI Model Entries

**Risk:** L

**Intent:** Mark or flag the 3 OpenAI models that only work on v1/responses (not supported by executor) so users don't select them and hit confusing errors.

**Context:** `gpt-5.2-pro`, `gpt-5-pro`, `gpt-5-codex` require OpenAI's v1/responses endpoint. The executor only supports v1/chat/completions. Selecting these causes execution errors.

**Expected behavior:** These models should be marked as unsupported/incompatible so the model picker either hides them or shows a warning. The simplest approach: add `isLegacy: true` so they're deprioritized, and add a description noting the limitation.

**Key components:**
- `conclave-app/lib/models/index.ts` — OPENAI_MODELS array (lines 246-378)

**Changes:**

**Change 2a: Mark gpt-5.2-pro (lines 247-257)**

BEFORE:
```typescript
  {
    id: "gpt-5.2-pro",
    name: "GPT-5.2 Pro",
    provider: "openai",
    inputPrice: 21.0,
    outputPrice: 168.0,
    contextWindow: 400_000,
    maxOutput: 128_000,
    isBest: true,
    description: "Most powerful, extended thinking",
  },
```

AFTER:
```typescript
  {
    id: "gpt-5.2",
    name: "GPT-5.2",
    provider: "openai",
    inputPrice: 1.75,
    outputPrice: 14.0,
    contextWindow: 400_000,
    maxOutput: 128_000,
    isBest: true,
    description: "Flagship reasoning model",
  },
```

Note: We move `isBest: true` to GPT-5.2 (which works) and remove the gpt-5.2-pro entry entirely. Same for gpt-5-pro and gpt-5-codex.

**Change 2b: Remove gpt-5.2-pro, gpt-5-pro, gpt-5-codex entries**

Remove these 3 entries entirely:
- Lines 247-257 (`gpt-5.2-pro`)
- Lines 268-277 (`gpt-5-pro`)
- Lines 298-307 (`gpt-5-codex`)

And move `isBest: true` to the `gpt-5.2` entry (lines 258-267).

**Acceptance criteria:**
- [ ] `gpt-5.2-pro` entry removed from OPENAI_MODELS
- [ ] `gpt-5-pro` entry removed from OPENAI_MODELS
- [ ] `gpt-5-codex` entry removed from OPENAI_MODELS
- [ ] `gpt-5.2` entry has `isBest: true`
- [ ] Remaining OpenAI models unchanged (gpt-5.2, gpt-5.1, gpt-5, gpt-5-mini, gpt-5-nano, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, o3, o4-mini)
- [ ] TypeScript compiles: `npx tsc --noEmit` passes

**Negative tests:**
- [ ] Grep for `gpt-5.2-pro` returns 0 results in models/index.ts
- [ ] Grep for `gpt-5-codex` returns 0 results in models/index.ts

**Evidence requirements:**
- [ ] Static analysis output with 0 errors
- [ ] TypeScript compilation passes

**Rollback plan:** `git checkout HEAD -- conclave-app/lib/models/index.ts`

---

### Task 3: Fix OpenRouter Model IDs

**Risk:** L

**Intent:** Replace 4 invalid OpenRouter model IDs with verified working alternatives, and update the FREE_MODEL_IDS array.

**Context:** These models were removed or renamed on OpenRouter. Confirmed via live API testing.

**Key components:**
- `conclave-app/lib/models/index.ts` — DeepSeek, Meta, Mistral, NVIDIA arrays + FREE_MODEL_IDS

**Changes:**

**Change 3a: Fix DeepSeek R1 Free openRouterId (line 521)**

BEFORE:
```typescript
    openRouterId: "deepseek/deepseek-r1:free",
```

AFTER:
```typescript
    openRouterId: "deepseek/deepseek-r1-0528:free",
```

**Change 3b: Remove Meta Llama 4 Scout Free entry (lines 553-565)**

Remove the entire entry:
```typescript
  {
    id: "llama-4-scout-free",
    name: "Llama 4 Scout Free",
    ...
    openRouterId: "meta-llama/llama-4-scout:free",
  },
```

No free Meta model is available on OpenRouter.

**Change 3c: Fix Codestral openRouterId (line 607)**

BEFORE:
```typescript
    openRouterId: "mistralai/codestral-2501",
```

AFTER:
```typescript
    openRouterId: "mistralai/codestral-2508",
```

Also update the entry's id and name to reflect the new version:

BEFORE:
```typescript
    id: "codestral-2501",
    name: "Codestral 2501",
```

AFTER:
```typescript
    id: "codestral-2508",
    name: "Codestral 2508",
```

**Change 3d: Fix NVIDIA Nemotron openRouterId (line 684)**

BEFORE:
```typescript
    openRouterId: "nvidia/llama-3.1-nemotron-70b-instruct:free",
```

AFTER:
```typescript
    openRouterId: "nvidia/nemotron-3-nano-30b-a3b:free",
```

Also update the entry to reflect the actual model:

BEFORE:
```typescript
    id: "nemotron-70b-free",
    name: "NVIDIA Nemotron 70B",
    ...
    contextWindow: 131_000,
    maxOutput: 4_096,
    ...
    description: "Free tier, RLHF-tuned",
```

AFTER:
```typescript
    id: "nemotron-30b-free",
    name: "NVIDIA Nemotron 30B",
    ...
    contextWindow: 131_000,
    maxOutput: 4_096,
    ...
    description: "Free tier, 30B MoE",
```

**Change 3e: Update FREE_MODEL_IDS (lines 92-96)**

BEFORE:
```typescript
export const FREE_MODEL_IDS: string[] = [
  "deepseek-r1-free",
  "llama-4-scout-free",
  "nemotron-70b-free",
];
```

AFTER:
```typescript
export const FREE_MODEL_IDS: string[] = [
  "deepseek-r1-free",
  "nemotron-30b-free",
];
```

(Remove `llama-4-scout-free` since that entry is removed. Update `nemotron-70b-free` → `nemotron-30b-free`.)

**Acceptance criteria:**
- [ ] `deepseek/deepseek-r1:free` no longer appears in the file
- [ ] `meta-llama/llama-4-scout:free` no longer appears in the file
- [ ] `mistralai/codestral-2501` no longer appears in the file
- [ ] `nvidia/llama-3.1-nemotron-70b-instruct:free` no longer appears in the file
- [ ] `FREE_MODEL_IDS` matches the actual free model entry IDs
- [ ] TypeScript compiles: `npx tsc --noEmit` passes

**Negative tests:**
- [ ] Grep for old OpenRouter IDs returns 0 results
- [ ] No entry in FREE_MODEL_IDS references a nonexistent model entry

**Evidence requirements:**
- [ ] Static analysis output
- [ ] TypeScript compilation passes

**Rollback plan:** `git checkout HEAD -- conclave-app/lib/models/index.ts`

---

### Task 4: Fix Legacy Mapping

**Risk:** L

**Intent:** Update the legacy `"claude"` shorthand to point to a working model.

**Context:** The legacy mapping is used when old-style model IDs (e.g., `"claude"`, `"gpt4"`) are referenced. Currently `"claude"` maps to the non-existent `claude-sonnet-4-5-20250514`.

**Key components:**
- `conclave-app/lib/flows/config.ts` — LEGACY_MODEL_MAPPING (lines 94-115)

**Changes:**

BEFORE (lines 95-99):
```typescript
  claude: {
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250514",
    displayName: "Claude Sonnet 4.5",
  },
```

AFTER:
```typescript
  claude: {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
  },
```

**Acceptance criteria:**
- [ ] `claude-sonnet-4-5-20250514` no longer appears in config.ts
- [ ] Legacy `"claude"` maps to `claude-sonnet-4-6`
- [ ] TypeScript compiles: `npx tsc --noEmit` passes

**Negative tests:**
- [ ] Grep for `claude-sonnet-4-5-20250514` returns 0 results across entire codebase

**Evidence requirements:**
- [ ] TypeScript compilation passes
- [ ] grep output confirming old ID is gone from entire codebase

**Rollback plan:** `git checkout HEAD -- conclave-app/lib/flows/config.ts`

---

### Task 5: End-to-End Flow Verification

**Risk:** M

**Intent:** Verify that a flow using Anthropic + OpenAI models executes successfully through the full stack (UI → Next.js route → Executor API → LLM APIs → results displayed).

**Context:** This is the test that originally revealed the bug. After fixing all model IDs, this must pass.

**Key components:**
- Executor API at port 8553
- Next.js API route `/api/flows/execute`
- Flow wizard UI at `/flows/new`

**Test approach:**

**Test 5a: Direct executor test with curl**
```bash
curl -X POST http://localhost:8553/execute \
  -H "Content-Type: application/json" \
  -d '{
    "flow_config": {
      "version": "2.0",
      "name": "Verification Test",
      "participants": [
        {"id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6", "provider": "anthropic", "model": "claude-sonnet-4-6"},
        {"id": "gpt-5.2", "name": "GPT-5.2", "provider": "openai", "model": "gpt-5.2"}
      ],
      "phases": [
        {"name": "Initial", "type": "parallel", "executors": ["claude-sonnet-4-6", "gpt-5.2"], "prompt": "{{task}}"}
      ]
    },
    "task_prompt": "In one sentence, what is the capital of France?",
    "api_keys": { "anthropic": "<from .env.local>", "openai": "<from .env.local>" }
  }'
```

Expected: Both models return valid text output, no errors.

**Test 5b: Playwright full wizard flow**
Navigate: login → /flows/new → Use Existing → Round-Robin → select Anthropic + OpenAI → enter task → Run Flow → verify results appear.

**Acceptance criteria:**
- [ ] Direct curl to executor returns `"status": "complete"` with output from both models
- [ ] Claude Sonnet 4.6 output is non-empty and relevant
- [ ] GPT-5.2 output is non-empty and relevant
- [ ] No 404 errors in executor response
- [ ] Playwright wizard test reaches results display (or confirms execution started)

**Negative tests:**
- [ ] Executor test with old `claude-sonnet-4-5-20250514` still returns 404 (proves old ID was the problem)

**Evidence requirements:**
- [ ] curl output showing complete execution with both model outputs
- [ ] Playwright console log showing successful flow execution

**Rollback plan:** N/A — this task only runs tests, doesn't modify code.

---

## Appendix

### Technical Decisions

1. **Replace Sonnet 4.5 with Sonnet 4.6 (not Sonnet 4):** Sonnet 4.6 is the current generation at the same price point. Sonnet 4 would be a downgrade.
2. **Remove OpenAI v1/responses models instead of adding v1/responses support:** Adding a second API endpoint to the executor is a significant architecture change. Out of scope for this bug fix.
3. **Remove Meta free model instead of finding alternative:** No free Llama 4 model exists on OpenRouter. Adding a completely different model would be misleading.
4. **NVIDIA replacement is 30B not 70B:** The only free NVIDIA model on OpenRouter is the 30B Nemotron. The 70B model exists but is paid. Accepting the size difference to maintain a free option.

### Out of Scope

- Adding v1/responses endpoint support to the executor (needed for gpt-5.2-pro, gpt-5-pro, gpt-5-codex)
- Validating xAI/Grok model IDs (no API key available)
- Updating model pricing across all providers (only Anthropic pricing was verified)
- Adding new models beyond what's needed to fix broken IDs

### Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2026-02-21 | Initial plan based on research findings |
