#!/usr/bin/env node
// PreToolUse guard for the AI software factory. Enforces the hard boundaries
// (no merge/deploy/force-push/default-branch commits, no secrets, protected
// paths) in code, regardless of permission mode. Exit 2 blocks and returns
// stderr to the model.   Usage: factory-guard.mjs [--write-scope work/factory]
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

let raw = "";
for await (const c of process.stdin) raw += c;
let input;
try { input = JSON.parse(raw); } catch { console.error("factory-guard: unparseable hook input; blocking."); process.exit(2); }

const root = path.resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
const tool = input.tool_name || "";
const ti = input.tool_input || {};
const scopeArg = process.argv.indexOf("--write-scope");
const writeScope = scopeArg > -1 ? process.argv[scopeArg + 1] : null;

let project = {};
try { project = JSON.parse(fs.readFileSync(path.join(root, ".factory", "project.json"), "utf8")); } catch {}
const defaultBranch = project.defaultBranch || "main";
const protectedBranches = new Set([defaultBranch, "main", "master", "production", "prod", ...(project.protectedBranches || [])]);

const deny = (why) => {
  console.error(`factory-guard: BLOCKED — ${why}\nThis is a standing project boundary (see .factory/README.md). Do not work around it; report it to the Director/user as a decision needed.`);
  process.exit(2);
};

const globRe = (g) => {
  let re = "";
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*") { if (g[i + 1] === "*") { re += ".*"; i++; if (g[i + 1] === "/") i++; } else re += "[^/]*"; }
    else re += c.replace(/[.+^${}()|[\]\\?]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
};
const git = (...a) => (spawnSync("git", a, { cwd: root, encoding: "utf8" }).stdout || "").trim();

const SECRET_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{20,}/, /ghp_[A-Za-z0-9]{30,}/, /github_pat_[A-Za-z0-9_]{30,}/, /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, /sbp_[a-f0-9]{30,}/, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
];

