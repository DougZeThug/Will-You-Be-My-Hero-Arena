$sideDirectory = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../lab/loongbones/assets/cornhole-side-v3')).Path
foreach ($character in @('dan', 'doug')) {
  $readmePath = Join-Path $sideDirectory "$character-IMPORT.txt"
  @"
$character — board-facing cornhole rig, revision 3

1. Extract this ZIP into its own folder.
2. Keep your existing LoongBones project/armature as a backup.
3. Import ${character}_tex.png and ${character}_tex.json into Library.
4. Import ${character}_ske.json as a separate armature.
5. Preview neutral, idle_breathe and cornhole_throw_*_R_$character.
6. Export DragonBones JSON with textures, then attach the ZIP in Codex.

This is a newly authored layered rig, not a returned editor export.
It includes a near-profile body, continuous arm, sleeve overlap, and
registered grip/open/relaxed hand artwork. Eight mesh slots, 30 bones.
Torso and hidden back cloth follow the rib cage; front/back sleeve surfaces
follow the arm. Preserve these separate material weights and source UVs.
L denotes the near anatomical RIGHT throwing arm for socket compatibility.
Both feet face screen right, toward the board.
Motion polish 2 adds 17 whole-body pose landmarks, independent pelvis
compression/transfer, a moving clavicle, head stabilization and arm recovery.
Keep material triangles grouped far arm, far leg, near leg, torso. Do not
interleave those surfaces or transfer the shorts outline onto the far hand.
Hand registration revision 2 uses the anatomical wrist crease as pivot,
adult-sized hands, forearm overlap and bounded wrist articulation.
Hand exposures are opaque: do not add alpha dissolves between finger drawings.

Preserve weights, IK, colorFrame alpha, easing curves, and the bagRelease /
release markers on throwing_hand. Hand changes are slot color animation,
not independently rigged fingers. Foot IK uses opposite knee branches.
Codex must compare a returned export: the earlier LoongBones round trip
lost curves, an IK branch and the release-bone association.

Current verification is inside the exact local Phaser 3.90 runtime.
These assets are installed only in the main internal cornhole Lab.
Editor round-trip and wider production migration remain unverified.
"@ | Set-Content -LiteralPath $readmePath
  $files = @("${character}_ske.json", "${character}_tex.json", "${character}_tex.png", "$character-IMPORT.txt") | ForEach-Object { Join-Path $sideDirectory $_ }
  Compress-Archive -LiteralPath $files -DestinationPath (Join-Path $sideDirectory "$character-side-v3-import.zip") -Force
}
