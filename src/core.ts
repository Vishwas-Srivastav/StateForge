import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

export const STATEFORGE_VERSION = "0.1.0";
export const AI_DIR = ".ai";

export type TaskStatus = "todo" | "in-progress" | "blocked" | "done";
export type DecisionStatus = "proposed" | "accepted" | "superseded";

export interface StateForgeState {
  schema: "stateforge.state/v1";
  stateforgeVersion: string;
  project: {
    name: string;
    summary: string;
    repository: string | null;
  };
  sourceOfTruth: {
    type: "git";
    canonicalPath: ".ai/";
    externalMemory: false;
  };
  current: {
    status: "active" | "paused" | "blocked";
    activeTask: string | null;
    lastHandoff: string | null;
    lastAgent?: string | null;
  };
  updatedAt: string;
}

export interface TaskRecord {
  schema: "stateforge.task/v1";
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  notes: string[];
}

export interface DecisionRecord {
  schema: "stateforge.decision/v1";
  id: string;
  title: string;
  status: DecisionStatus;
  rationale: string;
  impact: string;
  createdAt: string;
}

export interface HandoffRecord {
  path: string;
  title: string;
  updatedAt: string;
}

export interface ProjectStatus {
  root: string;
  state: StateForgeState;
  tasks: TaskRecord[];
  decisions: DecisionRecord[];
  latestHandoff: HandoffRecord | null;
  git: {
    clean: boolean | null;
    summary: string;
  };
}

export interface InitializeStateOptions {
  projectName?: string;
  summary?: string;
  installAgentInstructions?: boolean;
}

export interface ValidationResult {
  root: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CompileContextOptions {
  budget?: number; // Target token count (default 4000 tokens ~ 16000 chars)
  agent?: string;
  taskOnly?: boolean;
}

export interface CompiledContextResult {
  root: string;
  targetAgent: string;
  tokenEstimate: number;
  compiledText: string;
}

export interface SyncResult {
  root: string;
  inSync: boolean;
  gitClean: boolean;
  untrackedStateChanges: string[];
  recommendations: string[];
}

export class StateForgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StateForgeError";
  }
}

