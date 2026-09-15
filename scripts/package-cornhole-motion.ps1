$motionDirectory = Join-Path $PSScriptRoot '../lab/loongbones/assets/cornhole-motion-v2'
$motionDirectory = (Resolve-Path -LiteralPath $motionDirectory).Path
foreach ($character in @('dan','doug')) {
  $readme = Join-Path $motionDirectory "$character-IMPORT.txt"
  @"
$character - right-handed cornhole motion revision 2

1. Extract this ZIP.
2. In LoongBones, keep your existing project/armature as a backup.
3. Import ${character}_tex.png and ${character}_tex.json into Library.
4. Import ${character}_ske.json into a separate armature/project.
5. Preview the cornhole_throw_*_R_$character clips.
6. Export DragonBones JSON + texture and attach the returned ZIP in Codex.

The R in a clip means anatomical right. Bone suffixes L/R in the original
source mean IMAGE sides. throwing_hand correctly belongs to hand_L.

The bagRelease marker occurs during forward movement. release is its engine
compatibility alias. Keep both, the curved rotate/translate tracks, skin
weights and planted-foot IK. Astra will check these after export, since
Dan's earlier LoongBones round trip lost some curves/marker associations.

This is newly authored derived motion, not an unchanged editor export.
Original character PNG pixels are retained. Mesh material boundaries and
local fabric underlap are explicitly derived rigging changes. Complete
alternate palms, fingers, hidden layers and locomotion are not included.
"@ | Set-Content -LiteralPath $readme
  $files = @("${character}_ske.json","${character}_tex.json","${character}_tex.png","$character-IMPORT.txt") | ForEach-Object {Join-Path $motionDirectory $_}
  Compress-Archive -LiteralPath $files -DestinationPath (Join-Path $motionDirectory "$character-motion-v2-import.zip") -Force
}
