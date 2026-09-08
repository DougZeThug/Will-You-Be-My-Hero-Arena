# Will You Be My Hero? — Arena

The After Hours Athletic Club: a surreal blacklight clubhouse for illustrated friends, pets, and extremely important backyard sports.

This is the **two-character review build** requested before expanding the animation conventions to six competitors. It runs as a standalone local demo, including when privately hosted. Saved contests and points belong to each browser; no shared backend is connected.

## Play

Choose Cornhole → Choose competitors → keep Mack and Captain Marmalade → Start showdown. The selected reproducible showcase seed produces a 3–5 finish with a final hole shot. Every action is automatic. Pause, speed, skip and replay are viewing controls. Sound starts muted.

Football, beer pong and basketball are also selectable and simulated with their own attempt budgets, release poses, targets, contacts and recorded paths. Exhibition is unlimited and earns no points. Counted entries use the demo schedule and proposed 3/1/0 points policy. The sample leaderboard starts populated with one basketball contest per user and includes shared ranks.

## Run locally

Requirements: Node.js 22.13 or newer and pnpm. This build was verified with Node 24.19 on Windows.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the localhost address printed by the development server. For a production export:

```sh
pnpm build
pnpm start
```

The production server listens on `http://localhost:3000`. Set `PORT` to change it. Static output is `dist/client`; serve that directory over HTTP, rather than opening index.html as a file. The build script uses Vinext's build/export APIs and lets native workers shut down naturally, avoiding the CLI's forced-exit crash observed on this Windows runtime.

## Verify

```sh
pnpm typecheck
pnpm test
```

The test suite runs 2,000 deterministic contests and checks equal legal budgets, path/contact scoring, final tallies, shared ranks, historical policies, ownership, atomic journal recovery, idempotent awards, exhibitions and correction references. Reports and the reproducible cornhole recording are in `docs/`.

## Assets and integration

- `docs/import-examples/mack.json` and `marmalade.json`: complete manifests for the two authored rigs. The Collection → Asset mapping panel validates and attaches a manifest, then previews its motion.
- `docs/CHARACTER-PIPELINE.md`: the real generation, alpha cleanup, joint preparation and rigging workflow. Original sheets and prepared layers are in `public/assets`.
- `docs/INTEGRATION.md`: identity, owned copies, authoritative server simulation and append-only points ledger connections.
- `docs/DESIGN.md`: three explored directions and the two critique passes.
- `docs/REVIEW-STATUS.md`: observable verification and remaining work.

The application requires no external model or paid animation runtime. Generated demo artwork is included. Keep original imported collectible artwork separate from the animated character asset.
