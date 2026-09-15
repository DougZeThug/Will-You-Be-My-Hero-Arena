DOUG - WEIGHTED LOONGBONES IMPORT FOUNDATION

This is Astra-authored DragonBones 5.5 interchange data, running in Arena's
Phaser 3.90.0 through the same native weighted-mesh bridge as Dan.
It is not yet an export returned by LoongBones. Keep that distinction.

IMPORT INTO YOUR EXISTING LOONGBONES PROJECT

1. Extract doug-rig-import.zip into a folder.
2. Drag doug_tex.png and doug_tex.json into the Library panel.
3. Then drag doug_ske.json into the same Library panel.
4. Open doug_weighted_v1. Do not replace or delete Dan's armature.
5. Preview idle_breathe, weight_shift, throw_flat and throw_arc.
6. Export Doug as DragonBones 5.5 JSON + atlas + PNG, then upload the ZIP here.

The skeleton includes mesh edges, userEdges, dimensions, normalized positive
weights, anatomical bind transforms, two foot IK constraints and named hand
release events. Do not remove those fields to force an import.

EXPECTED CONTENT

30 bones, including clavicles, elbows, wrists, pelvis, knees, ankles,
hand sockets and foot targets. One continuous weighted drawing.
11 clips: neutral, idle_breathe, idle_scan, weight_shift, enter_lockin,
bag_squeeze, throw_flat, throw_arc, celebrate_open_hand, inspect_hand,
reset_nod. Flat release: frame 39/60. Arc release: frame 51/60.

The PNG is byte-for-byte the original approved Doug ready illustration.
No face, outfit, logo, proportions or pixels were generated or resized.
The source is 255x589; close-up inspection will reveal its native resolution.

REVIEW AND LIMITS

Main match: http://127.0.0.1:3010/?scenario=cornhole-recorded
Rig review: http://127.0.0.1:3010/loongbones/doug/

This foundation supports bounded single-view motion. It cannot invent unseen
palm/finger artwork, hidden surfaces or full locomotion. Player production
and other sports are not migrated. Dan's editor round trip lost easing,
loop flags, IK bend direction and release-bone association; inspect Doug's
actual returned files for those losses rather than assuming fidelity.
