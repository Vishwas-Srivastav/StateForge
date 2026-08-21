# StateForge Agent Protocol

These instructions are for any AI coding agent or IDE assistant working in this repository.

## Read Order

1. Read `.ai/state.json`.
2. Read `.ai/tasks.jsonl`.
3. Read `.ai/decisions.jsonl`.
4. Read the latest file in `.ai/handoffs/` when present.
5. Read normal project documentation such as `README.md` and `docs/`.

## Update Rules

- Keep canonical project state under `.ai/`.
- Use `stateforge task`, `stateforge decision`, and `stateforge handoff` when available.
- If the CLI is unavailable, edit `.ai/` files directly using the schemas in `.ai/SPEC.md`.
- Commit state changes with the code or documentation changes they describe.
- Do not store canonical StateForge state in a separate backend, memory service, vector database, or embedding index.

## Handoff Rule

Before stopping substantial work, create or update a handoff that says what changed, what remains, and which files matter next.
