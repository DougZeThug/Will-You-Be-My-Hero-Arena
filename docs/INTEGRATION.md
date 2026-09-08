# Connecting Will You Be My Hero

Current authority is **local demo**. Four fictional demo users share this browser’s fixtures. Nothing here is a shared or trusted competitive service yet.

The typed service contracts are in `lib/arena/adapters.ts`: IdentityProvider, CardCatalog, OwnedCardProvider, CharacterAssetProvider, EventAdapter, and ArenaRepository. `createDemoServices(storage)` is a working fixture implementation. Starting a contest calls the demo identity and asynchronous ownership adapters and commits through the repository interface. The collection display still renders fixture catalog data; wire it to the authenticated catalog and owned-copy queries when connecting shared services.

On connection:

1. Resolve IdentityProvider from your authenticated app session; remove the demo identity picker.
2. Query owned copies for that identity through OwnedCardProvider. Preserve user, card and owned-copy IDs. Treat cosmetic finish independently of traits and animated assets.
3. Prepare and approve assets separately from card imports. Connect CharacterAssetProvider to reviewed manifests. Unknown cards stay unavailable until an asset exists.
4. Replace LocalArenaRepository.commit with a server endpoint. The client submits a legal entry choice and idempotency key, **never trusted score or point totals**. Verify session, owned copy, opponent schedule, allowance, rules version and supported actions server-side. Obtain the seed server-side. Run the versioned simulation there.
5. In one database transaction, save the immutable recording and ledger rows with a unique `(contest_id, user_id, leaderboard_id)` constraint. Mark the entry resolved. Return the recording only after this transaction succeeds.
6. Store playback progress separately. Pause, speed, skip, resize and replay use the same recorded path and cannot call the award endpoint again.
7. Derive standings by summing ledger deltas. Equal point totals share a rank; stable user ID ordering only controls display. Event views filter the same ledger, without combining raw sports scores.

The local adapter demonstrates atomic/idempotent semantics with one serialized state envelope, checksum, write-ahead journal and revision recovery. `navigator.locks` serializes result commits in supported browsers. localStorage is user-editable and is not an authorization boundary. Replace it before shared competition. Long-running production histories also need indexed persistence rather than this entire-state local envelope.

`adjustAward` appends a correction referencing its original award. A policy update creates a new ID and leaves historical deltas unchanged. Explicit migration is required to recalculate history.

The fixtures include one counted basketball result for every demo user. Each user has three remaining counted entries under the four-entry prototype allowance. Exhibition has no allowance and no points. The current schedule covers each of the four sports once per user.

The simulation uses ballistic samples and explicit deterministic contact rules. Cornhole bags do not collide/displace earlier bags in this arcade preset. These simplifications are part of the recorded rules version. Add a new version if collision or scoring semantics change; retain old recordings for replay.

The checksum catches accidental corruption; it is not a cryptographic signature. The client-side seed and catalog are not secure. Production signatures and score-write authorization belong on the server.

