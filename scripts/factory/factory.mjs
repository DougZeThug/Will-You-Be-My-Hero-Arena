#!/usr/bin/env node
// Factory task ledger + gate runner. The Director skills call this so that
// state, retry budgets and "ready" decisions are enforced by code, not by
// agent self-report.   node scripts/factory/factory.mjs help
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  dirtyFiles, evidenceDir, git, headSha, isActive, listTasks, loadProject, loadTask,
  matchesAny, repoRoot, saveTask, tasksDir, treeFingerprint,
} from "./lib.mjs";

const root = repoRoot();
const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) {
    const k = rest[i].slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith("--")) flags[k] = true;
    else { flags[k] = next; i++; }
  } else pos.push(rest[i]);
}
const die = (msg, code = 1) => { console.error(msg); process.exit(code); };
const out = (o) => console.log(typeof o === "string" ? o : JSON.stringify(o, null, 2));
const now = () => new Date().toISOString();
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const log = (t, event, data = {}) => t.log.push({ at: now(), event, ...data });

const commands = {
  help() {
    out(`factory.mjs <command>
  new "<title>" [--kind build|fix|polish|review|maintain] [--source issue#N] [--branch name]
       create a task and claim a slot (refuses above project.maxActiveTasks)
  set <id> [--state S] [--branch B] [--pr URL] [--note TEXT] [--plan path] [--criterion TEXT]...
  plan-ok <id>        record that the plan was challenged (needs >=1 criterion)
  gate <id> [--only a,b] [--list]   run profile gates, store evidence + results
  repair <id> <issue-key> [--note T]   spend one repair attempt (refuses after budget; exit 3 = escalate)
  review <id> --verdict approve|changes|reject [--finding TEXT]...
  ready <id>          verify gates+review are green for the CURRENT tree, else refuse
  finish <id> [--pr URL]   mark delivered (requires ready)
  approve <id> <glob[,glob]>   USER-ONLY: allow a task to change protected paths (agents are blocked from calling this)
  block <id> --reason TEXT / abandon <id>
  status [--json]     verified overview (re-checks git, never trusts old reports)
  metrics [id]        interventions, attempts, gates, elapsed
  intervention <id> --note TEXT   log a human intervention
  doctor              check factory wiring`);
  },

  new() {
    const project = loadProject(root);
    const title = pos[0] || die("title required");
    const active = listTasks(root).filter(isActive);
    if (active.length >= (project.maxActiveTasks ?? 1))
      die(`Concurrency ceiling reached (${active.length}/${project.maxActiveTasks ?? 1}): ${active.map((t) => t.id).join(", ")} still open. Finish, block or abandon one first.`, 4);
    const date = now().slice(0, 10).replace(/-/g, "");
    const n = listTasks(root).filter((t) => t.id.startsWith(`T-${date}`)).length + 1;
    const id = `T-${date}-${String(n).padStart(2, "0")}`;
    const task = {
      id, title, kind: flags.kind || "build", source: flags.source || "chat",
      state: "intake", branch: flags.branch || `${project.branchPrefix ?? "factory/"}${id.toLowerCase()}-${slug(title)}`,
      baseSha: headSha(root), createdAt: now(), updatedAt: now(),
      plan: null, planChallenged: false, criteria: [],
      gates: {}, review: null, repairs: {}, interventions: 0, blocked: null, pr: null, log: [],
    };
    log(task, "created");
    saveTask(root, task);
    out(task);
  },

  set() {
    const t = loadTask(root, pos[0] || die("id required"));
    if (flags.state) {
      const valid = ["intake", "planned", "building", "verifying", "repairing", "review", "ready", "delivered", "blocked", "abandoned"];
      if (!valid.includes(flags.state)) die(`invalid state ${flags.state}`);
      if (flags.state === "ready" || flags.state === "delivered") die("use `ready` / `finish`: those states are earned, not set");
      log(t, "state", { from: t.state, to: flags.state });
      t.state = flags.state;
    }
    for (const k of ["branch", "pr", "plan"]) if (flags[k]) t[k] = flags[k];
    if (flags.note) log(t, "note", { text: flags.note });
    // repeated --criterion is not supported by the tiny parser; accept ';;'-separated list
    if (flags.criterion) t.criteria.push(...String(flags.criterion).split(";;").map((s) => s.trim()).filter(Boolean));
    saveTask(root, t);
    out({ id: t.id, state: t.state, branch: t.branch, criteria: t.criteria.length });
  },

  "plan-ok"() {
    const t = loadTask(root, pos[0] || die("id required"));
    if (!t.criteria.length) die("Refusing: no acceptance criteria recorded. Use: set <id> --criterion \"a;;b\"");
    t.planChallenged = true;
    if (t.state === "intake") t.state = "planned";
    log(t, "plan-ok");
    saveTask(root, t);
    out({ id: t.id, state: t.state });
  },

  gate() {
    const project = loadProject(root);
    if (flags.list) return out(project.gates.map((g) => ({ id: g.id, cmd: g.cmd, required: g.required !== false })));
    const t = loadTask(root, pos[0] || die("id required"));
    const only = flags.only ? String(flags.only).split(",") : null;
    const gates = project.gates.filter((g) => !only || only.includes(g.id));
    if (!gates.length) die("no gates selected");
    const ev = evidenceDir(root, t.id);
    fs.mkdirSync(ev, { recursive: true });
    const results = [];
    for (const g of gates) {
      const before = dirtyFiles(root);
      const t0 = Date.now();
      const r = spawnSync(g.cmd, { cwd: root, shell: true, encoding: "utf8", timeout: (g.timeoutSec ?? 600) * 1000, maxBuffer: 256 * 1024 * 1024, env: { ...process.env, CI: "1" } });
      const secs = Math.round((Date.now() - t0) / 100) / 10;
      const text = `${r.stdout || ""}${r.stderr || ""}`;
      fs.writeFileSync(path.join(ev, `gate-${g.id}.log`), text);
      const after = dirtyFiles(root);
      const sideEffects = after.filter((l) => !before.includes(l)).map((l) => l.slice(3));
      const unexpected = sideEffects.filter((f) => !matchesAny(f, g.mayModify ?? []) && !f.startsWith("work/"));
      const status = r.status === 0 ? "pass" : "fail";
      const res = {
        status, exit: r.status, signal: r.signal || null, secs, required: g.required !== false,
        sha: headSha(root), tree: treeFingerprint(root), at: now(),
        tail: status === "fail" ? text.split("\n").slice(-25).join("\n") : undefined,
        sideEffects: sideEffects.length ? sideEffects.slice(0, 20) : undefined,
        unexpectedSideEffects: unexpected.length ? unexpected.slice(0, 20) : undefined,
      };
      t.gates[g.id] = res;
      results.push({ id: g.id, ...res, tail: undefined });
      console.error(`[gate ${g.id}] ${status.toUpperCase()} in ${secs}s${unexpected.length ? ` (unexpected tracked changes: ${unexpected.join(", ")})` : ""}`);
      if (status === "fail" && flags["fail-fast"]) break;
    }
    if (["building", "repairing", "intake", "planned"].includes(t.state)) t.state = "verifying";
    log(t, "gate", { ids: results.map((r) => `${r.id}:${r.status}`) });
    saveTask(root, t);
    out(results);
    process.exit(results.some((r) => r.status === "fail" && r.required) ? 1 : 0);
  },

  repair() {
    const project = loadProject(root);
    const budget = project.repairBudget ?? 3;
    const t = loadTask(root, pos[0] || die("id required"));
    const key = pos[1] || die("issue-key required (e.g. gate:unit or review:1)");
    const rec = (t.repairs[key] ??= { attempts: 0, notes: [] });
    if (rec.attempts >= budget) {
      t.state = "blocked";
      t.blocked = `Repair budget (${budget}) exhausted for ${key}`;
      log(t, "escalate", { key });
      saveTask(root, t);
      die(`ESCALATE: ${t.blocked}. Stop retrying; report evidence in work/factory/${t.id}/ to the user.`, 3);
    }
    rec.attempts++;
    if (flags.note) rec.notes.push(String(flags.note));
    t.state = "repairing";
    log(t, "repair", { key, attempt: rec.attempts });
    saveTask(root, t);
    out({ key, attempt: rec.attempts, remaining: budget - rec.attempts });
  },

  review() {
    const t = loadTask(root, pos[0] || die("id required"));
    const v = flags.verdict;
    if (!["approve", "changes", "reject"].includes(v)) die("--verdict approve|changes|reject");
    t.review = { verdict: v, tree: treeFingerprint(root), sha: headSha(root), findings: flags.finding ? String(flags.finding).split(";;") : [], at: now() };
    t.state = v === "approve" ? "review" : "repairing";
    log(t, "review", { verdict: v });
    saveTask(root, t);
    out(t.review);
  },

  ready() {
    const t = loadTask(root, pos[0] || die("id required"));
    const problems = readiness(t);
    if (problems.length) { out({ ready: false, problems }); process.exit(1); }
    t.state = "ready";
    log(t, "ready");
    saveTask(root, t);
    out({ ready: true, id: t.id });
  },

  finish() {
    const t = loadTask(root, pos[0] || die("id required"));
    if (t.state !== "ready") die(`Refusing: task is '${t.state}', not 'ready'. Run \`ready\` first.`);
    const problems = readiness(t); // re-verify: an edit after `ready` must not slip through
    if (problems.length) { out({ delivered: false, problems }); process.exit(1); }
    if (flags.pr) t.pr = flags.pr;
    t.state = "delivered";
    log(t, "delivered", { pr: t.pr });
    saveTask(root, t);
    out({ id: t.id, state: t.state, pr: t.pr });
  },

  // Run by the USER in their own terminal (the guard hook blocks agents from calling it).
  approve() {
    const t = loadTask(root, pos[0] || die("id required"));
    const globs = String(pos[1] || die("path or glob required")).split(",");
    t.approvedProtected = [...new Set([...(t.approvedProtected ?? []), ...globs])];
    t.interventions++; log(t, "approved-protected", { globs });
    saveTask(root, t); out({ id: t.id, approvedProtected: t.approvedProtected });
  },

  block() {
    const t = loadTask(root, pos[0] || die("id required"));
    t.state = "blocked"; t.blocked = flags.reason || "unspecified";
    log(t, "blocked", { reason: t.blocked });
    saveTask(root, t); out({ id: t.id, state: t.state });
  },
  abandon() {
    const t = loadTask(root, pos[0] || die("id required"));
    t.state = "abandoned"; log(t, "abandoned"); saveTask(root, t); out({ id: t.id, state: t.state });
  },
  intervention() {
    const t = loadTask(root, pos[0] || die("id required"));
    t.interventions++; log(t, "intervention", { note: flags.note });
    saveTask(root, t); out({ id: t.id, interventions: t.interventions });
  },

  status() {
    const project = loadProject(root);
    const tree = treeFingerprint(root);
    const branch = git(root, "branch", "--show-current");
    const tasks = listTasks(root).map((t) => {
      const checks = {};
      const exists = t.branch && git(root, "rev-parse", "--verify", "--quiet", t.branch) !== "";
      const ahead = exists ? git(root, "rev-list", "--count", `${t.baseSha}..${t.branch}`) : null;
      for (const g of project.gates.filter((g) => g.required !== false)) {
        const r = t.gates[g.id];
        checks[g.id] = !r ? "never-ran" : r.status !== "pass" ? "FAILED" : r.tree === tree ? "pass(current)" : "pass(stale)";
      }
      return {
        id: t.id, title: t.title, state: t.state, kind: t.kind,
        branchExists: !!exists, commitsAhead: ahead, onThisBranch: t.branch === branch,
        gates: checks, review: t.review ? (t.review.tree === tree ? t.review.verdict : `${t.review.verdict}(stale)`) : "none",
        repairs: Object.fromEntries(Object.entries(t.repairs).map(([k, v]) => [k, `${v.attempts}/${project.repairBudget ?? 3}`])),
        blocked: t.blocked, pr: t.pr,
        next: nextAction(t, checks, tree),
      };
    });
    if (flags.json) return out({ branch, dirty: dirtyFiles(root).length, tasks });
    const open = tasks.filter((t) => isActive(t) || t.state === "blocked");
    console.log(`branch ${branch} · ${dirtyFiles(root).length} uncommitted files · ceiling ${project.maxActiveTasks ?? 1} active`);
    if (!tasks.length) console.log("No factory tasks yet.");
    for (const t of tasks) {
      console.log(`${t.id} [${t.state}] ${t.title}`);
      if (open.includes(t) || flags.all) {
        console.log(`   gates: ${Object.entries(t.gates).map(([k, v]) => `${k}=${v}`).join(" ")} · review: ${t.review}`);
        if (Object.keys(t.repairs).length) console.log(`   repairs: ${JSON.stringify(t.repairs)}`);
        if (t.blocked) console.log(`   BLOCKED: ${t.blocked}`);
        console.log(`   next: ${t.next}`);
      }
    }
  },

  metrics() {
    const tasks = pos[0] ? [loadTask(root, pos[0])] : listTasks(root);
    out(tasks.map((t) => {
      const gates = Object.values(t.gates);
      return {
        id: t.id, state: t.state, interventions: t.interventions,
        repairAttempts: Object.values(t.repairs).reduce((a, r) => a + r.attempts, 0),
        gatesRun: gates.length, gatesPassed: gates.filter((g) => g.status === "pass").length,
        gateSeconds: Math.round(gates.reduce((a, g) => a + g.secs, 0)),
        elapsedMin: Math.round((new Date(t.updatedAt) - new Date(t.createdAt)) / 6000) / 10,
        unresolved: Object.entries(t.repairs).length ? Object.keys(t.repairs).filter((k) => t.gates[k.replace("gate:", "")]?.status === "fail") : [],
      };
    }));
  },

  doctor() {
    const checks = [];
    const ok = (name, pass, hint = "") => checks.push({ name, pass: !!pass, hint });
    const p = (f) => fs.existsSync(path.join(root, f));
    let project = null;
    try { project = loadProject(root); ok("profile .factory/project.json", true); } catch (e) { ok("profile .factory/project.json", false, e.message); }
    ok("settings .claude/settings.json", p(".claude/settings.json"));
    ok("guard hook", p(".claude/hooks/factory-guard.mjs"));
    for (const a of ["architect", "builder", "ui", "qa", "repair", "reviewer"]) ok(`agent factory-${a}`, p(`.claude/agents/factory-${a}.md`));
    for (const s of ["build", "fix", "review", "polish", "status", "maintain", "adopt"]) ok(`skill factory-${s}`, p(`.claude/skills/factory-${s}/SKILL.md`));
    ok("git repository", git(root, "rev-parse", "--git-dir") !== "");
    ok("work/ git-ignored (evidence)", spawnSync("git", ["check-ignore", "-q", "work/factory/x"], { cwd: root }).status === 0, "add /work/ to .gitignore");
    if (project) {
      ok("gates defined", project.gates?.length > 0);
      ok("gate commands resolvable", project.gates.every((g) => { const bin = g.cmd.split(/\s+/)[0]; return spawnSync("sh", ["-c", `command -v ${bin}`]).status === 0; }), "a gate binary is missing");
      ok("concurrency ceiling set", Number.isInteger(project.maxActiveTasks));
    }
    const settings = p(".claude/settings.json") ? JSON.parse(fs.readFileSync(path.join(root, ".claude/settings.json"), "utf8")) : {};
    ok("deny rules present", (settings.permissions?.deny ?? []).length > 0);
    ok("PreToolUse guard registered", JSON.stringify(settings.hooks ?? {}).includes("factory-guard"));
    for (const c of checks) console.log(`${c.pass ? "ok  " : "FAIL"} ${c.name}${c.pass ? "" : ` — ${c.hint}`}`);
    process.exit(checks.every((c) => c.pass) ? 0 : 1);
  },
};

