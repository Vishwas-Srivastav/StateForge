# Architecture Decisions Log

This log records architectural and technical decisions made for this project.

## decision-20260821-001-git-source-of-truth: Use Git as the persistent source of truth

- **Status**: accepted
- **Rationale**: Project state should travel with the repository and remain visible in diffs, branches, pull requests, and history.
- **Impact**: The MVP stores canonical state under .ai/ and avoids embeddings, vector databases, external memory services, and separate backends.
- **Date**: 2026-08-21T00:00:00.000Z

---

## decision-20260821-002-plain-files-first: Use plain JSON and Markdown files for the MVP

- **Status**: accepted
- **Rationale**: The first version should be easy for humans and agents to inspect, edit, merge, and recover.
- **Impact**: state.json holds current state, JSONL files hold tasks and decisions, and Markdown files hold handoffs.
- **Date**: 2026-08-21T00:00:00.000Z

---

## decision-20260821-003-node-typescript-cli: Start as a TypeScript Node.js CLI

- **Status**: accepted
- **Rationale**: A CLI is the smallest useful client surface and works across local IDEs and coding agents.
- **Impact**: The MVP exposes init, status, task, decision, and handoff commands without a backend service.
- **Date**: 2026-08-21T00:00:00.000Z

---

## decision-20260821103336150-keep-stateforge-generic-for-any-git-project: Keep StateForge generic for any Git project

- **Status**: accepted
- **Rationale**: The tool should install a portable .ai contract into existing repositories without imposing an application template.
- **Impact**: stateforge init creates canonical .ai state plus optional tool instruction files while preserving the host project's structure.
- **Date**: 2026-08-21T10:33:36.150Z

---

## decision-20260821104253305-keep-automation-supportive-and-repository-local: Keep automation supportive and repository-local

- **Status**: accepted
- **Rationale**: Scripts and GitHub YAML should verify the CLI and prompt .ai updates without becoming a backend or hidden state store.
- **Impact**: The MVP includes npm verification, GitHub CI, and contribution templates while keeping .ai as the only canonical project state.
- **Date**: 2026-08-21T10:42:53.306Z

---

## decision-20260821110014383-provide-dual-markdown-state-files-sync-and-context-compiler: Provide dual Markdown state files sync and context compiler

- **Status**: accepted
- **Rationale**: Human-readable Markdown files keep state accessible without CLI; context compiler prevents token waste.
- **Impact**: Keeps canonical Markdown state accessible and provides minimal context compilation.
- **Date**: 2026-08-21T11:00:14.384Z
