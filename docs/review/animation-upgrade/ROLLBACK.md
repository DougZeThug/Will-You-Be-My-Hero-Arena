# Baseline and rollback

Integration uses a SHA-256 inventory of the actual working tree from which this implementation was copied. The old Git HEAD is not the baseline for this change. All unlisted files, existing character atlases, recorded outcomes, and unrelated working-tree edits remain preserved.

The task workspace contains `arena-integration-manifest.json` and `arena-upgrade-rollback.zip`. The ZIP contains a manifest and the exact previous bytes of every overwritten file under `before/`. The manifest identifies added files with a null `before` hash. It also records the installed `after` hash.

To reconstruct the baseline, create a separate copy of the upgraded repository, overlay the ZIP's `before/` files, and omit files marked as newly added in the manifest. Keep dependencies and build output out of the source copy. Do not use the repository's old Git commit as a replacement for these preserved files.

For an in-place rollback, first compare every affected file with its recorded `after` hash. If any has changed since integration, reconcile that edit before restoring it. Restore only the listed overwritten files and remove only the listed newly added files whose hashes still match. Never reset, clean, or delete unrelated project work.

The immutable before/after movies remain useful after integration. The temporary original-source comparison server is stopped once its captures are complete, because the working repository will then contain the upgrade.
