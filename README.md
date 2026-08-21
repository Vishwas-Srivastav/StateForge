# StateForge

**Git-native persistent project state for AI coding agents.**

StateForge solves context loss and context waste when using multiple AI coding agents (Claude, Codex, Cursor, Gemini, Copilot, Windsurf) on the same project. It makes your Git repository the persistent source of truth for AI project state.

**The AI agent is disposable. The project state is not.**

---

## Core Philosophy

- **Git-Native Persistence**: State lives inside your repository under `.ai/`. Commits, branches, and PRs track project memory alongside source code.
- **Zero Vector Infrastructure**: No embeddings, no vector databases (Pinecone, Chroma, Qdrant), and no hosted memory backends.
- **Human-Readable First, Machine-Readable Second**: Markdown state files (`PROJECT.md`, `STATE.md`, `TASK.md`, `DECISIONS.md`, `HANDOFF.md`) kept in sync with lightweight structured JSON metadata.
- **Minimum Useful Context**: Context compilation trims context bloat and token waste, delivering only what is needed for the active task.

---

## Getting Started

### 1. Initialize Engineering Guardrails
```bash
./scripts/setup-guardrails.sh
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Verify System & CLI
```bash
npm run verify
```

---

## CLI Commands

```sh
# Initialize StateForge in any Git repository
stateforge init --name "My Project" --summary "Customer dashboard"

# View status & project summary
stateforge status

# Validate .ai/ state file integrity
stateforge validate

# Check for Git diff divergence vs AI state
stateforge sync

# Task management
stateforge task "Implement auth refresh tokens" --status in-progress --active
stateforge task --list
stateforge task --done task-20260821-001

# Record architectural decisions
stateforge decision "Use Redis for session cache" --rationale "Low latency required."

# Create agent handoffs & switch agents seamlessly
stateforge handoff "Auth rotation complete" --to codex --next "Update middleware"
stateforge switch codex --next "Verify token invalidation"

# Compile minimal useful context for LLMs (Token Budgeting)
stateforge compile --budget 3000 --agent cursor
```

---

## The `.ai/` State Directory

When initialized, StateForge creates the standard `.ai/` directory contract:

```text
.ai/
├── PROJECT.md          # Stable project identity, architecture & constraints
├── STATE.md            # Active project state, active task, completed work
├── TASK.md             # Active task objective, requirements & notes
├── DECISIONS.md        # Log of architectural & implementation decisions
├── HANDOFF.md          # Latest agent handoff note ("Do Not Repeat" instructions)
├── state.json          # Structured JSON metadata entry point
├── tasks.jsonl         # Task records (JSON Lines)
├── decisions.jsonl     # Decision records (JSON Lines)
├── handoffs/           # Archived Markdown handoff notes
├── SPEC.md             # On-disk format specification
└── AGENT_PROTOCOL.md   # Universal read order & rules for AI agents
```

It also creates root agent instruction files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/stateforge.mdc`, `.windsurfrules`).

---

## Workflow Example: Switching Agents Without Context Loss

1. **Developer works with Claude**:
   Claude implements a feature and runs:
   ```sh
   stateforge switch codex --next "Refactor auth middleware"
   ```
2. **Developer switches to Codex**:
   Codex reads `.ai/` or receives the compiled prompt:
   ```sh
   stateforge compile --agent codex
   ```
3. **Codex immediately understands**:
   - What was completed
   - What decisions were made
   - What files changed
   - **What NOT to repeat** (prevents repeated exploration & token waste)

---

## Engineering Guardrails & Branch Strategy

- **Default Baseline Branch:** `development` (All Pull Requests must target `development`).
- **Production Sync:** Merges into `development` automatically sync to `main`.
- **Branch Naming:** `SF-<NUMBER>` or `(feature|bugfix|chore)/SF-<NUMBER>` (e.g. `SF-01`, `feature/SF-01`).
- **Commit Format:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`).
- **Guardrail Checks:** Run `./scripts/check-guardrails.sh` locally.

---

## Documentation & Standards

- **Contributor Guide:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Engineering Guardrails:** [docs/GUARDRAILS.md](docs/GUARDRAILS.md)
- **Workflow Guide:** [docs/workflow-guide.md](docs/workflow-guide.md)
- **Architecture Overview:** [docs/architecture.md](docs/architecture.md)
- **CLI Reference:** [docs/cli.md](docs/cli.md)
- **Security Policy:** [SECURITY.md](SECURITY.md)

License: MIT / Apache 2.0 compatible.
