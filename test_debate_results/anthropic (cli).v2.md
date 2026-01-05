# AI SDLC Consultant Chatbot Questions (v2)

## Opening
"Hi! I see you're exploring **AI-powered code review** for your development workflow. This is high-value territory—let's validate your approach in about 90 seconds and identify the best path forward."

- [A] Let's go
- [B] Give me a moment

---

## Question 1: Primary Goal
**"What's the #1 outcome you want from AI code review?"**

- A) Reduce PR review time significantly
- B) Catch security vulnerabilities pre-merge
- C) Improve code quality consistency
- D) All of the above

---

## Question 2: Integration Point
**"Where should this tool run first?"**

- A) GitHub Actions (PR checks)
- B) CLI locally (pre-commit/pre-push)
- C) Both GitHub + CLI
- D) Not sure yet—need guidance

---

## Question 3: Security & Privacy
**"What are your code privacy requirements?"**

- A) Can use hosted AI services (GPT-4, Claude API)
- B) Must stay in our cloud/VPC
- C) Fully on-prem only
- D) Need guidance on compliance options

---

## Question 4: Enforcement Level
**"How strict should the tool be initially?"**

- A) Advisory only (comments, no blocking)
- B) Block on high/critical security issues only
- C) Block on quality + security thresholds
- D) Unsure—recommend a phased rollout

---

## Midpoint Recap
*"Here's what I'm hearing: You want to [primary goal] with [integration approach], keeping code [privacy level], starting in [enforcement mode]. Let's confirm the business side."*

---

## Question 5: Team Scale
**"What's your PR volume and team size?"**

- A) Small team (<20 PRs/day)
- B) Mid-size (20-100 PRs/day)
- C) Large scale (100+ PRs/day)
- D) Not sure—exploring options

---

## Question 6: Timeline & Authority
**"When do you need this, and what's your role?"**

- A) Urgent (this month) — I'm the decision-maker
- B) This quarter — I influence the decision
- C) Next 6 months — I research and recommend
- D) Just exploring — individual contributor

---

## Question 7: Success Metric
**"What's the #1 metric you'll use to prove ROI?"**

- A) % reduction in review cycle time
- B) # of security issues caught pre-merge
- C) Developer adoption rate
- D) Cost savings on senior engineer reviews

---

## Email Capture
**"Based on your answers, I can generate a personalized Technical Roadmap with architecture recommendations, pilot strategy, and success metrics."**

**"Where should I send it?"**

📧 [Email input field]

*"No spam—just your custom assessment within 24 hours."*

---

## Next Steps Options
**"How would you like to proceed?"**

- A) **Book a 15-min Tech Audit** — Validate your LLM and architecture choices with an expert
- B) **Get a Sample Implementation** — GitHub Actions workflow + CLI skeleton to review
- C) **Receive the Roadmap Only** — Review recommendations at your own pace
- D) **Security/Compliance Review** — Get hosted vs. VPC vs. on-prem guidance

---

## Closing
*"Perfect! Your personalized roadmap is being generated. [If call selected: Our Solution Architect will reach out within 24 hours.] Thanks for your time—we'll be in touch soon!"*

---

## Implementation Notes

| Aspect | Recommendation |
|--------|----------------|
| **Timing** | ~90 seconds (7 questions × 10-12 sec each) |
| **Tone** | Consultative, technically credible |
| **Progress** | Show "Question X of 7" with progress bar |
| **Skip option** | Allow on Q5-Q7 (non-essential) |
| **Mobile** | Large tap targets, single-column layout |
| **Lead scoring** | Weight Q3 (privacy), Q6 (timeline/authority), Q7 (metric) heavily |
| **Personalization** | Midpoint recap should dynamically reflect actual answers |
| **Deliverable** | Promised roadmap should include: architecture diagram, pilot phases, KPIs, integration checklist |

---

## Key Improvements in v2

1. **More Technical Depth** — Added privacy/compliance question (critical for enterprise) and enforcement level (practical rollout concern)
2. **Clearer Value Proposition** — Opening acknowledges their specific interest; deliverable is a "Technical Roadmap" not generic "assessment"
3. **Better Qualification** — Combined timeline + authority into single question for efficiency; added PR volume for scale context
4. **Actionable Next Steps** — Offers tangible deliverables (sample implementation, compliance review) not just calls
5. **Success Metrics Focus** — Dedicated question helps align expectations and proves we understand ROI concerns
6. **Streamlined Flow** — Reduced from 8+ touchpoints to 7 focused questions while adding more substance