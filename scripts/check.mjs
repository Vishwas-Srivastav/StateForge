#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const tscPath = join(root, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");

run("npm", ["test"]);

if (existsSync(tscPath)) {
  run("npm", ["run", "typecheck"]);
} else {
  console.log("Skipping typecheck because dev dependencies are not installed.");
}

run(process.execPath, ["--experimental-strip-types", "src/cli.ts", "--help"]);
run(process.execPath, ["--experimental-strip-types", "src/cli.ts", "status"]);
run(process.execPath, ["--experimental-strip-types", "src/cli.ts", "validate"]);
run(process.execPath, ["--experimental-strip-types", "src/cli.ts", "sync"]);
run(process.execPath, ["--experimental-strip-types", "src/cli.ts", "compile", "--budget", "1000"]);

function run(command, args) {
  console.log(`\n> ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
