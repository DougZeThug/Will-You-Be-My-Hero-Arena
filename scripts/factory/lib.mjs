// Shared helpers for the AI software factory. Zero dependencies, Node >= 20.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
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

// Fingerprint of working-tree content so "gate passed" cannot outlive an edit.
export function treeFingerprint(root) {
  const head = headSha(root);
  // The ledger records gate results, so it must not be part of what those results certify.
  const exclude = [":(exclude).factory/tasks"];
  const diff = spawnSync("git", ["diff", "HEAD", "--no-ext-diff", "--", ".", ...exclude], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }).stdout || "";
  const untracked = git(root, "ls-files", "--others", "--exclude-standard", "--", ".", ...exclude);
  const h = spawnSync("git", ["hash-object", "--stdin"], { cwd: root, input: head + "\n" + diff + "\n" + untracked, encoding: "utf8" });
  return h.stdout.trim();
}
