#!/usr/bin/env node
// Install the generic factory kit into another repository and generate a
// starter project profile from its package.json scripts.
//   node scripts/factory/install.mjs --target ../other-repo [--dry-run] [--force]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i < 0 ? null : args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true; };
const target = path.resolve(String(opt("target") || ""));
const dry = !!opt("dry-run"), force = !!opt("force");
if (!opt("target") || !fs.existsSync(target)) { console.error("usage: install.mjs --target <repo> [--dry-run] [--force]"); process.exit(1); }
if (!fs.existsSync(path.join(target, ".git"))) { console.error(`${target} is not a git repository root`); process.exit(1); }

const kit = JSON.parse(fs.readFileSync(path.join(here, ".factory/kit.json"), "utf8"));
const done = [];
for (const rel of kit.files) {
  const src = path.join(here, rel), dst = path.join(target, rel);
  if (!fs.existsSync(src)) { console.error(`kit file missing in source: ${rel}`); process.exit(1); }
  if (fs.existsSync(dst) && !force) {
    if (fs.readFileSync(src, "utf8") !== fs.readFileSync(dst, "utf8")) done.push(`SKIP (exists, differs; --force to overwrite) ${rel}`);
    continue;
  }
  done.push(`${dry ? "would copy" : "copy"} ${rel}`);
  if (!dry) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); fs.chmodSync(dst, fs.statSync(src).mode); }
}

// settings.json: merge, never clobber the target's own rules.
const sSrc = JSON.parse(fs.readFileSync(path.join(here, ".claude/settings.json"), "utf8"));
const sDst = path.join(target, ".claude/settings.json");
const cur = fs.existsSync(sDst) ? JSON.parse(fs.readFileSync(sDst, "utf8")) : {};
const uniq = (a, b) => [...new Set([...(a || []), ...(b || [])])];
const merged = { ...cur, permissions: { ...cur.permissions,
  defaultMode: cur.permissions?.defaultMode ?? sSrc.permissions.defaultMode,
  allow: uniq(cur.permissions?.allow, sSrc.permissions.allow), deny: uniq(cur.permissions?.deny, sSrc.permissions.deny) },
  hooks: { ...cur.hooks } };
for (const [ev, entries] of Object.entries(sSrc.hooks)) {
  const have = JSON.stringify(cur.hooks?.[ev] ?? []);
  merged.hooks[ev] = [...(cur.hooks?.[ev] ?? []), ...entries.filter((e) => !have.includes(e.hooks[0].command))];
}
done.push(`${dry ? "would merge" : "merge"} .claude/settings.json (kept ${(cur.permissions?.allow ?? []).length} allow / ${(cur.permissions?.deny ?? []).length} deny existing rules)`);
if (!dry) { fs.mkdirSync(path.dirname(sDst), { recursive: true }); fs.writeFileSync(sDst, JSON.stringify(merged, null, 2) + "\n"); }

// .gitignore
const gi = path.join(target, ".gitignore");
const giText = fs.existsSync(gi) ? fs.readFileSync(gi, "utf8") : "";
for (const line of kit.gitignore) if (!giText.split("\n").includes(line)) { done.push(`${dry ? "would add" : "add"} ${line} to .gitignore`); if (!dry) fs.appendFileSync(gi, `${giText && !giText.endsWith("\n") ? "\n" : ""}${line}\n`); }

// Starter profile from package.json (only real scripts; the adopting session refines it).
const prof = path.join(target, ".factory/project.json");
if (!fs.existsSync(prof)) {
  const pkgFile = path.join(target, "package.json");
  const scripts = fs.existsSync(pkgFile) ? JSON.parse(fs.readFileSync(pkgFile, "utf8")).scripts ?? {} : {};
  const pm = fs.existsSync(path.join(target, "pnpm-lock.yaml")) ? "pnpm" : fs.existsSync(path.join(target, "yarn.lock")) ? "yarn" : "npm";
  const run = (s) => (pm === "npm" ? `npm run ${s}` : `${pm} ${s}`);
  const gates = [];
  const add = (id, names, required, extra = {}) => { const s = names.find((n) => scripts[n]); if (s) gates.push({ id, cmd: run(s), required, timeoutSec: 900, ...extra }); };
  add("typecheck", ["typecheck", "type-check", "tsc"], true);
  add("lint", ["lint"], false, { note: "report-only until clean" });
  add("unit", ["test", "test:unit"], true);
  add("build", ["build"], false);
  add("e2e", ["test:e2e", "e2e", "test:browser"], false, { when: "UI changes" });
  const exists = (p) => fs.existsSync(path.join(target, p));
  const protectedPaths = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", ...["supabase/migrations/**", "migrations/**", "prisma/migrations/**"].filter((g) => exists(g.split("/")[0]))].filter((p, i, a) => a.indexOf(p) === i && (exists(p) || p.includes("*")));
  const profile = {
    name: path.basename(target), defaultBranch: "main", branchPrefix: "factory/", maxActiveTasks: 1, repairBudget: 3, requireReview: true,
    guidance: ["CLAUDE.md", "AGENTS.md", "README.md"].filter(exists), gates, protectedPaths, protectedBranches: [], deniedCommands: [],
    specialists: {}, uiSurfaces: [], previewCommand: scripts.dev ? run("dev") : "",
    TODO: "Adopting session: verify gates, add protectedPaths (approved art, baselines, league/production data, migrations), deniedCommands, specialists, uiSurfaces. Delete this key.",
  };
  done.push(`${dry ? "would write" : "write"} .factory/project.json (${gates.length} gates detected)`);
  if (!dry) { fs.mkdirSync(path.dirname(prof), { recursive: true }); fs.writeFileSync(prof, JSON.stringify(profile, null, 2) + "\n"); fs.mkdirSync(path.join(target, ".factory/tasks"), { recursive: true }); fs.writeFileSync(path.join(target, ".factory/tasks/.gitkeep"), ""); }
}
console.log(done.join("\n"));
console.log(dry ? "\n(dry run: nothing written)" : "\nNext: in the target repo run `node scripts/factory/factory.mjs doctor`, then complete .factory/project.json.");
