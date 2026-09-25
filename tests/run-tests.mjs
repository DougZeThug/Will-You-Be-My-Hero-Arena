import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { createHash } from 'node:crypto';
fs.mkdirSync('.test-build', { recursive: true });
// The reviewed motion defaults are the same JSON inputs used by normal matches.
for (const id of ['doug', 'dan']) {
  const folder = '.test-build/engine/performance/profiles';
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(
    `${folder}/${id}.mjs`,
    'export default ' +
      fs.readFileSync(
        `lib/arena/engine/performance/profiles/${id}.json`,
        'utf8',
      ) +
      ';',
  );
}
fs.writeFileSync(
  '.test-build/motion-catalog.mjs',
  'export default ' +
    fs.readFileSync('lib/arena/motion-catalog.json', 'utf8') +
    ';',
);
fs.writeFileSync(
  '.test-build/puppet-assets.mjs',
  'export default ' +
    fs.readFileSync('lib/arena/puppet-assets.json', 'utf8') +
    ';',
);
// Preserve relative module identities (the catalog is intentionally mutable).
function transpileDirectory(dir, relative = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(relative, entry.name),
      file = path.join(dir, entry.name),
      dest = path.join('.test-build', rel.replace(/\.ts$/, '.mjs'));
    if (entry.isDirectory()) {
      transpileDirectory(file, rel);
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const result = ts
      .transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ES2022,
        },
      })
      .outputText.replace(
        /from (['"])(\.[^'"]+)\1/g,
        (_, q, url) =>
          'from ' +
          q +
          url.replace(/\.json$/, '.mjs') +
          (url.endsWith('.json') ? '' : '.mjs') +
          q,
      )
      .replace(
        /import (['"])(\.[^'"]+)\1/g,
        (_, q, url) => 'import ' + q + url + '.mjs' + q,
      );
    fs.writeFileSync(dest, result);
  }
}
transpileDirectory('lib/arena');
const m = await import('../.test-build/model.mjs'),
  s = await import('../.test-build/simulation.mjs'),
  p = await import('../.test-build/persistence.mjs'),
  a = await import('../.test-build/assets.mjs');
let checks = 0;
const check = (f) => {
  f();
  checks++;
};
const setup = (sport = 'cornhole', seed = 'test') => ({
  id: 'test-' + seed,
  seed,
  sport,
  participants: [
    {
      userId: 'user-doug',
      copyId: 'copy-0-0',
      cardId: 'card-dan',
      strategy: 'steady',
    },
    {
      userId: 'user-dan',
      copyId: 'copy-1-1',
      cardId: 'card-doug',
      strategy: 'steady',
    },
  ],
  mode: 'exhibition',
  tie: 'draw',
  secret: false,
  showcase: false,
  policy: { ...m.DEFAULT_POLICY },
  rulesVersion: s.RULES_VERSION,
  createdAt: '2026-09-08T00:00:00Z',
});
const stats = {};
for (const sport of m.SPORTS) {
  const outcomes = {};
  let draws = 0;
  for (let i = 0; i < 500; i++) {
    const cfg = setup(sport, 'property-' + i),
      rec = s.simulate(cfg);
    check(() => assert.deepEqual(rec, s.simulate(cfg)));
    check(() => assert.deepEqual(s.validateRecording(rec), []));
    check(() =>
      assert.equal(rec.attempts.length, m.EVENTS[sport].attempts * 2),
    );
    check(() =>
      assert.deepEqual(s.revealed(rec, rec.duration).scores, rec.scores),
    );
    check(() => assert.deepEqual(s.revealed(rec, 0).scores, [0, 0]));
    if (rec.winner === null) draws++;
    for (const attempt of rec.attempts) {
      outcomes[attempt.contact] = (outcomes[attempt.contact] ?? 0) + 1;
      if (sport === 'pong')
        check(() =>
          assert.equal(
            new Set(attempt.removedCups).size,
            attempt.removedCups.length,
          ),
        );
    }
    const ot = s.simulate({ ...cfg, tie: 'paired' });
    check(() => assert.ok(ot.attempts.length <= rec.attempts.length + 6));
    check(() =>
      assert.equal(
        ot.attempts.filter((a) => a.actor === 0).length,
        ot.attempts.filter((a) => a.actor === 1).length,
      ),
    );
  }
  stats[sport] = { outcomes, draws };
}
check(() =>
  assert.equal(
    s.contactScore('cornhole', { x: 9.2, y: 0.4, z: 0 }, 0).score,
    3,
  ),
);
check(() =>
  assert.equal(
    s.contactScore('cornhole', { x: 8, y: 0.16, z: 0.52 }, 0).score,
    1,
  ),
);
check(() =>
  assert.equal(
    s.contactScore('cornhole', { x: 8, y: 0, z: 0.521 }, 0).score,
    0,
  ),
);
check(() =>
  assert.equal(
    s.contactScore('football', { x: 8.8, y: 2.25, z: 0 }, 0).score,
    3,
  ),
);
check(() =>
  assert.equal(
    s.contactScore('football', { x: 8.8, y: 3.1, z: 0 }, 0).score,
    0,
  ),
);
check(() =>
  assert.equal(
    s.contactScore('basketball', { x: 8.8, y: 2.9, z: 0 }, 0).score,
    1,
  ),
);
check(() =>
  assert.equal(
    s.contactScore('basketball', { x: 8.8, y: 2.9, z: 0.3 }, 0).contact,
    'rim-out',
  ),
);
class MemoryStorage {
  map = new Map();
  getItem(k) {
    return this.map.get(k) ?? null;
  }
  setItem(k, v) {
    this.map.set(k, v);
  }
  removeItem(k) {
    this.map.delete(k);
  }
}
const storage = new MemoryStorage(),
  repo = new p.LocalArenaRepository(storage),
  state = repo.load(),
  entry = m.SCHEDULE[0];
const ranked = {
  ...setup('cornhole', entry.seed),
  id: 'counted-0',
  mode: 'ranked',
  entryId: entry.id,
  policy: { ...state.policy },
};
const first = await repo.commit(ranked),
  second = await repo.commit(ranked),
  parallel = await Promise.all([repo.commit(ranked), repo.commit(ranked)]);
check(() => assert.equal(second.existing, true));
check(() => assert.deepEqual(first.recording, second.recording));
check(() =>
  assert.equal(
    repo.load().ledger.filter((a) => a.contestId === ranked.id).length,
    2,
  ),
);
repo.savePlayback(ranked.id, 17.7);
const resumed = new p.LocalArenaRepository(storage).load();
check(() => assert.equal(resumed.active.time, 17.7));
check(() => assert.equal(resumed.active.id, ranked.id));
const before = repo.load().ledger.length;
const exhibition = await repo.commit(setup('pong', 'exhibition'));
check(() => assert.equal(repo.load().ledger.length, before));
// Only the contest waiting for its first full viewing keeps a position: a
// recording that has lost the slot, or been watched to the end, never takes it.
check(() => assert.equal(repo.load().active.id, exhibition.recording.id));
repo.savePlayback(ranked.id, 5);
check(() =>
  assert.deepEqual(repo.load().active, {
    id: exhibition.recording.id,
    time: 0,
  }),
);
repo.savePlayback(exhibition.recording.id, exhibition.recording.duration);
check(() => assert.equal(repo.load().active, null));
const revisionAfterFinish = repo.load().revision;
repo.savePlayback(exhibition.recording.id, 3);
repo.savePlayback(ranked.id, 3);
check(() => assert.equal(repo.load().active, null));
check(() => assert.equal(repo.load().revision, revisionAfterFinish));
const historical = structuredClone(repo.load().ledger);
await repo.updatePolicy({ ...m.DEFAULT_POLICY, win: 7 });
check(() => assert.deepEqual(repo.load().ledger, historical));
// Saving unchanged values keeps the policy's name; new values get a name
// from the values alone, so the same values always give the same name.
const win7 = repo.load().policy.id;
await repo.updatePolicy(repo.load().policy);
check(() => assert.equal(repo.load().policy.id, win7));
await repo.updatePolicy({ ...m.DEFAULT_POLICY, win: 8 });
await repo.updatePolicy({ ...m.DEFAULT_POLICY, win: 7 });
check(() => assert.equal(repo.load().policy.id, win7));
check(() => assert.equal(p.MAX_ALLOWANCE, 4));
await assert.rejects(
  repo.updatePolicy({ ...m.DEFAULT_POLICY, allowance: 5 }),
  /at most 4/,
);
checks++;
check(() =>
  assert.equal(
    p.entriesLeft(
      {
        ...repo.load(),
        policy: { ...repo.load().policy, rankedEnabled: false },
      },
      'user-doug',
    ),
    0,
  ),
);
check(() =>
  assert.equal(
    p.entriesLeft(
      { ...repo.load(), policy: { ...repo.load().policy, allowance: 100 } },
      'user-sam',
    ),
    3,
  ),
);
await assert.rejects(
  repo.commit({
    ...ranked,
    id: 'bad',
    entryId: 'entry-1-0',
    seed: 'bad',
    sport: 'football',
  }),
);
checks++;
const empty = p.emptyState();
check(() =>
  assert.deepEqual(
    p.standings(empty).map((r) => r.rank),
    [1, 1, 1, 1],
  ),
);
const correction = p.adjustAward(
  repo.load(),
  historical[0].id,
  -historical[0].delta,
  'correction-1',
);
check(() => assert.equal(correction.ledger.length, historical.length + 1));
check(() =>
  assert.deepEqual(
    p.adjustAward(correction, historical[0].id, -3, 'correction-1'),
    correction,
  ),
);
const staged = repo.load();
staged.revision += 10;
staged.active = { id: ranked.id, time: 22 };
const payload = JSON.stringify(staged);
storage.setItem(
  p.STORAGE_KEY + ':journal',
  JSON.stringify({ payload, checksum: s.hash(payload) }),
);
check(() =>
  assert.equal(new p.LocalArenaRepository(storage).load().active.time, 22),
);
// A save that fails its checks can still be exported as stored text and
// reset; the reset outranks every revision written before it.
const damagedStorage = new MemoryStorage(),
  damaged = new p.LocalArenaRepository(damagedStorage);
await damaged.commit(setup('football', 'damaged'));
const damagedRevision = damaged.load().revision;
const unreadable = JSON.stringify({
  payload: JSON.stringify({ ...damaged.load(), revision: damagedRevision + 4 }),
  checksum: 'bad',
});
damagedStorage.setItem(p.STORAGE_KEY, unreadable);
assert.throws(() => damaged.load(), /integrity check/);
checks++;
check(() => assert.equal(damaged.raw(), unreadable));
const afterReset = await damaged.reset();
check(() => assert.equal(afterReset.revision, damagedRevision + 5));
check(() => assert.equal(damaged.load().recordings.length, 2));
check(() => assert.equal(damaged.load().active, null));
damagedStorage.setItem(p.STORAGE_KEY, 'not json');
await damaged.reset();
check(() => assert.equal(damaged.load().recordings.length, 2));
check(() =>
  assert.deepEqual(
    a.validateAsset(a.manifest('card-dan', 'dan', 'human')).errors,
    [],
  ),
);
check(() => assert.ok(a.validateAsset({ cardId: '' }).errors.length > 5));
const adapters = await import('../.test-build/adapters.mjs');
const services = adapters.createDemoServices(new MemoryStorage());
check(() => assert.equal(services.authority, 'local-demo'));
check(() =>
  assert.ok(
    a
      .validateAsset({ ...a.manifest('card-dan', 'dan', 'human'), scale: 2 })
      .errors.some((e) => e.includes('scale')),
  ),
);
check(() =>
  assert.ok(
    a
      .validateAsset({
        ...a.manifest('card-dan', 'dan', 'human'),
        family: 'secret',
      })
      .errors.some((e) => e.includes('Secret')),
  ),
);
for (const card of m.CARDS) {
  const asset = await services.characters.get(card.id);
  check(() => assert.deepEqual(a.validateAsset(asset).errors, []));
  fs.mkdirSync('docs/import-examples', { recursive: true });
  fs.writeFileSync(
    `docs/import-examples/${card.asset}.json`,
    JSON.stringify(asset, null, 2),
  );
  for (const url of [
    asset.cardImage,
    asset.sheet,
    ...Object.values(asset.frames).map((p) => p.url),
  ])
    check(() => assert.ok(fs.existsSync('public' + url), `Missing ${url}`));
}
const owned = await services.ownership.list('user-doug');
check(() => assert.equal(owned.length, 2));
const allowed = await services.ownership.verify(
  'user-dan',
  owned[0].id,
  owned[0].cardId,
);
check(() => assert.equal(allowed, false));
const paper = await import('../.test-build/paper.mjs');
for (const card of m.CARDS)
  for (const sport of m.SPORTS) {
    const socket = paper.paperSocket(card.asset, paper.releasePose(sport)),
      release = s.releasePosition(card.asset, sport, 0),
      projected = s.project(release),
      base = s.project({ x: 1, y: 0, z: 0 });
    check(() =>
      assert.ok(
        Math.hypot(
          projected.x - base.x - socket.x,
          projected.y - base.y - socket.y,
        ) < 1e-8,
      ),
    );
  }
const snapshotSetup = setup('cornhole', 'asset-snapshot');
snapshotSetup.characterAssets = m.CARDS.map((c) =>
  a.manifest(c.id, c.asset, c.family),
);
snapshotSetup.characterAssets[0].frameScale = 0.55;
const snap = s.simulate(snapshotSetup);
const snapPoint = s.releasePosition(
  'dan',
  'cornhole',
  0,
  snapshotSetup.characterAssets[0],
);
check(() => assert.deepEqual(snap.attempts[0].release, snapPoint));
snapshotSetup.characterAssets[0].frameScale = 1;
check(() => assert.equal(snap.setup.characterAssets[0].frameScale, 0.55));
check(() => assert.deepEqual(s.validateRecording(snap), []));
const visual = await import('../.test-build/equipment-layout.mjs'),
  art = await import('../.test-build/equipment-art.mjs');
const nearBoard = visual.placement('cornhole', 0),
  farBoard = visual.placement('cornhole', 1);
check(() =>
  assert.ok(
    farBoard.scale < nearBoard.scale * 0.8,
    'The back board must read as smaller in perspective',
  ),
);
for (let actor = 0; actor < 2; actor++) {
  const near = visual.artPoint(
      'cornhole',
      actor,
      visual.quadPoint(art.EQUIPMENT_ART.board.plane, 0, 0.5),
    ),
    far = visual.artPoint(
      'cornhole',
      actor,
      visual.quadPoint(art.EQUIPMENT_ART.board.plane, 1, 0.5),
    );
  check(() =>
    assert.ok(
      far.x > near.x && Math.abs(far.y - near.y) < (far.x - near.x) * 0.18,
      'The board long axis must face horizontally from the players toward the hole',
    ),
  );
  const hole = visual.surfacePoint('cornhole', actor, {
      x: 9.2,
      y: 0.16 + (1.2 / 1.9) * 0.34,
      z: actor * 3.5,
    }),
    actualHole = visual.artPoint(
      'cornhole',
      actor,
      art.EQUIPMENT_ART.board.hole,
    );
  check(() =>
    assert.ok(
      Math.hypot(hole.x - actualHole.x, hole.y - actualHole.y) < 1e-6,
      'Bag contact must meet the illustrated aperture',
    ),
  );
  const rim = visual.surfacePoint('basketball', actor, {
    x: 8.8,
    y: 2.9,
    z: actor * 3.5,
  });
  const rimArt = visual.artPoint(
    'basketball',
    actor,
    art.EQUIPMENT_ART.hoop.rim,
  );
  check(() =>
    assert.ok(
      Math.hypot(rim.x - rimArt.x, rim.y - rimArt.y) < 1e-8,
      'Basketball contact meets the illustrated rim',
    ),
  );
  for (const [radius, zone] of [
    [0.25, 'inner'],
    [0.58, 'middle'],
    [1.05, 'outer'],
  ]) {
    const center = visual.placement('football', actor);
    const edge = visual.surfacePoint('football', actor, {
      x: 8.8,
      y: 2,
      z: actor * 3.5 + radius,
    });
    check(() =>
      assert.ok(
        Math.abs(
          edge.x -
            center.anchor.x -
            art.EQUIPMENT_ART.target[zone].x * center.scale,
        ) < 1e-6,
        'Football scoring boundary must follow the printed ring',
      ),
    );
  }
  for (const sport of m.SPORTS) {
    const place = visual.placement(sport, actor),
      asset = art.EQUIPMENT_ART[place.name];
    check(() =>
      assert.ok(
        place.x >= 0 &&
          place.x + asset.width * place.scale <= 1280 &&
          place.y >= 0 &&
          place.y + asset.height * place.scale < 680,
        'Complete equipment silhouette stays in the court',
      ),
    );
  }
}
for (const sport of m.SPORTS) {
  const rec = s.simulate(setup(sport, 'presentation-registration'));
  for (const attempt of rec.attempts) {
    check(() =>
      assert.deepEqual(
        visual.presentedPoint(attempt, attempt.release, 0),
        s.project(attempt.release),
        'Larger props stay on the recorded hand socket at release',
      ),
    );
    const contact = visual.presentedPoint(
        attempt,
        attempt.target,
        attempt.duration,
      ),
      surface = visual.surfacePoint(sport, attempt.actor, attempt.target);
    check(() =>
      assert.ok(
        Math.hypot(contact.x - surface.x, contact.y - surface.y) < 1e-7,
        'Playback must meet the registered target surface',
      ),
    );
    for (const sample of attempt.trajectory)
      check(() =>
        assert.ok(
          Object.values(visual.presentedPoint(attempt, sample, sample.t)).every(
            Number.isFinite,
          ),
        ),
      );
  }
}
for (const name of [
  'board',
  'hoop',
  'target',
  'table',
  'bag-yellow',
  'bag-teal',
  'football',
  'basketball',
  'ping-pong',
  'cup-yellow',
  'cup-orange',
])
  check(() =>
    assert.ok(fs.existsSync('public/assets/equipment/' + name + '.png')),
  );

// A newly installed character must be playable through the same ownership,
// recording and hand-socket path as the built-in roster, without source edits.
const packs = await import('../.test-build/character-pack.mjs'),
  registry = await import('../.test-build/character-registry.mjs');
const customCard = {
  ...m.CARDS[0],
  id: 'card-portable-test',
  name: 'Portable Test',
  asset: 'portable-test',
};
const customManifest = structuredClone(a.manifest('card-dan', 'dan', 'human')),
  revision = '0123456789abcdef',
  prefix = `/assets/characters/${customCard.id}/${revision}/`;
delete customManifest.puppet;
customManifest.cardId = customCard.id;
customManifest.cardImage = prefix + 'card.png';
customManifest.sheet = prefix + 'sheet.png';
for (const [pose, f] of Object.entries(customManifest.frames))
  f.url = prefix + pose + '.png';
const testPack = {
  format: 'wybmh-character',
  version: 1,
  revision,
  card: customCard,
  manifest: customManifest,
  files: Object.fromEntries(
    packs.PACK_FILES.map((name) => {
      const bytes = fs.readFileSync('public/assets/dan/' + name);
      return [
        name,
        {
          data: 'data:image/png;base64,' + bytes.toString('base64'),
          sha256: createHash('sha256').update(bytes).digest('hex'),
        },
      ];
    }),
  ),
  provenance: {
    method: 'Test fixture from approved drawings',
    source: 'Existing Dan art',
    createdAt: '2026-09-08T00:00:00Z',
  },
};
check(() =>
  assert.equal(packs.validateCharacterPack(testPack).card.id, customCard.id),
);
const performancePack = structuredClone(testPack);
performancePack.manifest.performance = JSON.parse(
  fs.readFileSync('docs/import-examples/dan-performance.json', 'utf8'),
);
performancePack.manifest.performance.id = customCard.id;
check(() =>
  assert.deepEqual(
    packs.validateCharacterPack(performancePack).manifest.performance.pools,
    performancePack.manifest.performance.pools,
  ),
);
const foreignProfile = structuredClone(performancePack);
foreignProfile.manifest.performance.id = 'card-other';
check(() =>
  assert.throws(
    () => packs.validateCharacterPack(foreignProfile),
    /profile must belong/,
  ),
);
const unsupportedRig = structuredClone(performancePack);
unsupportedRig.manifest.performance.rig = { format: 'spine' };
check(() =>
  assert.throws(
    () => packs.validateCharacterPack(unsupportedRig),
    /Spine exports/,
  ),
);
const namelessProfile = structuredClone(performancePack);
delete namelessProfile.manifest.performance.name;
check(() =>
  assert.throws(
    () => packs.validateCharacterPack(namelessProfile),
    /name must be/,
  ),
);
for (const mutate of [
  (p) => {
    p.card.id = 'card-dan';
  },
  (p) => {
    delete p.files['ready.png'];
  },
  (p) => {
    p.manifest.frames.ready.url = 'https://elsewhere.test/ready.png';
  },
  (p) => {
    p.manifest.frames.ready.hand = [-1, 0];
  },
  (p) => {
    p.card.family = 'cat';
  },
  (p) => {
    p.card.accuracy = 90;
  },
  (p) => {
    p.files['card.png'].data = 'data:text/html;base64,SGk=';
  },
  (p) => {
    p.manifest.frames.ready.width = 9999;
  },
]) {
  const invalid = structuredClone(testPack);
  mutate(invalid);
  check(() => assert.throws(() => packs.validateCharacterPack(invalid)));
}
const priorCount = m.CARDS.length;
registry.registerCharacter(
  customCard,
  customManifest,
  packs.packImageMap(testPack),
);
registry.registerCharacter(
  customCard,
  customManifest,
  packs.packImageMap(testPack),
);
check(() => assert.equal(m.CARDS.length, priorCount + 1));
check(() =>
  assert.equal(
    m.COPIES.filter((c) => c.cardId === customCard.id).length,
    m.USERS.length,
  ),
);
check(() =>
  assert.equal(
    registry.cardImageUrl(customCard.id),
    testPack.files['card.png'].data,
  ),
);
const defaultCustom = a.manifest(customCard.id, customCard.asset, 'human');
check(() => assert.deepEqual(defaultCustom, customManifest));
defaultCustom.frames.ready.hand[0]++;
check(() =>
  assert.deepEqual(
    a.manifest(customCard.id, customCard.asset, 'human'),
    customManifest,
  ),
);
for (const sport of m.SPORTS) {
  const cfg = setup(sport, 'installed-' + sport);
  cfg.participants[0] = {
    ...cfg.participants[0],
    cardId: customCard.id,
    copyId: m.COPIES.find(
      (c) =>
        c.cardId === customCard.id && c.userId === cfg.participants[0].userId,
    ).id,
  };
  cfg.characterAssets = [
    customManifest,
    a.manifest('card-doug', 'doug', 'human'),
  ];
  const dynamicRepo = new p.LocalArenaRepository(new MemoryStorage());
  const result = await dynamicRepo.commit(cfg);
  check(() => assert.deepEqual(s.validateRecording(result.recording), []));
  check(() =>
    assert.equal(
      result.recording.attempts.length,
      m.EVENTS[sport].attempts * 2,
    ),
  );
  check(() =>
    assert.deepEqual(
      result.recording.attempts[0].release,
      s.releasePosition(customCard.asset, sport, 0, customManifest),
    ),
  );
  check(() =>
    assert.ok(
      !JSON.stringify(result.recording).includes('data:image'),
      'Match storage must use immutable asset paths instead of large embedded pixels',
    ),
  );
  check(() =>
    assert.deepEqual(dynamicRepo.load().recordings.at(-1), result.recording),
  );
  const duplicate = await dynamicRepo.commit(cfg);
  check(() => assert.equal(duplicate.existing, true));
}

let showcase;
for (let i = 0; i < 100000; i++) {
  const r = s.simulate({
    ...setup('cornhole', 'velvet-paw-' + i),
    showcase: true,
    secret: true,
  });
  const last = r.attempts.at(-1),
    prior = r.attempts.at(-2);
  const contacts = r.attempts.map((a) => a.contact);
  if (
    r.winner === 1 &&
    last.contact === 'hole' &&
    prior.scoreAfter[1] <= prior.scoreAfter[0] &&
    contacts.includes('miss') &&
    contacts.includes('board') &&
    r.attempts.some(
      (a) =>
        a.contact === 'board' &&
        Math.hypot(a.target.x - 9.2, a.target.z - a.actor * 3.5) < 0.34,
    )
  ) {
    showcase = r;
    break;
  }
}
check(() => assert.ok(showcase));
fs.writeFileSync(
  'docs/showcase-recording.json',
  JSON.stringify(showcase, null, 2),
);
await (
  await import('./animation-tests.mjs')
).testAnimation({ check, setup, m, s, a, visual, stats });
await (
  await import('./personality-tests.mjs')
).testPersonalities({ check, setup, m, s, a });
await (
  await import('./puppet-tests.mjs')
).testPuppets({ check, setup, m, s, a, testPack, packs });
await (await import('./live-tests.mjs')).testLive({ check });
await (
  await import('./engine-tests.mjs')
).testEngine({ check, setup, m, s, a });
await (
  await import('./sport-mechanics-tests.mjs')
).testSportMechanics({ check, setup, m, s, a });
await (await import('./observability-tests.mjs')).testObservability({ check });
await (await import('./anatomy-tests.mjs')).testAnatomy({ check });
await (await import('./human-motion-tests.mjs')).testHumanMotion({ check });
await (await import('./organic-motion-tests.mjs')).testOrganicMotion({ check });
await (
  await import('./reference-throw-tests.mjs')
).testReferenceThrow({ check });
await (
  await import('./performance-timeline-tests.mjs')
).testPerformanceTimeline({ check });
await (
  await import('./cornhole-presentation-timing-tests.mjs')
).testCornholePresentationTiming({ check, setup, s });
await (await import('./motion-v3-tests.mjs')).testMotionV3({ check });
await (await import('./motion-v31-tests.mjs')).testMotionV31({ check });
await (
  await import('./performance-upgrade-tests.mjs')
).testPerformanceUpgrade({ check });
await (
  await import('./animation-upgrade-tests.mjs')
).testAnimationUpgrade({ check });
await (
  await import('./arm-material-generator-tests.mjs')
).testArmMaterialGenerator({ check });
await (
  await import('./animation-smoothness-tests.mjs')
).testAnimationSmoothness({ check });
checks += await (
  await import('./character-performance.test.mjs')
).performanceTests();
await (
  await import('./performance-profile-compile-gate.test.mjs')
).testPerformanceProfileCompileGate({ check });
const report = {
  checks,
  seededContests: 2000,
  stats,
  showcaseSeed: showcase.setup.seed,
  showcaseScores: showcase.scores,
  showcaseContacts: showcase.attempts.map((a) => a.contact),
  storage:
    'Atomic envelope and journal recovery; idempotency; historical policy; ownership; replay; exhibitions; corrections verified',
};
fs.writeFileSync('docs/test-results.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
