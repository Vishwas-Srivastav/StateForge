#!/usr/bin/env node
import {
  compileContext,
  createHandoff,
  createTask,
  getProjectStatus,
  initializeState,
  listDecisions,
  listTasks,
  recordDecision,
  StateForgeError,
  switchAgent,
  syncState,
  updateTaskStatus,
  validateState
} from "./core.ts";
import type {
  DecisionRecord,
  DecisionStatus,
  ProjectStatus,
  TaskRecord,
  TaskStatus,
  ValidationResult
} from "./core.ts";

type FlagValue = string | boolean;

interface ParsedArgs {
  command: string;
  positionals: string[];
  flags: Record<string, FlagValue>;
}

const HELP = `StateForge

Git-native persistent project state for AI coding agents.

Usage:
  stateforge init [--name <name>] [--summary <summary>] [--no-agent-files]
  stateforge status
  stateforge validate
  stateforge sync
  stateforge task [title] [--status todo|in-progress|blocked|done] [--active] [--note <note>]
  stateforge task --list
  stateforge task --start <task-id>
  stateforge task --done <task-id>
  stateforge task --block <task-id>
  stateforge decision [title] --rationale <text> [--impact <text>] [--status accepted|proposed|superseded]
  stateforge decision --list
  stateforge handoff [summary] [--to <agent>] [--next <step>] [--notes <notes>] [--do-not-repeat <text>]
  stateforge switch <agent> [--next <step>] [--notes <notes>] [--do-not-repeat <text>]
  stateforge compile [--budget <tokens>] [--agent <agent>]

Examples:
  stateforge init --name StateForge
  stateforge validate
  stateforge task "Add context compiler" --status in-progress --active
  stateforge decision "Keep state in Git" --rationale "Commits are reviewable and portable."
  stateforge handoff "CLI MVP ready" --to codex --next "Implement switch command."
  stateforge switch codex --next "Review compiled context."
  stateforge compile --budget 3000 --agent cursor
`;

function main(argv: string[]): void {
  const args = parseArgs(argv);

  switch (args.command) {
    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      return;
    case "init":
      runInit(args);
      return;
    case "status":
      runStatus();
      return;
    case "validate":
      runValidate();
      return;
    case "sync":
      runSync();
      return;
    case "task":
      runTask(args);
      return;
    case "decision":
      runDecision(args);
      return;
    case "handoff":
      runHandoff(args);
      return;
    case "switch":
      runSwitch(args);
      return;
    case "compile":
    case "context":
      runCompile(args);
      return;
    default:
      if (!args.command) {
        console.log(HELP);
        return;
      }

      throw new StateForgeError(`Unknown command: ${args.command}`);
  }
}

function runInit(args: ParsedArgs): void {
  const result = initializeState(process.cwd(), {
    projectName: readStringFlag(args.flags, "name"),
    summary: readStringFlag(args.flags, "summary"),
    installAgentInstructions: !hasFlag(args.flags, "no-agent-files")
  });

  if (result.alreadyInitialized) {
    console.log(`StateForge is already initialized at ${result.root}/.ai`);
    for (const file of result.created) {
      console.log(`created ${file}`);
    }
    return;
  }

  console.log(`Initialized StateForge at ${result.root}/.ai`);
  for (const file of result.created) {
    console.log(`created ${file}`);
  }
}

function runStatus(): void {
  console.log(formatStatus(getProjectStatus(process.cwd())));
}

function runValidate(): void {
  const result = validateState(process.cwd());
  console.log(formatValidation(result));

  if (!result.valid) {
    process.exitCode = 1;
  }
}

function runSync(): void {
  const result = syncState(process.cwd());
  console.log(`Root: ${result.root}`);
  console.log(`In Sync: ${result.inSync ? "YES" : "NO"}`);
  console.log(`Git Status: ${result.gitClean ? "clean" : "modified files present"}`);

  if (result.untrackedStateChanges.length > 0) {
    console.log("\nUncommitted / Untracked Changes:");
    for (const file of result.untrackedStateChanges) {
      console.log(`- ${file}`);
    }
  }

  if (result.recommendations.length > 0) {
    console.log("\nRecommendations:");
    for (const rec of result.recommendations) {
      console.log(`- ${rec}`);
    }
  }
}

function runTask(args: ParsedArgs): void {
  const doneId = readStringFlag(args.flags, "done");
  const startId = readStringFlag(args.flags, "start");
  const blockId = readStringFlag(args.flags, "block");

  if (doneId) {
    console.log(formatTaskChange(updateTaskStatus(process.cwd(), doneId, "done")));
    return;
  }

  if (startId) {
    console.log(formatTaskChange(updateTaskStatus(process.cwd(), startId, "in-progress")));
    return;
  }

  if (blockId) {
    console.log(formatTaskChange(updateTaskStatus(process.cwd(), blockId, "blocked")));
    return;
  }

  if (hasFlag(args.flags, "list") || args.positionals.length === 0) {
    console.log(formatTasks(listTasks(process.cwd())));
    return;
  }

  const status = parseTaskStatus(readStringFlag(args.flags, "status") ?? "todo");
  const task = createTask(process.cwd(), {
    title: args.positionals.join(" "),
    status,
    active: hasFlag(args.flags, "active"),
    note: readStringFlag(args.flags, "note")
  });

  console.log(`Created task ${task.id}`);
}

