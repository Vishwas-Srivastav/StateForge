# StateForge Multi-Agent Workflow Guide

This guide walks through using StateForge across multiple AI coding agents (Claude, Codex, Cursor, Gemini, Copilot, Windsurf).

## Step 1: Initializing your repository

```sh
cd /path/to/my-project
stateforge init --name "My Enterprise App" --summary "Customer portal with auth and billing"
git add .
git commit -m "Initialize StateForge AI project state"
```

## Step 2: Working with Agent 1 (e.g. Claude)

1. Start work in Claude. Claude reads `.ai/AGENT_PROTOCOL.md` and `.ai/STATE.md`.
2. Record active task:
   ```sh
   stateforge task "Implement OAuth 2.0 PKCE auth flow" --status in-progress --active
   ```
3. Record architectural decision:
   ```sh
   stateforge decision "Use OAuth 2.0 with PKCE" --rationale "Required for secure SPA authorization."
   ```
4. Complete work:
   ```sh
   stateforge task --done task-20260821-implement-oauth-2-0-pkce-auth-flow
   ```

## Step 3: Preparing Handoff for Agent 2 (e.g. Codex)

When hitting session context limits or switching tools:

```sh
stateforge switch codex --next "Implement token refresh middleware" --do-not-repeat "PKCE protocol design and initial OAuth service implementation"
```

Commit state changes with your code:
```sh
git add .
git commit -m "feat(auth): add PKCE auth flow and handoff to Codex"
git push
```

## Step 4: Agent 2 (Codex) Resumes Work

1. Codex opens the repository or receives compiled context:
   ```sh
   stateforge compile --agent codex
   ```
2. Codex sees:
   - What was completed (PKCE auth flow)
   - What NOT to repeat (PKCE protocol design)
   - Immediate next action (Token refresh middleware)
3. Work continues without manual context reconstruction!
