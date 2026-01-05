# Janus CLI Walkthrough

I have successfully built **Janus**, your AI War Room. Here is how to use it.

## 1. Installation
The tool is already installed and linked globally on your system.
You can run it from anywhere:

```bash
janus --help
```

## 2. Configuration (`.env`)
You need to set up your API keys. I created a template for you.
Rename `.env.example` to `.env` inside `janus/` and fill it in:

```bash
cd "/Users/cg-adubuc/Desktop/Antoine/Shaareable Apps/janus"
mv .env.example .env
code .env
```
*(Fill in `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.)*

## 3. Creating a Flow (The Wizard)
To define a new debate process:

```bash
janus new-flow
```
*   **Name**: `ideation`
*   **Rounds**: 3
*   **Round 1 Prompt**: "Take this idea and flesh it out..."
*   **Refinement Prompt**: "Critique your peers and improve..."

## 4. Running the War Room
Create a markdown file with your rough idea:

```bash
echo "I want an app that tracks my coffee intake." > idea.md
```

Run the debate:

```bash
janus run ideation idea.md
```

You will see the output files appear in `.janus/runs/<run_id>/`:
*   `claude.v1.md`, `openai.v1.md` ...
*   `claude.v3.md` (The final result)

## 5. Artifacts Created
*   [Elevator Pitch](file:///Users/cg-adubuc/Desktop/Antoine/Shaareable%20Apps/elevator_pitch.md)
*   [Product Requirements](file:///Users/cg-adubuc/Desktop/Antoine/Shaareable%20Apps/implementation_plan.md)
*   [Tech Specs](file:///Users/cg-adubuc/Desktop/Antoine/Shaareable%20Apps/technical_specifications.md)
*   [Roadmap](file:///Users/cg-adubuc/Desktop/Antoine/Shaareable%20Apps/future.md)
*   [Source Code](file:///Users/cg-adubuc/Desktop/Antoine/Shaareable%20Apps/janus/)