// Heredoc bodies that are only written to a file (cat/tee) are data, not commands, so tests
// and docs that merely mention a dangerous command are not blocked. Other heredocs
// (python - <<EOF, bash <<EOF) execute their body and stay inspected.
function stripInertHeredocs(text) {
  const kept = [];
  let end = null;
  for (const line of text.split("\n")) {
    if (end !== null) { if (line.trim() === end) end = null; continue; }
    kept.push(line);
    const m = line.match(/^\s*(cat|tee)\b[^<]*<<-?\s*['"]?(\w+)['"]?/);
    if (m) end = m[2];
  }
  return kept.join("\n");
}

// ---- file edits -----------------------------------------------------------
if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) {
  const target = String(ti.file_path || ti.notebook_path || "");
  const abs = path.resolve(root, target);
  const rel = path.relative(root, abs).split(path.sep).join("/");
  if (writeScope) {
    const scope = path.join(root, writeScope) + path.sep;
    if (!abs.startsWith(scope)) deny(`this agent may only write under ${writeScope}/ (got "${target}"). Report the defect instead of editing project files.`);
  }
  const scratch = /^\/tmp\//.test(abs) || abs.startsWith(process.env.TMPDIR || "/nonexistent/");
  if (rel.startsWith("..") && !scratch) deny(`edit outside the repository: ${target}`);
  if (rel.startsWith("..")) process.exit(0);
  if (/(^|\/)\.env(\.|$)|(^|\/)(id_rsa|id_ed25519)|\.pem$|credentials\.json$/i.test(rel) && !/\.example$|\.sample$/.test(rel)) deny(`credential-like file: ${rel}`);
  if (rel.startsWith(".git/")) deny("never edit .git internals");
  if (/^\.(claude\/(settings|hooks)|factory\/project\.json)/.test(rel) && !process.env.FACTORY_ALLOW_CONFIG_EDIT)
    deny(`${rel} defines the safety boundary; only the user (or an explicit task about the factory itself, run with FACTORY_ALLOW_CONFIG_EDIT=1) may change it`);
  const prot = (project.protectedPaths || []).some((g) => globRe(g).test(rel));
  if (prot && fs.existsSync(abs)) deny(`${rel} is a protected path (approved art/baselines/records). Changing it needs explicit user approval; add NEW files instead or ask the Director to escalate.`);
  const content = String(ti.content || ti.new_string || "");
  if (SECRET_PATTERNS.some((r) => r.test(content))) deny("content looks like a credential/secret");
  process.exit(0);
}

// ---- shell ----------------------------------------------------------------
if (tool === "Bash") {
  const cmd = String(ti.command || "");
  const flat = stripInertHeredocs(cmd).replace(/\s+/g, " ");
  const branch = git("branch", "--show-current");

  const rules = [
    [/\bgit\s+push\b[^;&|]*(--force\b|--force-with-lease|\s-f\b|\s\+\S)/, "force-push / history rewrite"],
    [/\bgit\s+push\b[^;&|]*[\s:](main|master|production|prod)\b/, "push to a protected branch"],
    [/\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f|branch\s+-D|filter-branch|rebase\s+.*--root)\b/, "destructive git operation"],
    [/\bgh\s+pr\s+merge\b|\bgh\s+api\b[^;&|]*\/merge\b|\bgh\s+release\s+create\b/, "merging/releasing needs the user's approval"],
    [/\b(vercel|wrangler|netlify|firebase|flyctl|fly|railway|heroku)\b[^;&|]*(\bdeploy\b|\bpublish\b|\bpromote\b|--prod\b|\brelease\b)/, "production deploy"],
    [/\b(npm|pnpm|yarn)\s+publish\b/, "package publish"],
    [/\bsupabase\s+(db\s+(push|reset)|migration\s+up|link)\b|\bprisma\s+migrate\s+(deploy|reset)\b|\bknex\s+migrate\b|\bdrizzle-kit\s+(push|migrate)\b/, "database migration needs approval"],
    [/\b(psql|mysql|mongosh|redis-cli)\b[^;&|]*(prod|production|supabase\.co|rds\.amazonaws)/i, "direct production database access"],
    [/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f?|-[a-zA-Z]*f[a-zA-Z]*r)\s+(\/|~|\$HOME|\.git\b|\.\s|\*|\.\/?$)/, "recursive delete of a root/home/.git/everything"],
    [/\bcurl\b[^;&|]*\|\s*(sudo\s+)?(ba)?sh\b|\bwget\b[^;&|]*\|\s*(ba)?sh\b/, "pipe-to-shell"],
    [/\b(cat|less|more|head|tail|cp|mv|base64|xxd)\b[^;&|]*(^|[\s/])\.env(\.[a-z]+)?(\s|$)/, "reading credential files"],
    [/\b(printenv|env)\b\s*($|\||;|>)/, "dumping environment (may contain secrets)"],
  ];
  for (const [re, why] of rules) if (re.test(flat)) deny(why);
  if (/factory\.mjs\s+approve\b/.test(flat)) deny("approving protected-path changes is the user's decision; ask the Director to escalate");
  for (const pat of project.deniedCommands || []) if (new RegExp(pat).test(flat)) deny(`project rule /${pat}/`);

  if (/\bgit\s+(commit|merge|cherry-pick|revert|pull)\b/.test(flat) && protectedBranches.has(branch))
    deny(`you are on protected branch '${branch}'. Create/enter a feature branch first (git switch -c factory/...).`);
  if (/\bgit\s+push\b/.test(flat) && protectedBranches.has(branch) && !/\bgit\s+push\b[^;&|]*\s[\w./-]+:[\w./-]+/.test(flat))
    deny(`'git push' while on protected branch '${branch}'`);
  if (writeScope && /(^|[^>])>>?\s*[^&\s]|\bsed\s+-i|\btee\b|\bgit\s+(add|commit|checkout\s+--|restore|stash)\b/.test(flat)) {
    const m = flat.match(/>>?\s*([^\s;&|]+)/);
    const okRedirect = m && (m[1].startsWith(`${writeScope}/`) || m[1] === "/dev/null" || m[1].startsWith("/tmp/"));
    if (!(okRedirect && !/\bsed\s+-i|\bgit\s+(add|commit|checkout\s+--|restore|stash)\b/.test(flat)))
      deny(`this agent is read/verify-only; shell writes are limited to ${writeScope}/`);
  }
  if (/\bgit\s+commit\b/.test(flat)) {
    const staged = spawnSync("git", ["diff", "--cached", "-U0"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).stdout || "";
    const added = staged.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).join("\n");
    if (SECRET_PATTERNS.some((r) => r.test(added))) deny("staged changes contain what looks like a credential/secret");
    const names = git("diff", "--cached", "--name-only").split("\n");
    const bad = names.find((n) => /(^|\/)\.env(\.|$)|\.pem$/.test(n) && !/\.example$/.test(n));
    if (bad) deny(`staged credential-like file: ${bad}`);
  }
  process.exit(0);
}

// ---- other MCP / tools: fallthrough (settings.json deny rules cover MCP) ---
process.exit(0);