function runDecision(args: ParsedArgs): void {
  if (hasFlag(args.flags, "list") || args.positionals.length === 0) {
    console.log(formatDecisions(listDecisions(process.cwd())));
    return;
  }

  const rationale = readStringFlag(args.flags, "rationale") ?? readStringFlag(args.flags, "why");
  if (!rationale) {
    throw new StateForgeError("decision requires --rationale <text>.");
  }

  const decision = recordDecision(process.cwd(), {
    title: args.positionals.join(" "),
    rationale,
    impact: readStringFlag(args.flags, "impact"),
    status: parseDecisionStatus(readStringFlag(args.flags, "status") ?? "accepted")
  });

  console.log(`Recorded decision ${decision.id}`);
}

function runHandoff(args: ParsedArgs): void {
  const handoff = createHandoff(process.cwd(), {
    summary: args.positionals.join(" ") || readStringFlag(args.flags, "summary") || "Project handoff",
    recipient: readStringFlag(args.flags, "to"),
    next: readStringFlag(args.flags, "next"),
    notes: readStringFlag(args.flags, "notes"),
    doNotRepeat: readStringFlag(args.flags, "do-not-repeat")
  });

  console.log(`Created handoff ${handoff.path}`);
}

function runSwitch(args: ParsedArgs): void {
  const targetAgent = args.positionals[0] || readStringFlag(args.flags, "to");
  if (!targetAgent) {
    throw new StateForgeError("switch command requires target agent name, e.g. `stateforge switch codex`.");
  }

  const result = switchAgent(process.cwd(), targetAgent, {
    next: readStringFlag(args.flags, "next"),
    notes: readStringFlag(args.flags, "notes"),
    doNotRepeat: readStringFlag(args.flags, "do-not-repeat")
  });

  console.log(`Switched active agent context to ${targetAgent}`);
  console.log(`Created handoff ${result.handoff.path}`);
  console.log(`Compiled context ready (~${result.compiled.tokenEstimate} tokens)`);
}

function runCompile(args: ParsedArgs): void {
  const budgetRaw = readStringFlag(args.flags, "budget");
  const budget = budgetRaw ? parseInt(budgetRaw, 10) : 4000;
  const agent = readStringFlag(args.flags, "agent") || args.positionals[0] || "generic";

  const result = compileContext(process.cwd(), { budget, agent });
  console.log(`Token estimate: ~${result.tokenEstimate} tokens\n`);
  console.log(result.compiledText);
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "", ...rest] = argv;
  const flags: Record<string, FlagValue> = {};
  const positionals: string[] = [];

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];

    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }

    const flag = value.slice(2);
    const next = rest[index + 1];

    if (next && !next.startsWith("--")) {
      flags[flag] = next;
      index += 1;
    } else {
      flags[flag] = true;
    }
  }

  return { command, positionals, flags };
}

function readStringFlag(flags: Record<string, FlagValue>, name: string): string | undefined {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

function hasFlag(flags: Record<string, FlagValue>, name: string): boolean {
  return flags[name] === true;
}

function parseTaskStatus(value: string): TaskStatus {
  if (value === "todo" || value === "in-progress" || value === "blocked" || value === "done") {
    return value;
  }

  throw new StateForgeError(`Invalid task status: ${value}`);
}

function parseDecisionStatus(value: string): DecisionStatus {
  if (value === "proposed" || value === "accepted" || value === "superseded") {
    return value;
  }

  throw new StateForgeError(`Invalid decision status: ${value}`);
}

function formatStatus(status: ProjectStatus): string {
  const activeTask = status.tasks.find((task) => task.id === status.state.current.activeTask);
  const openTasks = status.tasks.filter((task) => task.status !== "done").length;
  const doneTasks = status.tasks.filter((task) => task.status === "done").length;

  return [
    "StateForge status",
    "",
    `Project: ${status.state.project.name}`,
    `Summary: ${status.state.project.summary}`,
    `Root: ${status.root}`,
    `Canonical state: ${status.state.sourceOfTruth.canonicalPath}`,
    `Current status: ${status.state.current.status}`,
    `Last Agent: ${status.state.current.lastAgent ?? "generic"}`,
    `Active task: ${activeTask ? `${activeTask.id} - ${activeTask.title}` : "none"}`,
    `Tasks: ${openTasks} open, ${doneTasks} done`,
    `Decisions: ${status.decisions.length}`,
    `Latest handoff: ${status.latestHandoff?.path ?? "none"}`,
    `Git: ${status.git.clean === false ? "changes present" : status.git.summary}`
  ].join("\n");
}

function formatValidation(result: ValidationResult): string {
  const lines = [
    result.valid ? "StateForge validation passed" : "StateForge validation failed",
    "",
    `Root: ${result.root}`,
    `Errors: ${result.errors.length}`,
    `Warnings: ${result.warnings.length}`
  ];

  if (result.errors.length > 0) {
    lines.push("", "Errors", "", ...result.errors.map((error) => `- ${error}`));
  }

  if (result.warnings.length > 0) {
    lines.push("", "Warnings", "", ...result.warnings.map((warning) => `- ${warning}`));
  }

  return lines.join("\n");
}

function formatTasks(tasks: TaskRecord[]): string {
  if (tasks.length === 0) {
    return "No tasks recorded.";
  }

  return [
    "Tasks",
    "",
    ...tasks.map((task) => `${task.id} [${task.status}] ${task.title}`)
  ].join("\n");
}

function formatTaskChange(task: TaskRecord): string {
  return `Updated task ${task.id} to ${task.status}`;
}

function formatDecisions(decisions: DecisionRecord[]): string {
  if (decisions.length === 0) {
    return "No decisions recorded.";
  }

  return [
    "Decisions",
    "",
    ...decisions.map((decision) => `${decision.id} [${decision.status}] ${decision.title}`)
  ].join("\n");
}

try {
  main(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`StateForge: ${message}`);
  process.exitCode = 1;
}
