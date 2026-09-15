# Arena editable motion pack v1

Each character folder contains a DragonBones 5.5 skeleton, packed texture atlas/PNG, and Arena semantic authoring metadata. Import the three `{character}_ske.json`, `{character}_tex.json`, and `{character}_tex.png` files together. The texture combines the preserved character atlas and the new hand sheet; source pixels are unchanged. This is an editable Arena-authored import, not a returned LoongBones project.

Runtime checked: Phaser 3.90.0 with DragonBones 5.7.000 at revision `64b6c69ae35777c2404be68c9192e2c56906079e`. Editor interchange target: LoongBones 1.2.3. Both packed imports load and play `v2_shoot` with finite geometry through the existing local importer. Runtime support for Animation Proxy and secondary physics constraints has not been assumed.

## Remaining editor pass

Native LoongBones editor automation is unavailable in this session. Complete these operations before production promotion:

1. Import Dan and Doug separately. Save editable projects under new names; retain these imports unchanged.
2. Confirm that `farArm` and `farHand` sit behind the torso and that both upper-arm caps overlap their shoulder sockets. Keep `shoulderUnderlay` on the chest underneath the moving sleeve; it is a small piece of the preserved shirt drawing that closes the overhead armhole. Check mesh edges, triangles, bone weights, and bind transforms. The legacy `_L` arm is the anatomical near/right arm.
3. Inspect `v2_shoot` at clip frames 31, 41, 46, 52, 76, 91, and the final frame. Equipment release is frame 46 at 60 fps. The support hand changes to open release on that frame. Keep the elbow extension speed; it supplies the physical ball launch.
4. Inspect `v2_gesture.fistPump`, `v2_gesture.chestTap`, `v2_gesture.bagFlip`, `v2_run`, `v2_jab`, and both characters' `v2_reference_flat_*`. Verify each exposure is opaque, without blended duplicate fingers.
5. Export to a separate `returned-editor-v1` folder. Compare bone parents, bind matrices, weights, duration, loop flags, key interpolation, events, IK bend direction/weight, and hand exposure against these imports. The earlier Dan editor round trip lost easing, loops, knee direction, and release association; this pass must check those fields explicitly.
6. Load the returned files through `/loongbones/`, then through the Human Motion adapter. Repeat the reference pose, release, blend, foot-support, and handoff checks. Keep corrected derivatives distinct from untouched editor output.

World foot locks, chest-contact envelopes, actor travel, target gaze, and bounded secondary motion are Arena runtime adapters. Editor-only playback does not reproduce their world-space contacts. The static import preserves the authored timelines and hand surfaces; it does not claim a baked world simulation.

Reproduce these files with `node scripts/export-animation-upgrade.mjs` while the local animation workshop is available on port 3015. Run `node scripts/verify-upgrade-import.mjs` for the local packed-import smoke check. Production installation and editor-round-trip flags intentionally remain false until their gates pass.
