# Arena checkpoint before the motion architecture rebuild

This checkpoint preserves the current game and Human Motion Lab before a separate future rebuild. It does not start that rebuild or migrate experimental characters into production.

## Starting state

- Repository: the `outputs/arena` folder containing this file's root `package.json` and `AGENTS.md`.
- Branch: `main`; remote: `https://github.com/DougZeThug/Will-You-Be-My-Hero-Arena.git`.
- Previous HEAD: `3f45921952f80610c084cc2b961eac7ef42eccf8`, the historical blacklight prototype. It was not the current working Arena.
- Initial inventory: 144 tracked files, 28 modified tracked files, no staged files, and 898 untracked files.
- The checkpoint commit is identifiable by its message, `Checkpoint: Arena before motion architecture rebuild`. Its containing Git revision is the recovery point; do not use the historical HEAD above for new work.

## What is preserved

| Area | Included locations |
| --- | --- |
| Player app, Play/Watch, accessible UI | `app/`, `components/arena/`, `lib/arena/` |
| Phaser, fixed-step simulation, inputs, AI, characters | `lib/arena/engine/` |
| Cornhole, basketball, football, beer pong, running, fighting | Recorded simulation and `lib/arena/engine/events/`; current proof events under `lab/human-motion/` |
| LoongBones/DragonBones native integration | `lab/loongbones/`, including pinned vendor code/license and original editor exports |
| Current Dan/Doug authoring and weighted assets | `lab/loongbones/assets/`, `lab/human-motion/authoring/`, `lab/human-motion/assets/` |
| Latest full-body performance and Doug changes | Human Motion runtime, authoring, `assets/performance-v2/`, shared motion modules and reviewed evidence |
| Arena, equipment, presentation, effects and cameras | Shared engine presentation/equipment modules, Lab scenes, `public/assets/` |
| Character artwork, cards, atlases and textures | `public/assets/`, `lab/assets/`, versioned rig packs |
| Reproducible scenarios and checks | `lab/`, `tests/`, reviewed visual baselines, `motion-reference/` measured tracks |
| Build and development configuration | Package manifest, frozen lockfile, Vite/vinext/TypeScript config, scripts, repository skills and guides |

Production Play/Watch and the opt-in Human Motion Lab retain their existing distinct rig paths. A successful checkpoint does not approve an editor round trip or a production migration that has not passed its documented gates.

## Byte preservation and exclusions

The rig loaders validate source hashes. `.gitattributes` disables line-ending conversion for exports, textures, reference tracks and reviewed asset fixtures. An actual Git checkout was compared against the source bytes; see `validation.json`. Existing code, gameplay, character drawings, rigs and animations were not edited during checkpoint preparation. Existing whitespace in vendor code, historical patches and source files was preserved.

The checkpoint excludes `node_modules`, `dist`, framework caches, `.test-build`, TypeScript build metadata, Python bytecode, browser profiles, routine captures and `work/`. No environment files, credentials or secrets are included. The initial eligible-file and ZIP-text scan found no secret-pattern matches; this is a scoped scan, not a universal security certification.

The historical 36 MB `docs/review/loongbones-proof/browser-results.json` is retained locally and ignored. Its compact stats and original hash are in that review's `browser-summary.json`. Deliberately curated review images, clips, import packs and historical test fixtures remain versioned; they are distinct from routine scratch output.

## Local-only development inputs

`local-inputs.json` lists the exact eight non-secret files copied by `.worktreeinclude`: seven video-comparison clips and the optional public MediaPipe extraction model. The game itself does not require them. The existing Lab's synchronized video comparisons use those clips; the optional Python extractor uses the model.

A verified backup, `Arena-Checkpoint-Local-Inputs.zip`, is beside the Arena repository in the enclosing `outputs` folder. It contains those paths and a hash manifest, with no credentials. Keep it if moving to another computer. Full original reference downloads, the Python virtual environment, temporary art trials, generated review videos and QA captures remain local-only; they are not needed to play the committed game. Source footage acquisition and the optional Python environment are documented in `motion-reference/README.md` and `requirements.txt`.

Codex copies the listed ignored inputs only for local managed worktrees created from this checkout. A GitHub clone or a manually created Git worktree does not automatically receive them. See the [official worktree documentation](https://learn.chatgpt.com/docs/environments/git-worktrees#copy-ignored-local-files-into-managed-worktrees). Do not broaden `.worktreeinclude` to all of `work/`, environment files, credentials or dependency directories.

Browser-local saved games, installed cards and preferences are user data, not repository files. Tests use isolated storage and do not overwrite the user's normal game saves.

## Starting the next task without writing code

Select the **Arena project itself** in Codex, choose **Worktree**, and select the checkpointed `main` branch. Ask:

> Start from the Arena checkpoint before the motion architecture rebuild. Verify this worktree matches it, install the locked dependencies, and open the current game and Human Motion Lab before changing anything. Preserve the approved artwork and current gameplay. Follow AGENTS.md.

Astra should install dependencies with `pnpm install --frozen-lockfile`, use Node 22.13 or later, and confirm Phaser 3.90.0. The fresh-install proof used pnpm 11.19.0. Package downloads require network access when the cache is empty. Existing `node_modules`, `.next`, `next-env.d.ts` and old build caches are not required inputs. Python is optional for reference extraction; it is not a browser/runtime dependency. Browser tests require Chrome/Chromium as documented in `tests/browser/README.md`.

The usual local entry points are `pnpm dev --port 3001` for the player app and `pnpm lab` for port 3010. Use distinct ports for simultaneous worktrees. `.openai/hosting.json` contains existing non-secret hosting metadata; checkpoint verification does not deploy anything.

## Verification

`validation.json` records checks actually completed on this checkpoint's source, including any limitations. It is separate from historical review reports. Raw logs, state captures, screenshots and the disposable reproduction directory are under ignored `work/qa/checkpoint/`.
