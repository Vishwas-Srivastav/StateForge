# Handoff: Scripts and GitHub automation added

Generated: 2026-08-21T10:42:57.836Z
Project: StateForge

## Current State

- Project status: active
- Active task: none
- Canonical state path: .ai/

## Recent Decisions

- decision-20260821-001-git-source-of-truth: Use Git as the persistent source of truth
- decision-20260821-002-plain-files-first: Use plain JSON and Markdown files for the MVP
- decision-20260821-003-node-typescript-cli: Start as a TypeScript Node.js CLI
- decision-20260821103336150-keep-stateforge-generic-for-any-git-project: Keep StateForge generic for any Git project
- decision-20260821104253305-keep-automation-supportive-and-repository-local: Keep automation supportive and repository-local

## Next Step

Add schema validation and npm packaging when ready.

## Notes

Added scripts/check.mjs, npm check/verify/smoke scripts, .github/workflows/ci.yml, pull request template, issue template YAML, and docs/automation.md. npm run verify passes locally; typecheck is skipped until dev dependencies are installed.
