#!/usr/bin/env node
// SessionStart hook: surface verified factory state so an interrupted task is
// resumed from the actual repository, not from memory. Prints context to stdout.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const r = spawnSync(process.execPath, [fileURLToPath(new URL("./factory.mjs", import.meta.url)), "status"], { encoding: "utf8" });
const text = (r.stdout || "").trim();
if (text && !text.includes("No factory tasks yet.")) {
  console.log(`[factory] Verified task state (re-checked against git just now):\n${text}\nResume open tasks with /factory-status; never trust a past "done" without gate evidence.`);
}
