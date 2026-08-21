# Scripts And Automation

StateForge keeps automation intentionally small. The goal is to make local and GitHub verification easy without creating a backend-shaped project.

## Package Scripts

- `npm run stateforge -- <command>` runs the CLI from source.
- `npm test` runs the Node.js test suite.
- `npm run smoke` checks that the current repository state can be read.
- `npm run verify` runs tests, typechecking when dependencies are installed, CLI help, and CLI status.

## GitHub Files

- `.github/workflows/ci.yml` runs verification on pushes to `main` and pull requests.
- `.github/pull_request_template.md` reminds contributors to keep `.ai/` state with their code changes.
- `.github/ISSUE_TEMPLATE/stateforge_task.yml` gives teams a lightweight way to connect GitHub issues to StateForge task state.

## Design Rule

Automation should support the repository-local `.ai/` contract. It should not become the source of truth.
