# Janus V2: The Evolution of Reasoning

We are building a linear reasoning engine (V1). But reasoning is rarely linear. It is a tree, a graph, a chaotic exploration. Here is where Janus goes next.

## 1. Non-Linear Topologies (The "Meeting Styles")
Currently, we run a "Round Robin". V2 should support complex debate structures:

*   **The Tournament (Bracket Style)**
    *   Initialize 8 models with slight variations (Temperature or Prompts).
    *   Round 1: 1v1 debates.
    *   Round 2: Winners advance.
    *   Result: Only the fittest ideas survive.
*   **The Special Counsel (Star Topology)**
    *   One "Leader" model (Claude) delegates sub-tasks to specialists.
    *   "OpenAI, go research the database schema."
    *   "Gemini, go audit the security."
    *   The Leader aggregates the results, rather than everyone debating everyone.

## 2. Dynamic Tool Use (Agents with Arms)
Right now, Janus produces **text** (Plans).
In V2, Janus models should be able to **read the world**:
*   **"Read the Repo"**: Instead of pasting text, the models get read-access to your current git branch.
*   **"Check the Specs"**: The models can crawl a URL (e.g., Stripe Documentation) to ensure their plan is factually correct.
*   **"Mock it Up"**: One agent could be configured to output HTML/CSS, which is rendered to a PNG, and fed back to the other agents for *visual* critique.

## 3. Human-in-the-Loop Interventions
The "Track" shouldn't be a locked ride.
*   **The Gavel**: At the end of Round 1, the user can pause the run, delete Gemini's bad idea, edit Claude's promising idea, and hit "Resume".
*   **Steerability**: "Inject" a new constraint mid-debate. (e.g., "Wait, stop everything—we need to support Mobile. Rethink.")

## 4. Derived Artifacts (The "Living Doc")
Instead of just a "Final Plan," Janus V2 creates a **Workspace**.
*   A persistent `.janus/knowledge.db` (SQLite/Vector) that remembers *why* you decided against MongoDB three months ago.
*   When you ask a new question in the future, Janus cites the "Historical Precedent" from a previous debate.

## 5. The "Committee" API
Janus reduces the "Bus Factor" of rely on a single model.
*   **API Gateway**: Expose `janus` as a local server (`localhost:3000/v1/chat`).
*   Point your existing VS Code extensions (Cursor, Copilot) to `localhost:3000`.
*   Now, when you ask Copilot a question, it secretly convenes a "Council of 3" in the background and gives you the synthesized answer. **Invisible Super-Intelligence.**

## 6. Self-Optimization
*   **The Meta-Reviewer**: After a run, you rate the result (1-5 stars).
*   Janus V2 analyzes the logs: "When we use Gemini for Security, the user gives 5 stars. When we use OpenAI, they give 3."
*   It automatically adjusts the "Casting" for future runs.
