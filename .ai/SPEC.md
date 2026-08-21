# StateForge .ai/ Specification

Version: 1

StateForge stores persistent AI project state inside any adopting repository under `.ai/`. The repository is the source of truth. Git history, branches, reviews, and GitHub remotes provide synchronization and auditability.

## Constraints

- Use Git/GitHub as durable storage.
- Treat IDEs and AI coding tools as clients.
- Allow any project type to adopt the same `.ai/` contract.
- Do not require embeddings, vector databases, external memory services, or a separate backend.
- Keep records human-readable and diff-friendly.
- Prefer append-friendly formats where possible.

## Required Files

### `state.json`

Current project state.

Required schema identifier: `stateforge.state/v1`

Important fields:

- `project.name`: human project name.
- `project.summary`: one sentence project summary.
- `sourceOfTruth.canonicalPath`: always `.ai/`.
- `current.activeTask`: task id or `null`.
- `current.lastHandoff`: handoff path or `null`.

### `tasks.jsonl`

Task records. Each line is a full JSON object using schema `stateforge.task/v1`.

Allowed statuses: `todo`, `in-progress`, `blocked`, `done`.

### `decisions.jsonl`

Decision records. Each line is a full JSON object using schema `stateforge.decision/v1`.

Allowed statuses: `proposed`, `accepted`, `superseded`.

### `handoffs/`

Markdown handoff notes. Each handoff should include current state, active task, recent decisions, next step, and notes.

## Compatibility Rule

If a future StateForge version changes these shapes, it should add new schema identifiers instead of silently changing existing records.
