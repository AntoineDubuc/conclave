```md
# v2.md — AI SDLC Consultant Chat Flow (≤2 minutes, lead-gen focused)

**Goal:** Qualify + recommend an MVP path for an AI-powered code review tool (CLI / GitHub Actions) in <2 minutes.  
**Design upgrades from peer feedback:** fewer questions, clearer intro, add team size + CI/CD maturity + AI adoption, add “agentic” option, include progress indicator + skip, and explicit lead scoring hooks.

---

## 0) Opening (set context + timebox)
**Bot:**  
“Hi—I'll help you pressure-test an **AI-powered code review tool** (PR comments, quality/security gates, or even auto-fixes).  
This takes ~90 seconds. **Q1 of 7**.”

Buttons: **Start** / **Not now**

---

## 1) Team & scale (ICP + sizing)
**Q1 of 7 — Team size?**  
A) 1–10 devs  
B) 11–50  
C) 51–200  
D) 200+

**Q2 of 7 — PR volume?**  
A) <20/day  
B) 20–100/day  
C) 100+/day  
D) Not sure

*(Skip available: “Not sure”)*

---

## 2) Pain + current maturity (where AI helps most)
**Q3 of 7 — Biggest bottleneck today?**  
A) PR review takes too long  
B) Bugs reach production  
C) Security vulns slip through  
D) Inconsistent code quality/standards

**Q4 of 7 — CI/CD maturity?**  
A) No automation yet  
B) Basic CI (build/test)  
C) CI with some quality gates  
D) Advanced CI/CD (multiple integrations, policy gates)

**Q5 of 7 — Are you using AI coding tools already?**  
A) No  
B) Individual use (Copilot/ChatGPT)  
C) Team-wide usage  
D) Fully integrated workflow

---

## 3) Solution shape (architecture + enforcement)
**Q6 of 7 — Where should it run first?**  
A) GitHub Actions PR checks  
B) CLI locally (pre-commit/pre-push)  
C) Both  
D) Not sure

**Q7 of 7 — Strictness in the pipeline?**  
A) **Advisory Mode** (comments only)  
B) **Gatekeeper Mode** (block on high/critical security)  
C) **Quality Gates** (block on security + quality thresholds)  
D) **Agentic Mode** (propose fixes / open PR / optional auto-commit)

---

## Midpoint/End Recap (auto-generated)
**Bot (recap template):**  
“Recap: You’re a **{team_size}** team with **{pr_volume}** PRs/day. Your main pain is **{bottleneck}** with **{cicd_maturity}** pipelines and **{ai_adoption}** AI usage.  
You want the tool in **{runtime_target}** with **{strictness}** enforcement.”

**Bot (1-line recommendation snippet based on answers):**
- If (PR volume high + advanced CI/CD): “Start with **GitHub Actions + status checks** and tune thresholds to avoid false positives.”
- If (privacy-sensitive org implied later): “Consider **VPC/on-prem** inference or a **hybrid router**.”
- If (low maturity): “Start **advisory** + lightweight CLI to build trust before blocking merges.”

---

## Lead Capture (value exchange)
**Bot:**  
“I can generate a **1-page pilot plan** (architecture, rollout phases, KPIs, and effort estimate) tailored to your answers. Where should I send it?”

Options:  
- Email: `__________`  
- LinkedIn instead  
- Prefer not to share yet (show preview on-screen)

*(Add trust line: “No spam—just the plan.”)*

---

## Next Steps (choose one)
1) **Book a 15-min discovery call** (validate scope + success metrics)  
2) **Get the 1-page pilot plan only** (PDF/Doc)  
3) **Receive a sample GitHub Actions workflow + CLI skeleton**  
4) **Security/privacy checklist** (hosted vs VPC vs on-prem)

---

## Implementation Notes (to keep <2 minutes)
- Show **progress**: “Qx of 7” + allow **Not sure** on non-essential questions.
- Keep answers as **single-tap buttons** (mobile-friendly).
- Default to **short follow-ups only when needed** (e.g., if “Agentic Mode”, ask one clarifier: “Auto-commit allowed?” Yes/No).

---

## Lead Scoring Tags (for sales prioritization)
Assign points per answer (example):
- **Timeline urgency (implied):** Gatekeeper/Quality/Agentic +2; Advisory +0
- **Authority (optional add-on question if you can afford it):** Final decision maker +3; Influencer +2; Researcher +1
- **Scale:** PR volume 100+ +3; 20–100 +2
- **Maturity:** Advanced CI/CD +2 (faster adoption)
- **Pain:** Security +3; Review time +2

> Optional “authority/timeline” question can replace Q5 (AI adoption) if you want stricter BANT-style qualification.

---
```