function readiness(t) {
  const project = loadProject(root);
  const tree = treeFingerprint(root);
  const problems = [];
  if (!t.planChallenged) problems.push("plan was never challenged (plan-ok)");
  if (!t.criteria.length) problems.push("no acceptance criteria");
  for (const g of project.gates.filter((g) => g.required !== false)) {
    const r = t.gates[g.id];
    if (!r) problems.push(`required gate '${g.id}' never ran`);
    else if (r.status !== "pass") problems.push(`gate '${g.id}' failed`);
    else if (r.tree !== tree) problems.push(`gate '${g.id}' is stale (tree changed since it passed)`);
    else if (r.unexpectedSideEffects) problems.push(`gate '${g.id}' modified tracked files: ${r.unexpectedSideEffects.join(", ")}`);
  }
  const needsReview = project.requireReview !== false && t.kind !== "review";
  if (needsReview) {
    if (!t.review) problems.push("no independent review");
    else if (t.review.verdict !== "approve") problems.push(`review verdict is '${t.review.verdict}'`);
    else if (t.review.tree !== tree) problems.push("review is stale (tree changed after approval)");
  }
  const prot = protectedTouched(project, t);
  if (prot.length) problems.push(`protected paths changed: ${prot.join(", ")} (needs explicit user approval: factory.mjs approve)`);
  return problems;
}

