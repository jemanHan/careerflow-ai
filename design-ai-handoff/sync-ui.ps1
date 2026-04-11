# frontend -> design-ai-handoff/ui 복사 (프로젝트 루트에서 실행 권장)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "frontend"
$dst = Join-Path $PSScriptRoot "ui"
Remove-Item -LiteralPath $dst -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path (Join-Path $dst "app\new") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dst "app\my") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dst "app\results\[id]") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dst "components") | Out-Null
Copy-Item (Join-Path $src "app\globals.css") (Join-Path $dst "app\")
Copy-Item (Join-Path $src "app\layout.tsx") (Join-Path $dst "app\")
Copy-Item (Join-Path $src "app\page.tsx") (Join-Path $dst "app\")
Copy-Item (Join-Path $src "app\new\page.tsx") (Join-Path $dst "app\new\")
Copy-Item (Join-Path $src "app\my\page.tsx") (Join-Path $dst "app\my\")
Copy-Item -LiteralPath (Join-Path $src "app\results\[id]\page.tsx") -Destination (Join-Path $dst "app\results\[id]\page.tsx")
Copy-Item (Join-Path $src "components\*.tsx") (Join-Path $dst "components\")
Copy-Item (Join-Path $src "tailwind.config.ts") $dst
Copy-Item (Join-Path $src "postcss.config.js") $dst
Write-Host "Synced to $dst"
