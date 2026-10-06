#!/usr/bin/env node
// PreToolUse guard for the qa-verifier agent: Write may only create evidence
// under the git-ignored work/qa/ directory. Exit code 2 blocks the call and
// returns stderr to the agent. Bash is not constrained by this hook; the
// agent's instructions forbid using it to modify tracked files.
import path from "node:path";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let input;
try {
  input = JSON.parse(raw);
} catch {
  console.error("qa-write-guard: could not parse hook input; blocking Write.");
  process.exit(2);
}

const root = path.resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
const target = String(input?.tool_input?.file_path ?? "");
const resolved = path.resolve(root, target);
const allowed = path.join(root, "work", "qa") + path.sep;

if (!target || !resolved.startsWith(allowed)) {
  console.error(
    `qa-verifier may only write evidence under work/qa/ (got "${target}"). ` +
      "Report the defect to the Lead instead of editing project files.",
  );
  process.exit(2);
}
process.exit(0);
