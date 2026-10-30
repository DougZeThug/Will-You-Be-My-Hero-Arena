// Shared helpers for the AI software factory. Zero dependencies, Node >= 20.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function repoRoot(cwd = process.cwd()) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" }).trim();
  } catch {
    return path.resolve(cwd);
  }
}

export function git(root, ...args) {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "";
}

export const factoryDir = (root) => path.join(root, ".factory");
export const tasksDir = (root) => path.join(factoryDir(root), "tasks");
export const evidenceDir = (root, id) => path.join(root, "work", "factory", id);

export function loadProject(root) {
  const file = path.join(factoryDir(root), "project.json");
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Run: node scripts/factory/install.mjs --init`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function listTasks(root) {
  const dir = tasksDir(root);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^T-.*\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
}

export function taskFile(root, id) {
  return path.join(tasksDir(root), `${id}.json`);
}

export function loadTask(root, id) {
  const file = taskFile(root, id);
  if (!fs.existsSync(file)) throw new Error(`No such task: ${id}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function saveTask(root, task) {
  task.updatedAt = new Date().toISOString();
  fs.mkdirSync(tasksDir(root), { recursive: true });
  fs.writeFileSync(taskFile(root, task.id), JSON.stringify(task, null, 2) + "\n");
}

export const OPEN_STATES = ["intake", "planned", "building", "verifying", "repairing", "review", "ready"];
export const isActive = (t) => OPEN_STATES.includes(t.state);

// Glob subset: ** (any depth), * (no slash), literal otherwise.
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else re += "[^/]*";
    } else re += c.replace(/[.+^${}()|[\]\\?]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

export const matchesAny = (rel, globs = []) => globs.some((g) => globToRegExp(g).test(rel));

export function headSha(root) {
  return git(root, "rev-parse", "HEAD");
}

// Tracked + untracked changes, as a sorted list of "XY path" lines.
export function dirtyFiles(root) {
  const r = spawnSync("git", ["status", "--porcelain", "-uall"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || "").replace(/\n+$/, "");
  return out ? out.split("\n").sort() : [];
}

// Fingerprint of the working-tree CONTENT (not HEAD), so "gate passed" cannot outlive an edit
// yet survives committing the same content. Built from a throwaway index: tracked + untracked
// files, minus declared gate outputs (mayModify, which stay at their HEAD content) and the ledger (it records gate results, so it must not be part of what they certify).
export function treeFingerprint(root) {
  // Files a gate is declared to regenerate (mayModify) are outputs, not inputs: exclude them too.
  let regenerated = [];
  try { regenerated = loadProject(root).gates.flatMap((g) => g.mayModify ?? []); } catch {}
  const excl = [":(exclude).factory/tasks", ...regenerated.map((g) => `:(exclude,glob)${g}`)];
  const idx = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "factory-idx-")), "index");
  const env = { ...process.env, GIT_INDEX_FILE: idx };
  const run = (...a) => {
    const r = spawnSync("git", a, { cwd: root, env, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    if (r.error || r.status !== 0) throw new Error(`treeFingerprint: git ${a[0]} failed: ${r.error?.message || r.stderr}`);
    return r;
  };
  try {
    run("read-tree", "HEAD");
    run("rm", "-r", "--cached", "-q", "--ignore-unmatch", "--", ".factory/tasks");
    run("add", "-A", "--", ".", ...excl);
    const tree = run("write-tree").stdout.trim();
    if (!/^[0-9a-f]{40,64}$/.test(tree)) throw new Error("treeFingerprint: bad tree hash");
    return tree;
  } finally {
    fs.rmSync(path.dirname(idx), { recursive: true, force: true });
  }
}
