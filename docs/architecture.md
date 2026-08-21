# StateForge Architecture

## Overview

StateForge is a Git-native persistent project state system designed to solve context loss and context waste when developing with multiple AI coding tools (Claude, Codex, Cursor, Gemini, Copilot, Windsurf).

```text
                    PROJECT
                       |
                       v
                 Git Repository
                       |
                       v
                StateForge State (.ai/)
                       |
          +------------+------------+
          |            |            |
          v            v            v
       Claude        Codex       Cursor
```

## Architectural Principles

1. **The Project Owns Memory**: AI agents are disposable workers. Memory lives in the repository.
2. **Git/GitHub as Source of Truth**: State changes are version controlled alongside code in normal commits, branches, and PRs.
3. **No Embeddings or Vector DBs**: StateForge intentionally avoids vector databases, embeddings, and external hosted memory services.
4. **Human-Readable First**: Canonical files use clean Markdown (`PROJECT.md`, `STATE.md`, `TASK.md`, `DECISIONS.md`, `HANDOFF.md`) and plain JSON/JSONL.
5. **Context Compilation & Budgeting**: Context Compiler filters and structures project state to pass the minimum useful context to LLMs, preventing token waste.

## Directory Contract (`.ai/`)

- `PROJECT.md`: High-level identity, purpose, stack, architecture, permanent constraints.
- `STATE.md`: Dynamic state summary (active task, status, completed work, known problems, next action).
- `TASK.md`: Specific active task objective, requirements, and notes.
- `DECISIONS.md`: Log of architecture decisions with status, rationale, and impact.
- `HANDOFF.md`: Latest bridge note between AI agents, including "Do Not Repeat" directives.
- `state.json`: Entry point JSON document for machine tools.
- `tasks.jsonl`: Append-friendly JSON Lines task records.
- `decisions.jsonl`: Append-friendly JSON Lines decision records.
- `handoffs/`: Historical archive of Markdown handoff snapshots.

## Multi-Agent Interoperability

StateForge provisions root instruction files:
- `AGENTS.md` (Universal)
- `CLAUDE.md` (Anthropic Claude)
- `GEMINI.md` (Google Gemini)
- `.github/copilot-instructions.md` (GitHub Copilot)
- `.cursor/rules/stateforge.mdc` (Cursor IDE)
- `.windsurfrules` (Windsurf IDE)

All instruction files direct AI agents to inspect `.ai/AGENT_PROTOCOL.md` and `.ai/` files before beginning work.
