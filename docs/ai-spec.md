# `.ai/` State Specification

The canonical StateForge specification lives at `.ai/SPEC.md` inside each project that adopts StateForge, so every agent can find it before reading tool-specific instructions.

This documentation copy explains the same contract for humans browsing the repository docs.

## Principles

- The repository owns project state.
- The `.ai/` directory is the canonical state path.
- Agents may cache or summarize state, but caches are not authoritative.
- Files must remain readable in a normal code review.
- Schema identifiers must change when record shapes change.

## Schemas

- `stateforge.state/v1`
- `stateforge.task/v1`
- `stateforge.decision/v1`

## Required State Files

- `.ai/state.json`
- `.ai/tasks.jsonl`
- `.ai/decisions.jsonl`
- `.ai/handoffs/`
- `.ai/SPEC.md`
- `.ai/AGENT_PROTOCOL.md`
