# Adopting StateForge In Any Project

StateForge is meant to be installed into ordinary Git repositories. The project using StateForge does not need to be a TypeScript project and does not need a backend service.

## Requirements

- A Git repository.
- A way to run the StateForge CLI.
- A team or agent workflow willing to keep `.ai/` changes in commits.

## Bootstrap

```sh
stateforge init --name "Project Name" --summary "One sentence project purpose."
```

The command creates:

- `.ai/state.json`
- `.ai/tasks.jsonl`
- `.ai/decisions.jsonl`
- `.ai/handoffs/`
- `.ai/SPEC.md`
- `.ai/AGENT_PROTOCOL.md`
- common agent instruction files such as `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/stateforge.mdc`, and `.windsurfrules` when they do not already exist

Use `--no-agent-files` if you only want the canonical `.ai/` files.

## Operating Rule

StateForge is not a project template that owns the application structure. It is a small state engine that can sit beside any app, library, service, document project, or research repo.

The `.ai/` directory is the durable contract. Tool-specific files only tell clients where to look.

## Recommended Workflow

1. Create or update a task before starting meaningful work.
2. Record important decisions as they happen.
3. Commit `.ai/` changes with the related code or docs.
4. Create a handoff before switching agents, IDEs, branches, or sessions.

## What Not To Add

- Embedding indexes as canonical memory.
- A vector database as canonical memory.
- A hosted StateForge backend.
- Tool-private hidden memory as the source of truth.

Those systems may be clients or caches later, but the repository remains authoritative.
