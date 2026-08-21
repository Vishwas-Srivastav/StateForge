# .ai/

This directory is the canonical StateForge project state for this repository.

StateForge treats Git and GitHub as the durable source of truth. AI agents, IDEs, and coding tools are clients that read and update these files through normal commits and pull requests.

## Files

- `state.json`: current project identity, active task, and latest handoff pointer.
- `tasks.jsonl`: task records, one JSON object per line.
- `decisions.jsonl`: architecture and product decisions, one JSON object per line.
- `handoffs/`: Markdown handoff notes for the next agent or tool.
- `SPEC.md`: the on-disk format.
- `AGENT_PROTOCOL.md`: instructions for agent interoperability.
