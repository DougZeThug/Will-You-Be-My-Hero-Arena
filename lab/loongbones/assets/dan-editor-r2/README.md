# Received Dan export and explicit compatibility copy

`original-export.zip` and `dan-editor-r2_ske.json`, `dan-editor-r2_tex.json`, `dan-editor-r2_tex.png` are the unchanged user-supplied LoongBones 1.2.3 export. Their hashes are in `provenance.json`.

`dan-arena-restored_ske.json` is a **derived** Arena compatibility restoration. It preserves the exported drawing, mesh, keys and nonzero weights, restores verified source easing, idle loops, left-knee direction and release-bone association, and removes only zero-weight influences. It must not be presented as unchanged editor output.

Reproduce the audit with `node scripts/audit-dan-editor-export.mjs`. Review the full findings in `docs/review/dan-roundtrip-r2/README.md`. The raw round trip is not faithful and neither file is installed in production. The three local review choices are at `/loongbones/dan/?sample=authored`, `?sample=editor`, and `?sample=restored`.
