$ErrorActionPreference = 'Stop'
$arenaRoot = Split-Path -Parent $PSScriptRoot
$rigDirectory = Join-Path $arenaRoot 'lab/loongbones/assets/dan-weighted-v1'
$sourcePath = Join-Path $arenaRoot 'lab/assets/dan-source/full-body-v2.png'
$rigFiles = @('dan_ske.json', 'dan_tex.json', 'dan_tex.png')
$hashes = [ordered]@{}
foreach ($rigFile in $rigFiles) {
    $hashes[$rigFile] = (Get-FileHash -LiteralPath (Join-Path $rigDirectory $rigFile) -Algorithm SHA256).Hash.ToLowerInvariant()
}
$provenance = [ordered]@{
    character = 'dan'
    authoringRevision = (Get-Content -LiteralPath (Join-Path $rigDirectory 'authoring.json') -Raw | ConvertFrom-Json).revision
    authoredBy = 'Astra; local DragonBones 5.5 authoring'
    editorExport = $false
    editorRoundTripVerified = $false
    productionInstalled = $false
    source = 'lab/assets/dan-source/full-body-v2.png'
    sourceSha256 = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
    texturePreparation = 'Existing magenta chroma-key converted to alpha; drawing RGB and dimensions preserved'
    assetsSha256 = $hashes
}
$provenance | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $rigDirectory 'provenance.json') -Encoding utf8
Copy-Item -LiteralPath (Join-Path $arenaRoot 'lab/loongbones/dan-rig/IMPORT-README.txt') -Destination (Join-Path $rigDirectory 'README.txt') -Force
$packFiles = @($rigFiles + 'README.txt' | ForEach-Object { Join-Path $rigDirectory $_ })
Compress-Archive -LiteralPath $packFiles -DestinationPath (Join-Path $rigDirectory 'dan-rig-import.zip') -CompressionLevel Optimal -Force
Get-Item -LiteralPath (Join-Path $rigDirectory 'dan-rig-import.zip') | Select-Object FullName, Length
