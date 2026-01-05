Here is a lead-generation flow designed for an AI SDLC Consultant Chatbot.

**Constraint Checklist:**
*   **Role:** Expert AI SDLC Consultant.
*   **Time:** < 2 minutes (approx. 4 questions).
*   **Format:** Short questions, multiple-choice answers.
*   **Features:** Midpoint recap, email capture, next steps.
*   **Context:** Customized to the "AI-Powered Code Review Tool" input.

***

### Chatbot Flow

**Bot (Intro):**
"Hello! I see you’re looking to build an **AI-Powered Code Review Tool** for mid-size teams. That is a high-value space, but the challenge usually lies in balancing 'false positives' with speed.

Let's validate your technical strategy to see if you are ready for development. Ready?"

*   [A] Let's go.
*   [B] Give me a second.

---

**Bot (Question 1 - Technical Architecture):**
"First, regarding the LLM backend: Mid-size companies are sensitive to data privacy. What is your planned inference strategy for analyzing private repositories?"

*   [A] **Public API (e.g., GPT-4/Claude):** Better reasoning, but higher privacy concerns.
*   [B] **Self-Hosted Open Source (e.g., Llama 3):** Total privacy, but higher infrastructure costs.
*   [C] **Hybrid Router:** Routes non-sensitive logic to public APIs and code analysis to local models.

---

**Bot (Question 2 - CI/CD Integration):**
"You mentioned GitHub Actions integration. How aggressive will this tool be within the SDLC pipeline?"

*   [A] **Advisory Mode:** Posts comments on the PR; does not stop the build.
*   [B] **Gatekeeper Mode:** Blocks merging if high-severity vulnerabilities are detected.
*   [C] **Agentic Mode:** Not only detects bugs but pushes a new commit with fixes automatically.

---

**Bot (Midpoint Recap):**
"Got it. Let me recap your strategy so far:
1.  **Architecture:** You are leaning toward a specific inference model (Public/Private/Hybrid).
2.  **Workflow:** You defined the tool's strictness level in the CI/CD pipeline.

It sounds like you have a solid grasp on the *tech*, now let's look at the *business logic*."

---

**Bot (Question 3 - Security & Compliance):**
"For mid-size companies, 'Hallucinations' in security advice can destroy trust. How do you plan to validate the vulnerabilities the AI finds?"

*   [A] **Human-in-the-loop:** Required developer sign-off before flagging.
*   [B] **Symbolic Analysis Verification:** Running a deterministic code scanner (like SonarQube) to verify the AI's guess.
*   [C] **No Verification:** Relying entirely on the LLM's confidence score.

---

**Bot (Question 4 - Success Metric):**
"Final question on viability: What is the primary 'North Star' metric you will promise to these development teams?"

*   [A] **Velocity:** Reducing the time a PR sits in review by 50%.
*   [B] **Security:** Catching OWASP Top 10 vulnerabilities pre-merge.
*   [C] **Cost:** Reducing billable hours spent on senior engineer code reviews.

---

**Bot (Lead Capture):**
"Based on your answers, your project has high potential but faces some specific architectural hurdles regarding **data privacy** and **latency**.

Our Senior Architects have built similar CI/CD agents. I can have one generate a **Technical Roadmap PDF** specifically for this CLI tool and send it to you.

Where should we send that?"

*   [Input Field: Enter your business email]

---

**Bot (Next Steps):**
"Thanks! Your roadmap is being generated. In the meantime, how would you like to proceed?"

*   [A] **Book a 15-min Tech Audit:** Speak with a Solution Architect about your LLM choice.
*   [B] **View Case Studies:** See how we built a similar tool for a Fintech client.
*   [C] **Wait for Email:** Just send the PDF, I’m browsing.