# StateForge CLI Reference

The StateForge CLI (`stateforge`) manages project state, tasks, decisions, agent handoffs, context compilation, and Git divergence checks.

## Command Summary

### `stateforge init`
Initialize StateForge in the current Git repository.
```sh
stateforge init [--name <name>] [--summary <summary>] [--no-agent-files]
```

### `stateforge status`
Display the current project state, active task, open/done tasks count, decisions count, latest handoff, and Git status.
```sh
stateforge status
```

### `stateforge validate`
Validate the schema and file integrity of `.ai/` state.
```sh
stateforge validate
```

### `stateforge sync`
Check for divergence between Git source changes and StateForge AI state.
```sh
stateforge sync
```

### `stateforge task`
Create, list, or update tasks.
```sh
# Create a task
stateforge task "Implement auth refresh tokens" --status in-progress --active --note "Requires JWT rotation"

# List all tasks
stateforge task --list

# Update task status
stateforge task --start <task-id>
stateforge task --done <task-id>
stateforge task --block <task-id>
```

### `stateforge decision`
Record an architectural or technical decision.
```sh
stateforge decision "Use Redis for caching" --rationale "Performance requirements" --impact "Added Redis dependency" --status accepted
stateforge decision --list
```

### `stateforge handoff`
Generate a handoff document for the next AI agent or session.
```sh
stateforge handoff "Auth implementation complete" --to codex --next "Update middleware validation" --do-not-repeat "OAuth design analysis"
```

### `stateforge switch`
Switch active agent context, generate a handoff note, and compile prompt context.
```sh
stateforge switch codex --next "Refactor auth middleware"
```

### `stateforge compile` (alias `context`)
Compile minimal useful context for LLM prompts under a token budget.
```sh
stateforge compile [--budget <tokens>] [--agent <name>]
```
