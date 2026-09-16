# Arena two-thread integration — 2026-09-16

## Source and destination

Destination: `DougZeThug/Will-You-Be-My-Hero-Arena`, branch `main`.

The two threads use separate Git worktrees sharing the same repository:

- **Will You Be My Hero Arena**: `Documents/Codex/2026-09-08/files-pasted-by-the-user-you/outputs/arena`, on `main`. Its completed Phaser engine, four-event Motion Lab, character artwork, LoongBones adapters, reference data and documentation are already preserved in checkpoint `324c9604333454d75935943c4c67d3955475e8f3`. This checkout was clean at inspection.
- **Refactor character motion system**: `Documents/Codex/.pnpm-store/v11/arena-performance`, on `codex/character-performance`, starting at that same checkpoint. Its completed changes were uncommitted: the shared performance controller/compiler, native adapter, recorded cornhole Watch integration, connected wrist materials, release-hand source/crops, grounded stances, personality/attention, finish/recovery profiles, live tuning, capture scripts and tests.

GitHub's authenticated branch and commit reads confirmed that remote `main` still matched the checkpoint. There was no newer remote implementation or conflict to reconcile. No other local branch or detached worktree appeared in the shared repository's branch/worktree inventory.

## Preservation and exclusions

The pending source/asset inventory and full file copies were saved to ignored `work/qa/github-integration/before/`, with hashes in `before.json` and the tracked diff in `before.patch`. The scan found no secret-pattern matches or files over 50 MiB among the intended changes. Four new PNGs include both editable hand sources and reproducible runtime crops. Existing character exports, arena/equipment assets, simulation rules and dependency lockfile remain unchanged.

Dependencies, build caches, temporary QA reports/recordings, environment files and credentials remain excluded. The regenerated `docs/test-results.json` remains local: automatic approval review rejected uploading this unnecessary generated report, and it was removed from staging without altering its contents. Existing `.worktreeinclude` reference videos/model remain local inputs. The original thread's external animation audit/future implementation prompt and old delivery archives remain outside the repository. The separate `arena-video-review` repository is a private video-delivery artifact and is not part of this game integration.

## Validation

The combined source is tested with the existing aggregate runner:

```powershell
node node_modules/vite/bin/vite.js --config lab/vite.config.ts --host 127.0.0.1 --port 3040 --strictPort
$env:ARENA_LAB_URL='http://127.0.0.1:3040'
$env:ARENA_PRODUCTION_QA_PORT='3042'
node scripts/regression.mjs
```

The aggregate run passed on 2026-09-16: TypeScript, all 170,734 simulation/animation checks, 140 browser tests, production build/prerender, and production isolation/Play/Watch smoke. The one opt-in image test skipped by the broad run passed separately with `node scripts/browser-tests.mjs --visual`, comparing all six approved views without baseline updates. Production reported no page errors or Lab API leakage. The checks cover both characters, profile export/reload, complete recorded matches, replay resources, all four recorded sports, and live running/fighting/input paths.

The full `oxlint` command remains failing on existing project/vendor diagnostics. Running it against the untouched main checkout established 539 diagnostics versus 533 in the candidate; normalized file/rule/message comparison found no added diagnostic. These unrelated issues were preserved. Browser measurements use local headless Chrome and synthetic gamepad inputs, not physical-controller certification.

Actual fresh runtime captures of court release, complete match, Doug's chest tap and Dan's follow-through were opened and inspected. This integration did not change the motion or claim a new continuous-video review. The previous complete-turn video/frame review remains documented in the linked handoff.

Raw logs and the before/after inventory remain local under `work/qa/github-integration/`. No runtime changes were introduced by this integration task.

## Publication procedure

Git's HTTPS fetch could not authenticate using local saved credentials. The already connected GitHub account supplied authenticated repository, branch and Git-commit reads instead; the remote checkpoint and all its objects were already present locally. The branch response reported `protected: false`. The separate rulesets endpoint was unavailable for this private repository's plan; branch updates must still respect GitHub's enforcement.

Publication uses the connected GitHub Git-data tools: upload the reviewed source/art blobs, verify that the complete tree hash matches the local staged tree, create the commit, verify/import its exact Git object locally, then fast-forward the clean main checkout. Update remote `main` with `force: false` and read the actual branch back afterward. No reset, force push, worktree deletion, credential copying or game deployment is required. The final task report records the resulting commit and verification; the local evidence package retains the detailed checks.

## Reuse and remaining scope

Launch/tuning, the reproducible full-turn review command and the prior matched before/after evidence are documented in [the cornhole finish review](../cornhole-turn-settle/README.md) and [Character Performance](../../CHARACTER-PERFORMANCE.md). The existing next bounded task remains auditing visible bag-impact versus the LANDING cue, preserving authoritative score times. Editor round-trip and physical-controller/device-performance certification remain unavailable checks, not completed claims.