export function findGitRoot(startDir: string = process.cwd()): string | null {
  let current = resolve(startDir);

  while (true) {
    if (existsSync(join(current, ".git"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

export function initializeState(
  startDir: string,
  options: InitializeStateOptions = {}
): { root: string; created: string[]; alreadyInitialized: boolean } {
  const root = findGitRoot(startDir);
  if (!root) {
    throw new StateForgeError("StateForge must be initialized inside a Git repository. Run git init first.");
  }

  const created: string[] = [];
  const aiDir = join(root, AI_DIR);
  const handoffDir = join(aiDir, "handoffs");
  mkdirSync(handoffDir, { recursive: true });

  const statePath = join(aiDir, "state.json");
  const projectName = options.projectName ?? basename(root);
  const summary =
    options.summary ??
    "Git-native persistent project state for AI coding agents.";
  const alreadyInitialized = existsSync(statePath);

  if (!alreadyInitialized) {
    const taskId = makeId("task", "initialize-stateforge-state", new Set());
    const now = nowIso();
    const state: StateForgeState = {
      schema: "stateforge.state/v1",
      stateforgeVersion: STATEFORGE_VERSION,
      project: {
        name: projectName,
        summary,
        repository: readOriginUrl(root)
      },
      sourceOfTruth: {
        type: "git",
        canonicalPath: ".ai/",
        externalMemory: false
      },
      current: {
        status: "active",
        activeTask: taskId,
        lastHandoff: null,
        lastAgent: "generic"
      },
      updatedAt: now
    };

    writeJson(statePath, state);
    created.push(".ai/state.json");

    writeJsonl(join(aiDir, "tasks.jsonl"), [
      {
        schema: "stateforge.task/v1",
        id: taskId,
        title: "Initialize StateForge project state",
        status: "in-progress",
        createdAt: now,
        updatedAt: now,
        notes: ["Created the canonical .ai/ project state directory."]
      }
    ]);
    created.push(".ai/tasks.jsonl");

    writeJsonl(join(aiDir, "decisions.jsonl"), [
      {
        schema: "stateforge.decision/v1",
        id: makeId("decision", "git-source-of-truth", new Set()),
        title: "Use Git as the persistent source of truth",
        status: "accepted",
        rationale: "StateForge state must travel with the repository and remain reviewable in normal commits.",
        impact: "All canonical project state is stored under .ai/ with no embeddings, vector database, external memory service, or backend.",
        createdAt: now
      }
    ]);
    created.push(".ai/decisions.jsonl");
  }

  createIfMissing(root, ".ai/README.md", AI_README, created);
  createIfMissing(root, ".ai/SPEC.md", AI_SPEC, created);
  createIfMissing(root, ".ai/AGENT_PROTOCOL.md", AGENT_PROTOCOL, created);

  if (options.installAgentInstructions !== false) {
    createIfMissing(root, "AGENTS.md", ROOT_AGENT_INSTRUCTIONS, created);
    createIfMissing(root, "CLAUDE.md", CLAUDE_INSTRUCTIONS, created);
    createIfMissing(root, "GEMINI.md", GEMINI_INSTRUCTIONS, created);
    createIfMissing(root, ".github/copilot-instructions.md", COPILOT_INSTRUCTIONS, created);
    createIfMissing(root, ".cursor/rules/stateforge.mdc", CURSOR_INSTRUCTIONS, created);
    createIfMissing(root, ".windsurfrules", WINDSURF_INSTRUCTIONS, created);
  }

  syncMarkdownFiles(root);

  return { root, created, alreadyInitialized };
}

export function getProjectStatus(startDir: string): ProjectStatus {
  const root = requireGitRoot(startDir);
  const state = loadState(root);
  const tasks = readJsonl<TaskRecord>(join(root, AI_DIR, "tasks.jsonl"));
  const decisions = readJsonl<DecisionRecord>(join(root, AI_DIR, "decisions.jsonl"));
  const latestHandoff = readLatestHandoff(root);

  return {
    root,
    state,
    tasks,
    decisions,
    latestHandoff,
    git: readGitStatus(root)
  };
}

export function validateState(startDir: string): ValidationResult {
  const root = requireGitRoot(startDir);
  const errors: string[] = [];
  const warnings: string[] = [];

  requirePath(root, ".ai", "directory", errors);
  requirePath(root, ".ai/state.json", "file", errors);
  requirePath(root, ".ai/tasks.jsonl", "file", errors);
  requirePath(root, ".ai/decisions.jsonl", "file", errors);
  requirePath(root, ".ai/handoffs", "directory", errors);
  requirePath(root, ".ai/SPEC.md", "file", errors);
  requirePath(root, ".ai/AGENT_PROTOCOL.md", "file", errors);

  requirePath(root, ".ai/PROJECT.md", "file", errors);
  requirePath(root, ".ai/STATE.md", "file", errors);
  requirePath(root, ".ai/TASK.md", "file", errors);
  requirePath(root, ".ai/DECISIONS.md", "file", errors);
  requirePath(root, ".ai/HANDOFF.md", "file", errors);

  const state = readJsonForValidation(join(root, AI_DIR, "state.json"), ".ai/state.json", errors);
  const taskRecords = readJsonlForValidation(join(root, AI_DIR, "tasks.jsonl"), ".ai/tasks.jsonl", errors);
  const decisionRecords = readJsonlForValidation(join(root, AI_DIR, "decisions.jsonl"), ".ai/decisions.jsonl", errors);
  const taskIds = validateTaskRecords(taskRecords, errors);

  validateDecisionRecords(decisionRecords, errors);
  validateStateDocument(root, state, taskIds, errors, warnings);

  return {
    root,
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function listTasks(startDir: string): TaskRecord[] {
  const root = requireGitRoot(startDir);
  ensureInitialized(root);
  return readJsonl<TaskRecord>(join(root, AI_DIR, "tasks.jsonl"));
}

export function createTask(
  startDir: string,
  options: { title: string; status?: TaskStatus; active?: boolean; note?: string }
): TaskRecord {
  const root = requireGitRoot(startDir);
  const state = loadState(root);
  const tasksPath = join(root, AI_DIR, "tasks.jsonl");
  const tasks = readJsonl<TaskRecord>(tasksPath);
  const now = nowIso();
  const task: TaskRecord = {
    schema: "stateforge.task/v1",
    id: makeId("task", options.title, new Set(tasks.map((item) => item.id))),
    title: options.title,
    status: options.status ?? "todo",
    createdAt: now,
    updatedAt: now,
    notes: options.note ? [options.note] : []
  };

  tasks.push(task);
  writeJsonl(tasksPath, tasks);

  if (options.active || task.status === "in-progress") {
    state.current.activeTask = task.id;
    state.current.status = task.status === "blocked" ? "blocked" : "active";
  }

  state.updatedAt = now;
  saveState(root, state);
  syncMarkdownFiles(root);
  return task;
}

export function updateTaskStatus(
  startDir: string,
  taskId: string,
  status: TaskStatus
): TaskRecord {
  const root = requireGitRoot(startDir);
  const state = loadState(root);
  const tasksPath = join(root, AI_DIR, "tasks.jsonl");
  const tasks = readJsonl<TaskRecord>(tasksPath);
  const task = tasks.find((item) => item.id === taskId);

  if (!task) {
    throw new StateForgeError(`No task found with id ${taskId}.`);
  }

  const now = nowIso();
  task.status = status;
  task.updatedAt = now;

  if (status === "in-progress") {
    state.current.activeTask = task.id;
    state.current.status = "active";
  } else if (status === "blocked") {
    state.current.activeTask = task.id;
    state.current.status = "blocked";
  } else if (state.current.activeTask === task.id && status === "done") {
    state.current.activeTask = null;
    state.current.status = "active";
  }

  state.updatedAt = now;
  writeJsonl(tasksPath, tasks);
  saveState(root, state);
  syncMarkdownFiles(root);
  return task;
}

export function listDecisions(startDir: string): DecisionRecord[] {
  const root = requireGitRoot(startDir);
  ensureInitialized(root);
  return readJsonl<DecisionRecord>(join(root, AI_DIR, "decisions.jsonl"));
}

export function recordDecision(
  startDir: string,
  options: {
    title: string;
    rationale: string;
    impact?: string;
    status?: DecisionStatus;
  }
): DecisionRecord {
  const root = requireGitRoot(startDir);
  const state = loadState(root);
  const decisionsPath = join(root, AI_DIR, "decisions.jsonl");
  const decisions = readJsonl<DecisionRecord>(decisionsPath);
  const decision: DecisionRecord = {
    schema: "stateforge.decision/v1",
    id: makeId("decision", options.title, new Set(decisions.map((item) => item.id))),
    title: options.title,
    status: options.status ?? "accepted",
    rationale: options.rationale,
    impact: options.impact && options.impact.trim().length > 0 ? options.impact : "Recorded decision.",
    createdAt: nowIso()
  };

  decisions.push(decision);
  writeJsonl(decisionsPath, decisions);
  state.updatedAt = decision.createdAt;
  saveState(root, state);
  syncMarkdownFiles(root);
  return decision;
}

export function createHandoff(
  startDir: string,
  options: {
    summary: string;
    next?: string;
    notes?: string;
    recipient?: string;
    doNotRepeat?: string;
    filesChanged?: string[];
  }
): HandoffRecord {
  const root = requireGitRoot(startDir);
  const state = loadState(root);
  const tasks = readJsonl<TaskRecord>(join(root, AI_DIR, "tasks.jsonl"));
  const decisions = readJsonl<DecisionRecord>(join(root, AI_DIR, "decisions.jsonl"));
  const now = nowIso();
  const fileName = `${compactDate(now)}-${slugify(options.summary)}.md`;
  const handoffPath = join(root, AI_DIR, "handoffs", fileName);
  const activeTask = tasks.find((task) => task.id === state.current.activeTask);
  const recentDecisions = decisions.slice(-5);
  const gitStatus = readGitStatus(root);

  const filesList = options.filesChanged && options.filesChanged.length > 0
    ? options.filesChanged
    : (gitStatus.summary !== "clean" ? gitStatus.summary.split("\n").map(s => s.trim()) : ["none"]);

  const content = [
    `# Handoff: ${options.summary}`,
    "",
    `Generated: ${now}`,
    `Project: ${state.project.name}`,
    `Previous Agent: ${state.current.lastAgent ?? "generic"}`,
    options.recipient ? `Recipient: ${options.recipient}` : null,
    "",
    "## Current State",
    "",
    `- Project status: ${state.current.status}`,
    `- Active task: ${activeTask ? `${activeTask.id} - ${activeTask.title}` : "none"}`,
    `- Canonical state path: ${state.sourceOfTruth.canonicalPath}`,
    "",
    "## Recent Decisions",
    "",
    ...formatDecisionBullets(recentDecisions),
    "",
    "## Files Changed",
    "",
    ...filesList.map(f => `- ${f}`),
    "",
    "## Do Not Repeat",
    "",
    options.doNotRepeat ?? "- Re-investigating established project architecture or completed decision rationale.",
    "",
    "## Next Step",
    "",
    options.next ?? "Review .ai/tasks.jsonl and continue the active task.",
    "",
    "## Notes",
    "",
    options.notes ?? "No additional notes recorded.",
    ""
  ].filter((line): line is string => line !== null);

  writeFileSync(handoffPath, content.join("\n"));
  const relPath = relative(root, handoffPath);
  state.current.lastHandoff = relPath;
  if (options.recipient) {
    state.current.lastAgent = options.recipient;
  }
  state.updatedAt = now;
  saveState(root, state);
  syncMarkdownFiles(root);

  return {
    path: relPath,
    title: options.summary,
    updatedAt: now
  };
}

export function compileContext(
  startDir: string,
  options: CompileContextOptions = {}
): CompiledContextResult {
  const root = requireGitRoot(startDir);
  ensureInitialized(root);
  syncMarkdownFiles(root);

  const targetAgent = options.agent ?? "generic";
  const budget = options.budget ?? 4000;
  const charBudget = budget * 4;

  const projectMd = safeReadText(join(root, AI_DIR, "PROJECT.md"));
  const stateMd = safeReadText(join(root, AI_DIR, "STATE.md"));
  const taskMd = safeReadText(join(root, AI_DIR, "TASK.md"));
  const decisionsMd = safeReadText(join(root, AI_DIR, "DECISIONS.md"));
  const handoffMd = safeReadText(join(root, AI_DIR, "HANDOFF.md"));

  const sections = [
    `# STATEFORGE COMPILED CONTEXT FOR ${targetAgent.toUpperCase()}`,
    `# Target Agent: ${targetAgent}`,
    `# Generated: ${nowIso()}`,
    "",
    "--- SECTION: PROJECT IDENTITY ---",
    projectMd,
    "",
    "--- SECTION: CURRENT STATE ---",
    stateMd,
    "",
    "--- SECTION: ACTIVE TASK ---",
    taskMd,
    "",
    "--- SECTION: RECENT DECISIONS ---",
    decisionsMd,
    "",
    "--- SECTION: LATEST HANDOFF (DO NOT REPEAT) ---",
    handoffMd
  ];

  let fullText = sections.join("\n");
  if (fullText.length > charBudget) {
    fullText = fullText.slice(0, charBudget) + "\n\n[... Context truncated to fit budget ...]";
  }

  const tokenEstimate = Math.ceil(fullText.length / 4);

  return {
    root,
    targetAgent,
    tokenEstimate,
    compiledText: fullText
  };
}

export function syncState(startDir: string): SyncResult {
  const root = requireGitRoot(startDir);
  ensureInitialized(root);

  const git = readGitStatus(root);
  const recommendations: string[] = [];
  const untrackedStateChanges: string[] = [];

  if (git.clean === false) {
    const lines = git.summary.split("\n").map((l) => l.trim()).filter(Boolean);
    untrackedStateChanges.push(...lines);
    recommendations.push("Source files have uncommitted changes. Run stateforge handoff to record progress before switching agents.");
  }

  const latestHandoff = readLatestHandoff(root);
  if (!latestHandoff) {
    recommendations.push("No handoffs exist. Run stateforge handoff to create your first checkpoint.");
  }

  return {
    root,
    inSync: untrackedStateChanges.length === 0,
    gitClean: git.clean ?? true,
    untrackedStateChanges,
    recommendations
  };
}

export function switchAgent(
  startDir: string,
  targetAgent: string,
  options: { next?: string; notes?: string; doNotRepeat?: string } = {}
): { handoff: HandoffRecord; compiled: CompiledContextResult } {
  const root = requireGitRoot(startDir);
  ensureInitialized(root);

  const handoff = createHandoff(root, {
    summary: `Switching to ${targetAgent}`,
    recipient: targetAgent,
    next: options.next,
    notes: options.notes,
    doNotRepeat: options.doNotRepeat
  });

  const state = loadState(root);
  state.current.lastAgent = targetAgent;
  saveState(root, state);
  syncMarkdownFiles(root);

  const compiled = compileContext(root, { agent: targetAgent });

  return { handoff, compiled };
}

export function syncMarkdownFiles(root: string): void {
  const aiDir = join(root, AI_DIR);
  if (!existsSync(join(aiDir, "state.json"))) {
    return;
  }

  const state = loadState(root);
  const tasks = readJsonl<TaskRecord>(join(aiDir, "tasks.jsonl"));
  const decisions = readJsonl<DecisionRecord>(join(aiDir, "decisions.jsonl"));
  const latestHandoff = readLatestHandoff(root);

  const activeTask = tasks.find((t) => t.id === state.current.activeTask);
  const completedTasks = tasks.filter((t) => t.status === "done");
  const openTasks = tasks.filter((t) => t.status !== "done");
  const blockedTasks = tasks.filter((t) => t.status === "blocked");

  // Write PROJECT.md
  const projectContent = [
    "# Project Identity",
    "",
    "## Name",
    state.project.name,
    "",
    "## Purpose",
    state.project.summary,
    "",
    "## Repository",
    state.project.repository ?? "local",
    "",
    "## Canonical State Path",
    ".ai/",
    "",
    "## Core Principles",
    "- The AI agent is disposable. The project state is persistent.",
    "- Git is the source of truth for code and AI project state.",
    "- Human-readable first, machine-readable second.",
    "- No external vector databases, embeddings, or cloud backends."
  ].join("\n");
  writeFileSync(join(aiDir, "PROJECT.md"), `${projectContent}\n`);

  // Write STATE.md
  const stateContent = [
    "# Current Project State",
    "",
    `## Project: ${state.project.name}`,
    `## Status: ${state.current.status}`,
    `## Last Agent: ${state.current.lastAgent ?? "generic"}`,
    `## Active Task: ${activeTask ? `${activeTask.id} - ${activeTask.title}` : "none"}`,
    `## Last Handoff: ${state.current.lastHandoff ?? "none"}`,
    "",
    "## Active Work",
    activeTask ? `- Task ${activeTask.id}: ${activeTask.title}` : "- No active task selected.",
    "",
    "## Completed Work",
    completedTasks.length > 0
      ? completedTasks.map((t) => `- [x] ${t.id}: ${t.title}`).join("\n")
      : "- none",
    "",
    "## Open Tasks",
    openTasks.length > 0
      ? openTasks.map((t) => `- [ ] ${t.id} [${t.status}]: ${t.title}`).join("\n")
      : "- none",
    "",
    "## Known Problems",
    blockedTasks.length > 0
      ? blockedTasks.map((t) => `- [!] ${t.id}: ${t.title}`).join("\n")
      : "- none",
    "",
    "## Recommended Next Action",
    activeTask ? `Continue working on task ${activeTask.id}.` : "Select an open task or use stateforge task to create one."
  ].join("\n");
  writeFileSync(join(aiDir, "STATE.md"), `${stateContent}\n`);

  // Write TASK.md
  const taskContent = [
    "# Active Task",
    "",
    activeTask
      ? [
          `## Task ID: ${activeTask.id}`,
          `## Title: ${activeTask.title}`,
          `## Status: ${activeTask.status}`,
          `## Created: ${activeTask.createdAt}`,
          `## Updated: ${activeTask.updatedAt}`,
          "",
          "## Notes",
          activeTask.notes.length > 0
            ? activeTask.notes.map((n) => `- ${n}`).join("\n")
            : "- No specific notes recorded."
        ].join("\n")
      : "No active task currently selected."
  ].join("\n");
  writeFileSync(join(aiDir, "TASK.md"), `${taskContent}\n`);

  // Write DECISIONS.md
  const decisionBlocks = decisions.map((d) => {
    return [
      `## ${d.id}: ${d.title}`,
      "",
      `- **Status**: ${d.status}`,
      `- **Rationale**: ${d.rationale}`,
      `- **Impact**: ${d.impact}`,
      `- **Date**: ${d.createdAt}`
    ].join("\n");
  });

  const decisionsContent = [
    "# Architecture Decisions Log",
    "",
    "This log records architectural and technical decisions made for this project.",
    "",
    decisionBlocks.length > 0 ? decisionBlocks.join("\n\n---\n\n") : "No decisions recorded yet."
  ].join("\n");
  writeFileSync(join(aiDir, "DECISIONS.md"), `${decisionsContent}\n`);

  // Write HANDOFF.md
  let handoffContent = "No handoffs generated yet.";
  if (latestHandoff && existsSync(join(root, latestHandoff.path))) {
    handoffContent = readFileSync(join(root, latestHandoff.path), "utf8");
  }
  writeFileSync(join(aiDir, "HANDOFF.md"), `${handoffContent}\n`);
}

function requireGitRoot(startDir: string): string {
  const root = findGitRoot(startDir);
  if (!root) {
    throw new StateForgeError("No Git repository found. StateForge state must live in a Git repo.");
  }

  return root;
}

function requirePath(root: string, relativePath: string, expected: "file" | "directory", errors: string[]): void {
  const path = join(root, relativePath);
  if (!existsSync(path)) {
    errors.push(`Missing required ${expected}: ${relativePath}`);
    return;
  }

  const stats = statSync(path);
  const valid = expected === "file" ? stats.isFile() : stats.isDirectory();
  if (!valid) {
    errors.push(`Expected ${relativePath} to be a ${expected}.`);
  }
}

function ensureInitialized(root: string): void {
  if (!existsSync(join(root, AI_DIR, "state.json"))) {
    throw new StateForgeError("StateForge is not initialized. Run stateforge init first.");
  }
}

function loadState(root: string): StateForgeState {
  ensureInitialized(root);
  return JSON.parse(readFileSync(join(root, AI_DIR, "state.json"), "utf8")) as StateForgeState;
}

function saveState(root: string, state: StateForgeState): void {
  writeJson(join(root, AI_DIR, "state.json"), state);
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) {
    return [];
  }

  const text = readFileSync(path, "utf8").trim();
  if (!text) {
    return [];
  }

  return text.split(/\r?\n/).map((line, index) => {
    try {
      return JSON.parse(line) as T;
    } catch (error) {
      throw new StateForgeError(`Invalid JSONL in ${path} at line ${index + 1}.`);
    }
  });
}

function readJsonForValidation(path: string, label: string, errors: string[]): unknown {
  if (!existsSync(path)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    errors.push(`Invalid JSON in ${label}.`);
    return null;
  }
}

function readJsonlForValidation(path: string, label: string, errors: string[]): unknown[] {
  if (!existsSync(path)) {
    return [];
  }

  const text = readFileSync(path, "utf8").trim();
  if (!text) {
    return [];
  }

  const records: unknown[] = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    try {
      records.push(JSON.parse(line) as unknown);
    } catch {
      errors.push(`Invalid JSON in ${label} line ${index + 1}.`);
    }
  }

  return records;
}

function validateStateDocument(
  root: string,
  value: unknown,
  taskIds: Set<string>,
  errors: string[],
  warnings: string[]
): void {
  if (!isRecord(value)) {
    errors.push(".ai/state.json must be a JSON object.");
    return;
  }

  requireLiteral(value, "schema", "stateforge.state/v1", ".ai/state.json", errors);
  requireString(value, "stateforgeVersion", ".ai/state.json", errors);

  const project = requireRecord(value, "project", ".ai/state.json", errors);
  if (project) {
    requireString(project, "name", ".ai/state.json project", errors);
    requireString(project, "summary", ".ai/state.json project", errors);
    requireNullableString(project, "repository", ".ai/state.json project", errors);
  }

  const sourceOfTruth = requireRecord(value, "sourceOfTruth", ".ai/state.json", errors);
  if (sourceOfTruth) {
    requireLiteral(sourceOfTruth, "type", "git", ".ai/state.json sourceOfTruth", errors);
    requireLiteral(sourceOfTruth, "canonicalPath", ".ai/", ".ai/state.json sourceOfTruth", errors);
    requireLiteral(sourceOfTruth, "externalMemory", false, ".ai/state.json sourceOfTruth", errors);
  }

  const current = requireRecord(value, "current", ".ai/state.json", errors);
  if (current) {
    requireOneOf(current, "status", ["active", "paused", "blocked"], ".ai/state.json current", errors);
    const activeTask = requireNullableString(current, "activeTask", ".ai/state.json current", errors);
    const lastHandoff = requireNullableString(current, "lastHandoff", ".ai/state.json current", errors);

    if (activeTask && !taskIds.has(activeTask)) {
      errors.push(`Active task ${activeTask} is not present in .ai/tasks.jsonl.`);
    }

    if (lastHandoff) {
      if (!lastHandoff.startsWith(".ai/handoffs/") || !lastHandoff.endsWith(".md")) {
        errors.push("current.lastHandoff must point to a Markdown file under .ai/handoffs/.");
      } else if (!existsSync(join(root, lastHandoff))) {
        errors.push(`current.lastHandoff points to a missing file: ${lastHandoff}`);
      }
    }
  }

  const updatedAt = requireString(value, "updatedAt", ".ai/state.json", errors);
  if (updatedAt && !isIsoTimestamp(updatedAt)) {
    errors.push(".ai/state.json updatedAt must be an ISO timestamp.");
  }

  if (taskIds.size === 0) {
    warnings.push("No tasks are recorded in .ai/tasks.jsonl.");
  }
}

function validateTaskRecords(records: unknown[], errors: string[]): Set<string> {
  const ids = new Set<string>();

  for (const [index, record] of records.entries()) {
    const label = `.ai/tasks.jsonl line ${index + 1}`;
    if (!isRecord(record)) {
      errors.push(`${label} must be a JSON object.`);
      continue;
    }

    requireLiteral(record, "schema", "stateforge.task/v1", label, errors);
    const id = requireString(record, "id", label, errors);
    requireString(record, "title", label, errors);
    requireOneOf(record, "status", ["todo", "in-progress", "blocked", "done"], label, errors);
    validateTimestampField(record, "createdAt", label, errors);
    validateTimestampField(record, "updatedAt", label, errors);
    requireStringArray(record, "notes", label, errors);

    if (id) {
      if (ids.has(id)) {
        errors.push(`Duplicate task id: ${id}`);
      }
      ids.add(id);
    }
  }

  return ids;
}

function validateDecisionRecords(records: unknown[], errors: string[]): void {
  const ids = new Set<string>();

  for (const [index, record] of records.entries()) {
    const label = `.ai/decisions.jsonl line ${index + 1}`;
    if (!isRecord(record)) {
      errors.push(`${label} must be a JSON object.`);
      continue;
    }

    requireLiteral(record, "schema", "stateforge.decision/v1", label, errors);
    const id = requireString(record, "id", label, errors);
    requireString(record, "title", label, errors);
    requireOneOf(record, "status", ["proposed", "accepted", "superseded"], label, errors);
    requireString(record, "rationale", label, errors);
    requireString(record, "impact", label, errors);
    validateTimestampField(record, "createdAt", label, errors);

    if (id) {
      if (ids.has(id)) {
        errors.push(`Duplicate decision id: ${id}`);
      }
      ids.add(id);
    }
  }
}

function validateTimestampField(
  record: Record<string, unknown>,
  field: string,
  label: string,
  errors: string[]
): void {
  const value = requireString(record, field, label, errors);
  if (value && !isIsoTimestamp(value)) {
    errors.push(`${label} ${field} must be an ISO timestamp.`);
  }
}

function requireRecord(
  record: Record<string, unknown>,
  field: string,
  label: string,
  errors: string[]
): Record<string, unknown> | null {
  const value = record[field];
  if (!isRecord(value)) {
    errors.push(`${label} ${field} must be an object.`);
    return null;
  }

  return value;
}

function requireString(
  record: Record<string, unknown>,
  field: string,
  label: string,
  errors: string[]
): string | null {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`${label} ${field} must be a non-empty string.`);
    return null;
  }

  return value;
}

function requireNullableString(
  record: Record<string, unknown>,
  field: string,
  label: string,
  errors: string[]
): string | null {
  const value = record[field];
  if (value === null) {
    return null;
  }

  if (typeof value !== "string" || value.length === 0) {
    errors.push(`${label} ${field} must be a non-empty string or null.`);
    return null;
  }

  return value;
}

function requireStringArray(
  record: Record<string, unknown>,
  field: string,
  label: string,
  errors: string[]
): void {
  const value = record[field];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    errors.push(`${label} ${field} must be an array of strings.`);
  }
}

function requireLiteral(
  record: Record<string, unknown>,
  field: string,
  expected: string | boolean,
  label: string,
  errors: string[]
): void {
  if (record[field] !== expected) {
    errors.push(`${label} ${field} must be ${JSON.stringify(expected)}.`);
  }
}

function requireOneOf(
  record: Record<string, unknown>,
  field: string,
  allowed: string[],
  label: string,
  errors: string[]
): void {
  const value = record[field];
  if (typeof value !== "string" || !allowed.includes(value)) {
    errors.push(`${label} ${field} must be one of ${allowed.join(", ")}.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: string): boolean {
  return value.includes("T") && !Number.isNaN(Date.parse(value));
}

function safeReadText(path: string): string {
  if (!existsSync(path)) return "(File not found)";
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return "(Error reading file)";
  }
}

function writeJsonl(path: string, records: unknown[]): void {
  writeFileSync(path, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeIfMissing(path: string, content: string): boolean {
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    return true;
  }

  return false;
}

function createIfMissing(root: string, relativePath: string, content: string, created: string[]): void {
  if (writeIfMissing(join(root, relativePath), content)) {
    created.push(relativePath);
  }
}

function readLatestHandoff(root: string): HandoffRecord | null {
  const handoffDir = join(root, AI_DIR, "handoffs");
  if (!existsSync(handoffDir)) {
    return null;
  }

  const markdownFiles = readdirSync(handoffDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const path = join(handoffDir, file);
      return { file, mtimeMs: statSync(path).mtimeMs };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  if (markdownFiles.length === 0) {
    return null;
  }

  const file = markdownFiles[0].file;
  const path = join(handoffDir, file);
  const firstLine = readFileSync(path, "utf8").split(/\r?\n/, 1)[0] ?? "";
  return {
    path: relative(root, path),
    title: firstLine.replace(/^#\s*/, "") || file,
    updatedAt: new Date(statSync(path).mtimeMs).toISOString()
  };
}

function readGitStatus(root: string): ProjectStatus["git"] {
  try {
    const output = execFileSync("git", ["status", "--short"], {
      cwd: root,
      encoding: "utf8"
    }).trim();

    return {
      clean: output.length === 0,
      summary: output.length === 0 ? "clean" : output
    };
  } catch {
    return {
      clean: null,
      summary: "unavailable"
    };
  }
}

function readOriginUrl(root: string): string | null {
  try {
    const output = execFileSync("git", ["config", "--get", "remote.origin.url"], {
      cwd: root,
      encoding: "utf8"
    }).trim();
    return output || null;
  } catch {
    return null;
  }
}

function formatDecisionBullets(decisions: DecisionRecord[]): string[] {
  if (decisions.length === 0) {
    return ["- none"];
  }

  return decisions.map((decision) => `- ${decision.id}: ${decision.title}`);
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string, title: string, existingIds: Set<string>): string {
  const base = `${prefix}-${compactDate(nowIso())}-${slugify(title)}`;
  let id = base;
  let index = 2;

  while (existingIds.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }

  return id;
}

function compactDate(iso: string): string {
  return iso.replace(/[-:.TZ]/g, "").slice(0, 17);
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

  return slug || "item";
}

const AI_README = `# .ai/

This directory is the canonical StateForge project state.

StateForge treats Git and GitHub as the durable source of truth. AI agents, IDEs, and coding tools are clients that read and update these files through normal commits and pull requests.

## Files

- \`PROJECT.md\`: Stable project identity, purpose, stack, and architecture.
- \`STATE.md\`: Current project state, active task, last agent, completed work, next action.
- \`TASK.md\`: Detailed active task objective, requirements, and notes.
- \`DECISIONS.md\`: Markdown log of architectural decisions.
- \`HANDOFF.md\`: Latest agent handoff note.
- \`state.json\`: Structured JSON metadata entry point.
- \`tasks.jsonl\`: Task records, one JSON object per line.
- \`decisions.jsonl\`: Decision records, one JSON object per line.
- \`handoffs/\`: Archived Markdown handoff notes.
- \`SPEC.md\`: On-disk format specification.
- \`AGENT_PROTOCOL.md\`: Instructions for agent interoperability.
`;

const AI_SPEC = `# StateForge .ai/ Specification

Version: 1

StateForge stores persistent AI project state inside the repository under \`.ai/\`. The repository is the source of truth. Git history, branches, reviews, and GitHub remotes provide synchronization and auditability.

## Principles

- Human-readable first, machine-readable second.
- Git/GitHub as durable storage.
- Treat IDEs and AI coding tools as clients.
- Do not require embeddings, vector databases, external memory services, or a separate backend.
- Keep records human-readable and diff-friendly.

## Canonical Files

- \`PROJECT.md\`: Stable project identity and constraints.
- \`STATE.md\`: Current active state summary.
- \`TASK.md\`: Active task specification.
- \`DECISIONS.md\`: Human & agent decision log.
- \`HANDOFF.md\`: Current handoff bridge note.
- \`state.json\`: Structured metadata.
- \`tasks.jsonl\`: Task log.
- \`decisions.jsonl\`: Decision log.
`;

const AGENT_PROTOCOL = `# StateForge Agent Protocol

These instructions are for any AI coding agent or IDE assistant working in this repository.

## Read Order

1. Read \`.ai/state.json\`.
2. Read \`.ai/PROJECT.md\`.
3. Read \`.ai/STATE.md\`.
4. Read \`.ai/TASK.md\`.
5. Read \`.ai/DECISIONS.md\`.
6. Read \`.ai/HANDOFF.md\`.
7. Read the latest file in \`.ai/handoffs/\` when present.

## Update Rules

- Keep canonical project state under \`.ai/\`.
- Use \`stateforge task\`, \`stateforge decision\`, \`stateforge handoff\`, \`stateforge sync\`, and \`stateforge switch\` when available.
- If the CLI is unavailable, edit \`.ai/\` files directly using the schemas in \`.ai/SPEC.md\`.
- Commit state changes with the code or documentation changes they describe.
- Do not store canonical StateForge state in a separate backend, memory service, vector database, or embedding index.

## Handoff Rule

Before stopping substantial work, create or update a handoff using \`stateforge handoff\` or \`stateforge switch <agent>\`.
`;

const ROOT_AGENT_INSTRUCTIONS = `# Agent Instructions

This repository uses StateForge for persistent AI project state.

Before making changes, read \`.ai/AGENT_PROTOCOL.md\`, then inspect \`.ai/PROJECT.md\`, \`.ai/STATE.md\`, \`.ai/TASK.md\`, \`.ai/DECISIONS.md\`, and \`.ai/HANDOFF.md\`.

Keep canonical project state under \`.ai/\`. Do not move it into an external memory service, vector database, embedding index, or separate backend.
`;

const CLAUDE_INSTRUCTIONS = `# Claude Instructions

This repository uses StateForge.

Read \`.ai/AGENT_PROTOCOL.md\` before starting work. The canonical project state is under \`.ai/\`, with \`.ai/STATE.md\` and \`.ai/state.json\` as key entry points.

Update tasks, decisions, and handoffs through the StateForge CLI when possible.
`;

const GEMINI_INSTRUCTIONS = `# Gemini Instructions

This repository uses StateForge for AI context portability.

Start with \`.ai/AGENT_PROTOCOL.md\`, then inspect \`.ai/STATE.md\`, \`.ai/TASK.md\`, \`.ai/DECISIONS.md\`, and \`.ai/HANDOFF.md\`.

Treat \`.ai/\` as canonical repository state.
`;

const COPILOT_INSTRUCTIONS = `# Copilot Instructions

This repository uses StateForge. Read \`.ai/AGENT_PROTOCOL.md\` before proposing changes.

Project state is canonical under \`.ai/\`. Keep task, decision, and handoff updates in Git with the code or documentation changes they describe.
`;

const CURSOR_INSTRUCTIONS = `---
description: StateForge project state protocol
globs:
  - "**/*"
alwaysApply: true
---

This repository uses StateForge for persistent AI project state.

Read \`.ai/AGENT_PROTOCOL.md\` before making changes. The canonical state lives under \`.ai/\`.

Do not use an external memory service, vector database, embedding index, or backend as the source of truth for StateForge state.
`;

const WINDSURF_INSTRUCTIONS = `This repository uses StateForge for persistent AI project state.

Read \`.ai/AGENT_PROTOCOL.md\` first. The canonical state lives under \`.ai/\`, especially \`.ai/STATE.md\`, \`.ai/TASK.md\`, \`.ai/DECISIONS.md\`, and \`.ai/HANDOFF.md\`.

Keep StateForge state changes in Git with the work they describe.
`;
