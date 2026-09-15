# Will You Be My Hero? — Paper Cutout Arena

A complete art-direction overhaul based on the supplied Dan, Doug and Danielo sports cards: printed adult-proportioned figures, cream paper edges, worn ink, orange/yellow/teal graphics and an illustrated backyard court.

The built-in roster features Dan and Doug Weidensaul. The original collectible cards remain intact and separate from the animation assets. Additional human characters can be installed from complete character packs without editing source code.

The equipment refinement adds illustrated plywood boards, complete portable hoops, target stands, pong tables and cups. Balls and bags are roughly twice their earlier size, with seams, laces and printed-paper contours. Registered playing surfaces keep the larger projectiles aligned with the hands, holes, rims and scoring rings.

The competition runs in Phaser 3.90 with connected paper meshes and semantic animation markers. React owns the collection and surrounding UI; GSAP does not drive game motion. The shared playable framework now supports keyboard, browser gamepads, on-screen controls and AI through the same action maps and controller path.

## Play

Open **Play**, choose cards and devices, then start Cornhole, Clubhouse Dash or Backyard Brawl. These are three mechanically different interactive practice references: precision release, continuous obstacle movement, and direct combat. Practice awards no club points. See [Playable engine and controls](docs/PLAYABLE-ENGINE.md).

Open **Watch** for the existing automatic cornhole, football, beer pong and basketball exhibitions. Pause, speed, skip and replay are viewing controls. Sound starts muted. Historical results and the demo points ledger are preserved. All saved contests and points belong to this browser; a shared backend is not connected.

## Add a character

Upload the card in Codex and say **“Make this card an arena character.”** The saved `arena-card-to-character` workflow creates the articulated parts, custom motion tracks, six compatibility poses and one portable `.arena-character.json` pack. In the game, choose **The collection → Install character → Install & preview**. The installer creates the roster entry and saves the artwork in this browser. Keep the pack as a portable backup. See `docs/ADDING-CHARACTERS.md`.

## Run

Requires Node.js 22.13+ and pnpm. Verified with Node 24.19 on Windows.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

For the production export:

```sh
pnpm build
pnpm start
```

The production server defaults to http://localhost:3000. Set PORT to change it. Serve `dist/client` over HTTP; do not open index.html as a file. The build script uses Vinext's build/export APIs and allows native workers to shut down naturally on Windows.

## Verify and extend

```sh
pnpm typecheck
pnpm test
```

The suite passes 31,777 checks across 2,000 deterministic contests: equal attempt budgets, scoring and contact paths, immutable recordings, ownership, journal recovery, ledger idempotency, historical policies, exhibitions, prepared asset snapshots, hand/release geometry artwork/contact registration, portable character-pack validation, dynamic ownership and recorded play with installed characters. Exact counts are in `docs/test-results.json`.

- `docs/ADDING-CHARACTERS.md`: the complete card-in-Codex → character-pack → install workflow and its current boundaries.
- `docs/CHARACTER-PIPELINE.md`: six authored poses per person, alpha preparation, ground origins and palm sockets.
- `docs/import-examples/dan.json` and `doug.json`: prepared manifest examples for The collection → Asset mapping.
- `docs/INTEGRATION.md`: connecting identity, catalog, owned copies and an authoritative results service.
- `docs/DESIGN.md`: implemented art direction and critique.
- `docs/REVIEW-STATUS.md`: observed verification and remaining scope.

The animation connects the six full-body cutout drawings with short foot-aligned fades, subtle whole-paper motion, a registered hand release, and one shared state timeline. New matches have a 2.65-second card-portal entrance and personality-specific 2–3-second attempts. This remains limited 2D pose animation; no skeletal or paid animation runtime is required. See `docs/ANIMATION-TIMELINE.md` for timing and extension details. Generated assets and original card references are included.

Dan is the quiet operator; Doug is the lock-in showman. Each has a distinct portal entrance, idle, wind-up, celebration, frustration and victory treatment. The collection previews these motions, and future character packs can carry their own profile. See `docs/CHARACTER-PERSONALITIES.md`.

Characters can mix eight entrances, eight idles, eight throw styles, eight celebrations and eight miss reactions, starting from 24 profiles. The Collection → Explore motion styles auditions combinations without changing installed cards. The saved Codex workflow packages the chosen mix for future uploads. See `docs/CHARACTER-PERSONALITIES.md`. Contact shadows are derived from each pose’s soles; warm tint, consistent card anchors and equipment depth tie the cutouts to the court.
