import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import {
  compileContext,
  createHandoff,
  createTask,
  getProjectStatus,
  initializeState,
  listTasks,
  recordDecision,
  switchAgent,
  syncState,
  updateTaskStatus,
  validateState
} from "../src/core.ts";

function withRepo(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "stateforge-"));
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });

  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("init creates canonical .ai files including Markdown state documents", () => {
  withRepo((root) => {
    const result = initializeState(root, {
      projectName: "Demo",
      summary: "Portable project state."
    });

    assert.equal(result.alreadyInitialized, false);
    assert.equal(existsSync(join(root, ".ai", "state.json")), true);
    assert.equal(existsSync(join(root, ".ai", "tasks.jsonl")), true);
    assert.equal(existsSync(join(root, ".ai", "decisions.jsonl")), true);
    assert.equal(existsSync(join(root, ".ai", "PROJECT.md")), true);
    assert.equal(existsSync(join(root, ".ai", "STATE.md")), true);
    assert.equal(existsSync(join(root, ".ai", "TASK.md")), true);
    assert.equal(existsSync(join(root, ".ai", "DECISIONS.md")), true);
    assert.equal(existsSync(join(root, ".ai", "HANDOFF.md")), true);
    assert.equal(existsSync(join(root, ".ai", "SPEC.md")), true);
    assert.equal(existsSync(join(root, "AGENTS.md")), true);
    assert.equal(existsSync(join(root, ".github", "copilot-instructions.md")), true);
    assert.equal(existsSync(join(root, ".cursor", "rules", "stateforge.mdc")), true);

    const state = JSON.parse(readFileSync(join(root, ".ai", "state.json"), "utf8"));
    assert.equal(state.project.name, "Demo");
    assert.equal(state.sourceOfTruth.type, "git");
    assert.equal(state.sourceOfTruth.externalMemory, false);

    const projectMd = readFileSync(join(root, ".ai", "PROJECT.md"), "utf8");
    assert.match(projectMd, /Demo/);
    assert.match(projectMd, /Portable project state/);
  });
});

test("init can skip tool-specific agent instruction files", () => {
  withRepo((root) => {
    initializeState(root, {
      projectName: "Demo",
      installAgentInstructions: false
    });

    assert.equal(existsSync(join(root, ".ai", "state.json")), true);
    assert.equal(existsSync(join(root, "AGENTS.md")), false);
    assert.equal(existsSync(join(root, ".github", "copilot-instructions.md")), false);
  });
});

test("tasks can be created, completed, and sync Markdown STATE.md", () => {
  withRepo((root) => {
    initializeState(root, { projectName: "Demo" });

    const task = createTask(root, {
      title: "Ship CLI",
      status: "in-progress",
      active: true
    });
    assert.equal(task.status, "in-progress");

    const stateMd1 = readFileSync(join(root, ".ai", "STATE.md"), "utf8");
    assert.match(stateMd1, /Ship CLI/);

    const updated = updateTaskStatus(root, task.id, "done");
    assert.equal(updated.status, "done");

    const tasks = listTasks(root);
    assert.equal(tasks.some((item) => item.id === task.id && item.status === "done"), true);

    const state = JSON.parse(readFileSync(join(root, ".ai", "state.json"), "utf8"));
    assert.equal(state.current.activeTask, null);

    const stateMd2 = readFileSync(join(root, ".ai", "STATE.md"), "utf8");
    assert.match(stateMd2, /Ship CLI/);
  });
});

test("decisions and handoffs update project status and Markdown documents", () => {
  withRepo((root) => {
    initializeState(root, { projectName: "Demo" });

    const decision = recordDecision(root, {
      title: "Keep state in Git",
      rationale: "Commits make state portable and reviewable.",
      impact: "No external memory backend is required."
    });
    assert.equal(decision.status, "accepted");

    const decisionsMd = readFileSync(join(root, ".ai", "DECISIONS.md"), "utf8");
    assert.match(decisionsMd, /Keep state in Git/);

    const handoff = createHandoff(root, {
      summary: "MVP state ready",
      next: "Run the CLI tests.",
      notes: "Core state files were created."
    });

    assert.equal(existsSync(join(root, handoff.path)), true);

    const handoffMd = readFileSync(join(root, ".ai", "HANDOFF.md"), "utf8");
    assert.match(handoffMd, /MVP state ready/);

    const status = getProjectStatus(root);
    assert.equal(status.decisions.length, 2);
    assert.equal(status.latestHandoff?.path, handoff.path);
    assert.equal(status.state.current.lastHandoff, handoff.path);
  });
});

test("compileContext produces layered minimum context within budget", () => {
  withRepo((root) => {
    initializeState(root, { projectName: "Demo", summary: "Context compilation test" });

    createTask(root, { title: "Implement auth middleware", status: "in-progress", active: true });
    recordDecision(root, { title: "Use JWT tokens", rationale: "Stateless verification." });
    createHandoff(root, { summary: "Auth service ready", recipient: "codex" });

    const compiled = compileContext(root, { budget: 1000, agent: "codex" });
    assert.equal(compiled.targetAgent, "codex");
    assert.ok(compiled.tokenEstimate > 0);
    assert.match(compiled.compiledText, /SECTION: PROJECT IDENTITY/);
    assert.match(compiled.compiledText, /SECTION: CURRENT STATE/);
    assert.match(compiled.compiledText, /SECTION: ACTIVE TASK/);
    assert.match(compiled.compiledText, /SECTION: RECENT DECISIONS/);
    assert.match(compiled.compiledText, /SECTION: LATEST HANDOFF/);
  });
});

test("syncState reports git clean status and recommendations", () => {
  withRepo((root) => {
    initializeState(root, { projectName: "Demo" });

    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "Test User"], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "Initial commit"], { cwd: root, stdio: "ignore" });

    const sync1 = syncState(root);
    assert.equal(sync1.gitClean, true);

    writeFileSync(join(root, "untracked.txt"), "hello");
    const sync2 = syncState(root);
    assert.equal(sync2.gitClean, false);
    assert.ok(sync2.untrackedStateChanges.length > 0);
  });
});

test("switchAgent creates handoff and updates active agent", () => {
  withRepo((root) => {
    initializeState(root, { projectName: "Demo" });

    const result = switchAgent(root, "codex", { next: "Review middleware." });
    assert.ok(result.handoff.path.includes("switching-to-codex"));
    assert.equal(result.compiled.targetAgent, "codex");

    const status = getProjectStatus(root);
    assert.equal(status.state.current.lastAgent, "codex");
  });
});

test("validateState passes for initialized repositories", () => {
  withRepo((root) => {
    initializeState(root, { projectName: "Demo" });

    const result = validateState(root);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });
});

test("validateState reports invalid canonical state", () => {
  withRepo((root) => {
    initializeState(root, { projectName: "Demo" });

    const statePath = join(root, ".ai", "state.json");
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    state.sourceOfTruth.externalMemory = true;
    state.current.activeTask = "task-missing";
    writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);

    const result = validateState(root);
    assert.equal(result.valid, false);
    assert.equal(
      result.errors.some((error) => error.includes("externalMemory")),
      true
    );
    assert.equal(
      result.errors.some((error) => error.includes("Active task task-missing")),
      true
    );
  });
});