function protectedTouched(project, t) {
  const changed = new Set([
    ...git(root, "diff", "--name-only", `${t.baseSha}`).split("\n"),
    ...git(root, "ls-files", "--others", "--exclude-standard").split("\n"),
  ].filter(Boolean));
  const approved = t.approvedProtected ?? [];
  // The safety boundary itself is always protected: only an explicit user approval lets a task change it.
  const builtin = [".claude/settings.json", ".claude/settings.local.json", ".claude/hooks/**", ".factory/project.json"];
  return [...changed].filter((f) => matchesAny(f, [...builtin, ...(project.protectedPaths ?? [])]) && !matchesAny(f, approved));
}

function nextAction(t, checks, tree) {
  if (t.state === "blocked") return "needs a human decision (see BLOCKED)";
  if (t.state === "delivered") return "awaiting user approval/merge";
  if (!t.criteria.length) return "write acceptance criteria";
  if (!t.planChallenged) return "challenge the plan (factory-reviewer), then plan-ok";
  const bad = Object.entries(checks).filter(([, v]) => v !== "pass(current)");
  if (bad.length) return `run gates: ${bad.map(([k, v]) => `${k}(${v})`).join(", ")}`;
  if (!t.review || t.review.tree !== tree) return "independent review";
  if (t.review.verdict !== "approve") return "address review findings";
  return t.state === "ready" ? "open/update PR and deliver" : "run `ready`";
}

if (!commands[cmd]) { commands.help(); process.exit(cmd ? 1 : 0); }
try { commands[cmd](); } catch (e) { die(e.message); }
