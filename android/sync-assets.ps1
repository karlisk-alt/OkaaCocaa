$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $PSScriptRoot "app\src\main\assets\www"

New-Item -ItemType Directory -Force -Path (Join-Path $dest "css"), (Join-Path $dest "js") | Out-Null

Copy-Item (Join-Path $root "index.html") $dest -Force
Copy-Item (Join-Path $root "css\*") (Join-Path $dest "css") -Force
Copy-Item (Join-Path $root "js\*") (Join-Path $dest "js") -Force

Write-Host "Synced game assets to android/app/src/main/assets/www"