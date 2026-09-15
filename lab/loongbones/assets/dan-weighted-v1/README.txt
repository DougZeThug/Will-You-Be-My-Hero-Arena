DAN - WEIGHTED RIG FOUNDATION

Revision 2: adds mesh boundary edges and explicit dimensions required by
LoongBones' authoring tools. The artwork, vertices, weights, bones, IK and
animation data are unchanged from revision 1.

UPDATING THE FIRST IMPORT

Astra preserved the original editor armature as dan_import_r1.
Your existing dan_tex assets can be reused: drag ONLY this ZIP's updated
dan_ske.json into Library, then open dan_weighted_v1.
Do not re-use dan_ske.json from the earlier downloaded ZIP.

This is Astra-authored DragonBones 5.5 interchange data. It has been tested
in Arena's Phaser 3.90.0 Lab. It is NOT an export produced by LoongBones,
and a LoongBones import/export round trip is still required.

IMPORT IN THE OPEN LOONGBONES 1.2.3 EDITOR

1. Extract this ZIP into a folder.
2. Drag dan_tex.png and dan_tex.json into the Library panel on the right.
   The editor's Import dialog says to import assets before skeleton data.
3. Then drag dan_ske.json into the same Library panel.
4. Open the new dan_weighted_v1 armature. Do not replace the ubbie example.
5. Tell Astra: "Dan is imported. Continue the LoongBones rig review."

Do not drag this README, the ZIP itself, or just the PNG onto the stage.
The PNG alone is only the drawing; the JSON contains the bones and weights.
If the editor rejects anything, give Astra the exact error. Do not strip
weights or constraints just to make it import.

EXPECTED CONTENT

30 bones including chest, clavicles, upper arms, elbows, wrists, pelvis,
hips, knees, ankles, hand sockets and two foot targets.
One weighted body mesh; two two-bone foot IK constraints.
Seven clips: neutral, idle_breathe, look_target, arm_check, throw_low,
quiet_nod, weight_shift. The low throw has a named release frame event.

SOURCE AND LIMITS

The approved Dan illustration retains its RGB drawing, proportions,
logo and clothing. Its existing magenta-key background becomes alpha.
No body parts are independently resized. This is one source view with
limited deformation range; hidden art, alternate hands, locomotion and
full sports actions still need authoring. The orange bag in Arena Lab is
a Phaser socket/release diagnostic and is not an exported rig attachment.

Review locally: http://127.0.0.1:3010/loongbones/dan/
The regular Arena character is unchanged.
