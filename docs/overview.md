# StateForge — End-to-End System Overview

## 1. Executive Summary

StateForge is a Git-native persistent project state layer for AI coding agents. It solves the context loss and context waste problems that occur when developers use multiple AI tools (**Claude, Codex, Cursor, Gemini, Copilot, Windsurf**) on the same codebase.

StateForge makes your Git repository the persistent source of truth for AI project state, allowing different AI coding agents to continue work without requiring the developer to manually reconstruct previous conversations and without forcing agents to consume large amounts of irrelevant context.

> **Core Philosophy:**
> **The AI agent is disposable. The project state is persistent. Git is the memory.**

---

## 2. Problem Statement & Core Insight

### 2.1 Context Loss Between AI Agents
When a developer works with Claude, decisions are made, problems discovered, and architecture analyzed. When Claude hits a session context limit or the developer switches to Codex:
- Claude's context remains trapped inside Claude's session.
- The developer must reconstruct context manually.
- Codex re-explores the repository, wasting time, tokens, and risking inconsistent implementations.

### 2.2 Context and Token Waste
Naive workflows dump full conversation transcripts, entire codebases, and historical discussions into prompts. This leads to:
- Excessive input tokens and higher costs.
- Irrelevant context polluting reasoning.
- Slower task execution and degraded LLM accuracy.

### 2.3 The Core Insight
The project owns the context. AI agents consume and update the context.

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

---

## 3. Critical Constraints

- **No Embeddings**: Embeddings are explicitly out of scope.
- **No Vector Database**: No Pinecone, Chroma, Weaviate, Milvus, or Qdrant.
- **No Hosted Memory Service**: State lives inside the repository under version control.
- **Git & GitHub as Foundation**: Persistence, branching, diffing, pull requests, and auditability are managed by Git.
- **Human-Readable First, Machine-Readable Second**: Markdown state documents kept in sync with structured JSON metadata.

---

## 4. The `.ai/` Project State Directory Contract

When initialized (`stateforge init`), StateForge provisions the standard `.ai/` directory:

```text
.ai/
├── PROJECT.md          # Stable project identity, architecture & constraints
├── STATE.md            # Active project state, active task, completed work
├── TASK.md             # Active task objective, requirements & notes
├── DECISIONS.md        # Log of architectural & design decisions (DEC-001...)
├── HANDOFF.md          # Latest agent handoff note ("Do Not Repeat" instructions)
├── state.json          # Structured JSON metadata entry point
├── tasks.jsonl         # Append-friendly task records (JSON Lines)
├── decisions.jsonl     # Append-friendly decision records (JSON Lines)
├── handoffs/           # Historical archive of Markdown handoff notes
├── SPEC.md             # On-disk format specification
└── AGENT_PROTOCOL.md   # Universal read order & update rules for AI agents
```

It also provisions root instruction files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/stateforge.mdc`, `.windsurfrules`).

---

## 5. Technical Engine Components

### 5.1 Dual Markdown Synchronization Engine
StateForge ensures that `.ai/PROJECT.md`, `.ai/STATE.md`, `.ai/TASK.md`, `.ai/DECISIONS.md`, and `.ai/HANDOFF.md` are automatically generated and kept in sync whenever state changes via CLI or direct editing.

### 5.2 Context Compiler & Token Budgeting (`stateforge compile`)
`stateforge compile [--budget <tokens>] [--agent <name>]` calculates the token budget (default 4000 tokens ~ 16000 chars) and compiles a minimal, layered context window containing:
1. `PROJECT.md` (Project Identity)
2. `STATE.md` (Current State Summary)
3. `TASK.md` (Active Task Details)
4. `DECISIONS.md` (Recent Architectural Decisions)
5. `HANDOFF.md` (Latest Handoff & **Do Not Repeat** instructions)

### 5.3 Git Divergence Sync (`stateforge sync`)
`stateforge sync` compares Git status against `.ai/` state files, detecting uncommitted source changes and recommending handoff creation before switching agents.

### 5.4 Agent Switcher (`stateforge switch <agent>`)
`stateforge switch <agent>` atomically logs progress, records target agent, updates `lastAgent` in state, records "Do Not Repeat" directives, and generates compiled prompt context for the next agent.

---

## 6. How Handoffs & Multi-Agent Cycles Work

### 6.1 In-Session vs Handoff Maintenance
- **In-Session**: As an agent works, it updates `.ai/STATE.md`, `.ai/TASK.md`, and `.ai/DECISIONS.md`. State changes are committed to Git alongside source code changes.
- **Checkpoint Handoff**: Before an agent stops work or hits session context limits, `stateforge handoff` or `stateforge switch <agent>` creates `.ai/HANDOFF.md` and an archived snapshot in `.ai/handoffs/timestamp.md`.

### 6.2 The Circular Multi-Agent Cycle (Claude -> Codex -> Cursor -> Claude)

```text
                  +--------------------------------+
                  |  StateForge Repository (.ai/)  |
                  +--------------------------------+
                    ^            ^            ^
                   /              \            \
                  /                \            \
            1. Claude            2. Codex      3. Cursor
         (Auth Service)      (Token Rotation)  (UI & Middleware)
                  \                /            /
                   \              /            /
                    +------------+------------+
```

1. **Claude finishes turn**: Runs `stateforge switch codex --next "Implement token rotation" --do-not-repeat "PKCE protocol design"` and commits.
2. **Codex takes over**: Codex opens the repo or receives `stateforge compile --agent codex`. It sees completed work, next steps, and **Do Not Repeat** directives without loading 100k tokens of Claude chat logs.
3. **Cursor takes over from Codex**: Runs `stateforge switch cursor` and builds UI components based on updated `.ai/STATE.md`.
4. **Cycle returns to Claude**: Claude opens the repository, reads `.ai/` state, sees progress made by Codex and Cursor, and continues seamlessly. Claude does not need its old chat session.

---

## 7. CLI Reference Quick Sheet

```sh
# Initialize StateForge in a Git repository
stateforge init --name "My App" --summary "Customer dashboard"

# View status & state summary
stateforge status

# Validate .ai/ schema & file integrity
stateforge validate

# Check Git diff vs AI state divergence
stateforge sync

# Task management
stateforge task "Implement auth refresh tokens" --status in-progress --active
stateforge task --list
stateforge task --done task-20260821-001

# Record architectural decisions
stateforge decision "Use Redis for session cache" --rationale "Low latency required"

# Handoffs & agent switching
stateforge handoff "Auth rotation complete" --to codex --next "Update middleware"
stateforge switch codex --next "Verify token invalidation"

# Compile minimal prompt context (Token Budgeting)
stateforge compile --budget 3000 --agent cursor
```

---

## 8. Verification & Engineering Guardrails

StateForge integrates with standard engineering guardrails:
- **Local Hooks**: `./scripts/setup-guardrails.sh` configures `.githooks/` (`commit-msg`, `pre-commit`, `pre-push`).
- **Automated Verification**: `./scripts/check-guardrails.sh` and `npm run verify` run unit tests (9/9 passing) and CLI smoke checks.
- **CI Automation**: `.github/workflows/ci.yml` runs Guardrails, Gitleaks security scans, and Node.js testing matrices on GitHub Actions.
