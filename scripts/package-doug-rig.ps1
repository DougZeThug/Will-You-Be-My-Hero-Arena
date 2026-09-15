$ErrorActionPreference = 'Stop'
$arenaRoot = Split-Path -Parent $PSScriptRoot
$rigDirectory = Join-Path $arenaRoot 'lab/loongbones/assets/doug-weighted-v1'
$sourceReadme = Join-Path $arenaRoot 'lab/loongbones/doug-rig/IMPORT-README.txt'
Copy-Item -LiteralPath $sourceReadme -Destination (Join-Path $rigDirectory 'README.txt') -Force
$packFiles = @('doug_ske.json', 'doug_tex.json', 'doug_tex.png', 'README.txt') | ForEach-Object { Join-Path $rigDirectory $_ }
Compress-Archive -LiteralPath $packFiles -DestinationPath (Join-Path $rigDirectory 'doug-rig-import.zip') -CompressionLevel Optimal -Force
Get-Item -LiteralPath (Join-Path $rigDirectory 'doug-rig-import.zip') | Select-Object FullName, Length
